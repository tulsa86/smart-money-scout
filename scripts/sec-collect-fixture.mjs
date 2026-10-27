import {writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseOwnershipXml,val,children,first} from './form4-xml.mjs';

// Fixed SEC-published XML URLs, verified against the public filing pages.
// Fail closed on wrong document type or unexpected transaction codes.
const filings=[
 {accession:'0000080424-26-000218',url:'https://www.sec.gov/Archives/edgar/data/80424/000008042426000218/form4.xml',form:'4',expectedCodes:['A']},
 {accession:'0001628873-26-000095',url:'https://www.sec.gov/Archives/edgar/data/1031235/000162887326000095/form4.xml',form:'4',expectedCodes:['P','P','P','P']},
 {accession:'0001213900-26-032908',url:'https://www.sec.gov/Archives/edgar/data/1984693/000121390026032908/ownership.xml',form:'4/A',expectedCodes:['S','S','S']}
];
const ua=process.env.SEC_USER_AGENT;
if(!ua||!/.+@.+\..+/.test(ua))throw Error('SEC_USER_AGENT must identify a genuine contact email');
const dir='sec-fixture-output';mkdirSync(dir,{recursive:true});
const manifest={schemaVersion:1,filings:[]};
for(const item of filings){
 const response=await fetch(item.url,{headers:{'User-Agent':ua,Accept:'application/xml,text/xml'},redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('SEC HTTP '+response.status+' for '+item.accession);
 const declared=response.headers.get('content-length');
 if(declared!==null&&Number(declared)>5_000_000)throw Error('SEC XML too large');
 const buffer=Buffer.from(await response.arrayBuffer());
 if(buffer.length>5_000_000)throw Error('SEC XML too large');
 const root=parseOwnershipXml(buffer.toString('utf8'));
 if(val(root,'documentType')!==item.form)throw Error('Unexpected SEC document type for '+item.accession);
 const codes=children(first(root,'nonDerivativeTable'),'nonDerivativeTransaction').map(tx=>val(first(tx,'transactionCoding'),'transactionCode'));
 if(JSON.stringify(codes)!==JSON.stringify(item.expectedCodes))throw Error('Unexpected transaction codes for '+item.accession+': '+JSON.stringify(codes));
 const filename=item.accession+'.xml';
 writeFileSync(dir+'/'+filename,buffer);
 const entry={file:filename,accession:item.accession,sourceUrl:item.url,retrievedAt:new Date().toISOString(),sha256:createHash('sha256').update(buffer).digest('hex')};
 manifest.filings.push(entry);
 console.log('SEC fixture:',item.form,item.accession,'bytes:',buffer.length,'sha256:',entry.sha256);
}
writeFileSync(dir+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
