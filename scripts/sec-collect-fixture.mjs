import {writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseOwnershipXml,val,children,first} from './form4-xml.mjs';

// Fixed, independently located SEC EDGAR XML URLs. Never accept arbitrary workflow URLs.
const filings=[
 {accession:'0000080424-26-000218',url:'https://www.sec.gov/Archives/edgar/data/80424/000008042426000218/form4.xml',form:'4',cik:'80424',requiredCode:'A'},
 {accession:'0001628873-26-000095',url:'https://www.sec.gov/Archives/edgar/data/1031235/000162887326000095/form4.xml',form:'4',cik:'1031235',requiredCode:'P'},
 {accession:'0000818479-26-000218',url:'https://www.sec.gov/Archives/edgar/data/818479/000081847926000218/form4a.xml',form:'4/A',cik:'818479',requiredCode:'P'}
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
 const issuerCik=val(first(root,'issuer'),'issuerCik');
 if(!issuerCik||BigInt(issuerCik)!==BigInt(item.cik))throw Error('Issuer mismatch for '+item.accession);
 const codes=children(first(root,'nonDerivativeTable'),'nonDerivativeTransaction').map(tx=>val(first(tx,'transactionCoding'),'transactionCode'));
 if(!codes.includes(item.requiredCode))throw Error('Expected transaction code '+item.requiredCode+' missing for '+item.accession);
 const filename=item.accession+'.xml';
 writeFileSync(dir+'/'+filename,buffer);
 const entry={file:filename,accession:item.accession,sourceUrl:item.url,retrievedAt:new Date().toISOString(),sha256:createHash('sha256').update(buffer).digest('hex')};
 manifest.filings.push(entry);
 console.log('SEC verified:',item.form,item.accession,'bytes:',buffer.length,'sha256:',entry.sha256);
}
writeFileSync(dir+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
