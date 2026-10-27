import {writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseOwnershipXml,val} from './form4-xml.mjs';

// Known SEC EDGAR Form 4. Keep the URL fixed: never fetch arbitrary workflow inputs.
const url='https://www.sec.gov/Archives/edgar/data/80424/000008042426000218/form4.xml';
const ua=process.env.SEC_USER_AGENT;
if(!ua||!/.+@.+\..+/.test(ua))throw Error('SEC_USER_AGENT must identify a genuine contact email');
const response=await fetch(url,{headers:{'User-Agent':ua,Accept:'application/xml,text/xml'},redirect:'error',signal:AbortSignal.timeout(20000)});
if(!response.ok)throw Error('SEC HTTP '+response.status);
const declared=Number(response.headers.get('content-length'));
if(Number.isFinite(declared)&&declared>5_000_000)throw Error('SEC XML too large');
const buffer=Buffer.from(await response.arrayBuffer());
if(buffer.length>5_000_000)throw Error('SEC XML too large');
const root=parseOwnershipXml(buffer.toString('utf8'));
if(val(root,'documentType')!=='4')throw Error('Unexpected SEC ownership XML');
const dir='sec-fixture-output';mkdirSync(dir,{recursive:true});
const filename='0000080424-26-000218.xml';
writeFileSync(`${dir}/${filename}`,buffer);
const manifest={schemaVersion:1,filings:[{file:filename,accession:'0000080424-26-000218',sourceUrl:url,retrievedAt:new Date().toISOString(),sha256:createHash('sha256').update(buffer).digest('hex')}]};
writeFileSync(`${dir}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
console.log('SEC fixture collected, bytes:',buffer.length,'sha256:',manifest.filings[0].sha256);
