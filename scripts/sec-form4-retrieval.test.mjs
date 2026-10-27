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
test('retrieves source XML and preserves filing provenance',async()=>{const requested=[];const fetchImpl=async(url,opts)=>{requested.push({url,agent:opts.headers['User-Agent']});return response(url.endsWith('index.json')?JSON.stringify({directory:{item:[{name:'ownership.xml'}]}}):xml)};const r=await retrieveForm4Candidate(filing,{userAgent:ua,fetchImpl});assert.equal(r.transactions.length,1);assert.equal(r.transactions[0].reportedPurchaseValue,20);assert.equal(r.validationStatus,'parsed_not_reconciled');assert.equal(r.acceptanceTime,null);assert.equal(r.transactions[0].filedAt,undefined);assert.equal(requested.length,2);assert.ok(requested.every(x=>x.agent===ua))});
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
