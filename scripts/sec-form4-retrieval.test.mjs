import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchSecText,fetchRecentOwnershipFilings,selectOwnershipXml,retrieveForm4Candidate} from './sec-form4-retrieval.mjs';
const ua='SmartMoneyScout research contact@example.org';
const base='https://www.sec.gov/Archives/edgar/data/320193/000032019326000001/';
const filing={accession:'0000320193-26-000001',cik:'320193',ticker:'AAPL',formType:'4',filingDate:'2026-10-27',filingIndexUrl:base,primaryDocumentUrl:base+'primary.html'};
const xml='<ownershipDocument><documentType>4</documentType><issuer><issuerCik>320193</issuerCik></issuer><nonDerivativeTable><nonDerivativeTransaction><securityTitle><value>Common Stock</value></securityTitle><transactionDate><value>2026-10-26</value></transactionDate><transactionCoding><transactionCode>P</transactionCode></transactionCoding><transactionAmounts><transactionShares><value>2</value></transactionShares><transactionPricePerShare><value>10</value></transactionPricePerShare><transactionAcquiredDisposedCode><value>A</value></transactionAcquiredDisposedCode></transactionAmounts></nonDerivativeTransaction></nonDerivativeTable></ownershipDocument>';
const response=body=>({ok:true,headers:{get:()=>null},text:async()=>body});
test('SEC requests require contact and reject foreign hosts',async()=>{await assert.rejects(fetchSecText(base+'index.json',{fetchImpl:async()=>response('{}')}),/User-Agent/);await assert.rejects(fetchSecText('https://evil.example/Archives/edgar/data/1/2/x.xml',{userAgent:ua,fetchImpl:async()=>response('')}),/Unsafe/)});
test('selecting ambiguous XML fails closed',()=>{assert.throws(()=>selectOwnershipXml({directory:{item:[{name:'a.xml'},{name:'b.xml'}]}}),/manual selection/);assert.equal(selectOwnershipXml({directory:{item:[{name:'index.xml'},{name:'ownership.xml'}]}}),'ownership.xml')});
test('retrieves source XML and preserves filing provenance',async()=>{const requested=[];const fetchImpl=async(url,opts)=>{requested.push({url,agent:opts.headers['User-Agent']});return response(url.endsWith('index.json')?JSON.stringify({directory:{item:[{name:'ownership.xml'}]}}):xml)};const r=await retrieveForm4Candidate(filing,{userAgent:ua,fetchImpl});assert.equal(r.transactions.length,1);assert.equal(r.transactions[0].reportedPurchaseValue,20);assert.equal(r.validationStatus,'parsed_not_reconciled');assert.equal(r.acceptanceTime,null);assert.equal(r.transactions[0].filedAt,null);assert.equal(requested.length,2);assert.ok(requested.every(x=>x.agent===ua))});
test('HTTP failures propagate rather than producing empty data',async()=>{await assert.rejects(fetchSecText(base+'index.json',{userAgent:ua,fetchImpl:async()=>({ok:false,status:429,headers:{get:()=>null}})}),/429/)});

test('SEC fetch explicitly rejects HTTP redirects',async()=>{let redirect;await fetchSecText(base+'index.json',{userAgent:ua,fetchImpl:async(_url,opts)=>{redirect=opts.redirect;return response('{}')}});assert.equal(redirect,'error')});

test('streamed SEC responses are size-limited before full buffering',async()=>{let reads=0;const stream=new ReadableStream({pull(controller){reads++;controller.enqueue(new Uint8Array(3_000_000));if(reads===2)controller.close()}});await assert.rejects(fetchSecText(base+'index.json',{userAgent:ua,fetchImpl:async()=>({ok:true,headers:{get:()=>null},body:stream})}),/too large/)});

test('retains independently supplied SEC acceptance time',async()=>{const fetchImpl=async url=>response(url.endsWith('index.json')?JSON.stringify({directory:{item:[{name:'ownership.xml'}]}}):xml);const r=await retrieveForm4Candidate({...filing,acceptanceTime:'2026-10-27T18:12:00.000Z'},{userAgent:ua,fetchImpl});assert.equal(r.acceptanceTime,'2026-10-27T18:12:00.000Z')});

