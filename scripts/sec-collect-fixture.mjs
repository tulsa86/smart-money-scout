import {writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseOwnershipXml,val,children,first} from './form4-xml.mjs';

// SEC-indexed URLs are fixed here; never accept arbitrary workflow inputs.
// Download original bytes, reject unexpected content, and save SHA-256 evidence.
const filings=[
 {accession:'0000080424-26-000218',url:'https://www.sec.gov/Archives/edgar/data/80424/000008042426000218/form4.xml',form:'4',code:'A',issuerCik:'80424'},
 {accession:'0001140361-26-036978',url:'https://www.sec.gov/Archives/edgar/data/1820096/000114036126036978/form4.xml',form:'4',code:'P'},
 {accession:'0001193125-26-354277',url:'https://www.sec.gov/Archives/edgar/data/1089872/000119312526354277/ownership.xml',form:'4/A',code:'P',issuerCik:'1089872'}
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
 if(buffer.length===0||buffer.length>5_000_000)throw Error('SEC XML size invalid');
 const root=parseOwnershipXml(buffer.toString('utf8'));
 if(val(root,'documentType')!==item.form)throw Error('Unexpected SEC document type for '+item.accession);
 const issuerCik=val(first(root,'issuer'),'issuerCik');
 if(!issuerCik||!/^\d+$/.test(issuerCik)||(item.issuerCik&&BigInt(issuerCik)!==BigInt(item.issuerCik)))throw Error('Unexpected issuer for '+item.accession);
 const codes=children(first(root,'nonDerivativeTable'),'nonDerivativeTransaction').map(tx=>val(first(tx,'transactionCoding'),'transactionCode'));
 if(!codes.includes(item.code))throw Error('Expected transaction code '+item.code+' missing for '+item.accession);
 const filename=item.accession+'.xml';
 writeFileSync(dir+'/'+filename,buffer);
 const entry={file:filename,accession:item.accession,sourceUrl:item.url,retrievedAt:new Date().toISOString(),sha256:createHash('sha256').update(buffer).digest('hex')};
 manifest.filings.push(entry);
 console.log('Verified SEC document',item.accession,'form',item.form,'issuerCik',issuerCik,'codes',codes.join(','),'bytes',buffer.length,'sha256',entry.sha256);
}
writeFileSync(dir+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