test('SEC submissions API discovery checks issuer identity and preserves source filing data',async()=>{
 let request;
 const fetchImpl=async(url,options)=>{request={url,options};return response(JSON.stringify({cik:320193,filings:{recent:{accessionNumber:['0000320193-26-000001'],form:['4'],filingDate:['2026-10-27'],primaryDocument:['primary.html'],acceptanceDateTime:['2026-10-27T16:20:00']}}}))};
 const result=await fetchRecentOwnershipFilings('0000320193',{userAgent:ua,fetchImpl});
 assert.equal(request.url,'https://data.sec.gov/submissions/CIK0000320193.json');
 assert.equal(request.options.redirect,'error');
 assert.equal(result.length,1);
 assert.equal(result[0].acceptanceTimezone,'America/New_York');
 assert.equal(result[0].acceptanceTime,'2026-10-27T16:20:00');
});
test('SEC submissions API rejects mismatched issuer CIK',async()=>{
 const fetchImpl=async()=>response(JSON.stringify({cik:1,filings:{recent:{accessionNumber:[],form:[],filingDate:[],primaryDocument:[]}}}));
 await assert.rejects(fetchRecentOwnershipFilings('320193',{userAgent:ua,fetchImpl}),/CIK mismatch/);
});
test('SEC submissions API rejects invalid CIK without a request',async()=>{
 await assert.rejects(fetchRecentOwnershipFilings('../320193',{userAgent:ua,fetchImpl:()=>{throw Error('should not fetch')}}),/Invalid issuer CIK/);
});

test('exact primary ownership XML resolves otherwise ambiguous archive',()=>{
 const index={directory:{item:[{name:'ownership.xml'},{name:'other.xml'}]}};
 assert.equal(selectOwnershipXml(index,{primaryDocument:'ownership.xml'}),'ownership.xml');
 assert.throws(()=>selectOwnershipXml(index,{primaryDocument:'unknown.xml'}),/manual selection/);
});

test('retrieval rejects mismatched SEC accession archive before fetching',async()=>{
 let called=false;
 await assert.rejects(retrieveForm4Candidate({...filing,filingIndexUrl:'https://www.sec.gov/Archives/edgar/data/1/2/',primaryDocumentUrl:'https://www.sec.gov/Archives/edgar/data/1/2/x.xml'},{userAgent:ua,fetchImpl:async()=>{called=true;return response('{}')}}),/archive identity mismatch/);
 assert.equal(called,false);
});
test('retrieval accepts padded issuer CIK independent of archive submitter',async()=>{
 const fetchImpl=async url=>response(url.endsWith('index.json')?JSON.stringify({directory:{item:[{name:'ownership.xml'}]}}):xml);
 const result=await retrieveForm4Candidate({...filing,cik:'0000320193'},{userAgent:ua,fetchImpl});
 assert.equal(result.transactions.length,1);
});

test('ownership XML supplies issuer CIK when SEC submissions filer differs',async()=>{
 const fetchImpl=async url=>response(url.endsWith('index.json')?JSON.stringify({directory:{item:[{name:'ownership.xml'}]}}):xml);
 const r=await retrieveForm4Candidate({...filing,cik:null,submitterCik:'320193'},{userAgent:ua,fetchImpl});
 assert.equal(r.cik,'320193');
 assert.equal(r.transactions[0].cik,'320193');
 assert.equal(r.submitterCik,'320193');
});
test('retrieval rejects conflicting known issuer and ownership XML',async()=>{
 const fetchImpl=async url=>response(url.endsWith('index.json')?JSON.stringify({directory:{item:[{name:'ownership.xml'}]}}):xml);
 await assert.rejects(retrieveForm4Candidate({...filing,cik:'1234'},{userAgent:ua,fetchImpl}),/issuer CIK mismatch/);
});


test('end-to-end discovery to XML resolves issuer distinct from submissions filer',async()=>{
 const filingAccession='0000320193-26-000001';
 const issuerXml=xml.replace('<issuerCik>320193</issuerCik>','<issuerCik>1234</issuerCik>');
 const fetchImpl=async url=>{
  if(url.includes('data.sec.gov/submissions/'))return response(JSON.stringify({cik:320193,filings:{recent:{accessionNumber:[filingAccession],form:['4'],filingDate:['2026-10-27'],primaryDocument:['primary.html'],acceptanceDateTime:['2026-10-27T16:20:00']}}}));
  if(url.endsWith('/index.json'))return response(JSON.stringify({directory:{item:[{name:'ownership.xml'}]}}));
  if(url.endsWith('/ownership.xml'))return response(issuerXml);
  throw Error('Unexpected URL: '+url);
 };
 const filings=await fetchRecentOwnershipFilings('320193',{userAgent:ua,fetchImpl});
 assert.equal(filings[0].cik,null);
 assert.equal(filings[0].submitterCik,'320193');
 const result=await retrieveForm4Candidate(filings[0],{userAgent:ua,fetchImpl});
 assert.equal(result.cik,'1234');
 assert.equal(result.submitterCik,'320193');
 assert.equal(result.transactions[0].cik,'1234');
 assert.equal(result.transactions[0].reportedPurchaseValue,20);
 assert.equal(result.acceptanceTime,'2026-10-27T16:20:00');
});

test('retrieves SEC filing when filing agent accession prefix differs from filer CIK',async()=>{
 const agentBase='https://www.sec.gov/Archives/edgar/data/320193/000114036126040540/';
 const fetchImpl=async url=>response(url.endsWith('index.json')?JSON.stringify({directory:{item:[{name:'form4.xml'}]}}):xml);
 const r=await retrieveForm4Candidate({...filing,accession:'0001140361-26-040540',archiveCik:'320193',submitterCik:'320193',filingIndexUrl:agentBase,primaryDocumentUrl:agentBase+'form4.xml',primaryDocument:'form4.xml'},{userAgent:ua,fetchImpl});
 assert.equal(r.cik,'320193');assert.equal(r.transactions.length,1);
});

test('SEC acceptance wall-clock remains provenance, not verified public timestamp',async()=>{
 const fetchImpl=async url=>response(url.endsWith('index.json')?JSON.stringify({directory:{item:[{name:'ownership.xml'}]}}):xml);
 const r=await retrieveForm4Candidate({...filing,acceptanceTime:'2026-10-27T16:20:00',acceptanceTimezone:'America/New_York'},{userAgent:ua,fetchImpl});
 assert.equal(r.publicAvailabilityStatus,'sec_acceptance_time_publication_unverified');
 assert.equal(r.transactions[0].secAcceptanceTime,'2026-10-27T16:20:00');
 assert.equal(r.transactions[0].secAcceptanceTimezone,'America/New_York');
 assert.equal(r.transactions[0].filedAt,null);
 assert.equal(r.transactions[0].investmentSignal,false);
});
test('unverified or missing acceptance time cannot become public-availability timestamp',async()=>{
 const fetchImpl=async url=>response(url.endsWith('index.json')?JSON.stringify({directory:{item:[{name:'ownership.xml'}]}}):xml);
 const r=await retrieveForm4Candidate({...filing,acceptanceTime:'2026-10-27T16:20:00'},{userAgent:ua,fetchImpl});
 assert.equal(r.publicAvailabilityStatus,'unknown');assert.equal(r.transactions[0].secAcceptanceTime,null);assert.equal(r.transactions[0].filedAt,null);
});

test('invalid SEC acceptance calendar and clock values never become provenance',async()=>{
 const fetchImpl=async url=>response(url.endsWith('index.json')?JSON.stringify({directory:{item:[{name:'ownership.xml'}]}}):xml);
 for(const acceptanceTime of ['2026-02-30T16:20:00','2026-10-27T25:20:00','2026-10-27T16:60:00']){
  const r=await retrieveForm4Candidate({...filing,acceptanceTime,acceptanceTimezone:'America/New_York'},{userAgent:ua,fetchImpl});
  assert.equal(r.publicAvailabilityStatus,'unknown');
  assert.equal(r.transactions[0].secAcceptanceTime,null);
  assert.equal(r.transactions[0].filedAt,null);
 }
});

test('nested SEC XML document paths are selected without allowing traversal',()=>{
 const index={directory:{item:[{name:'xslF345X05/index.xml'},{name:'xslF345X05/ownership.xml'}]}};
 assert.equal(selectOwnershipXml(index,{primaryDocument:'xslF345X05/ownership.xml'}),'xslF345X05/ownership.xml');
 assert.equal(selectOwnershipXml(index),'xslF345X05/ownership.xml');
 assert.throws(()=>selectOwnershipXml({directory:{item:[{name:'../ownership.xml'}]}}),/manual selection/);
});
test('retrieval handles nested ownership XML from SEC archive index',async()=>{
 const nested='xslF345X05/ownership.xml';
 const requested=[];
 const fetchImpl=async url=>{requested.push(url);return response(url.endsWith('index.json')?JSON.stringify({directory:{item:[{name:nested}]}}):xml)};
 const r=await retrieveForm4Candidate({...filing,primaryDocument:nested,primaryDocumentUrl:base+nested},{userAgent:ua,fetchImpl});
 assert.equal(r.transactions.length,1);
 assert.equal(r.sourceUrl,base+nested);
 assert.equal(requested[1],base+nested);
});
