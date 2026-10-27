import {parseOwnershipXml,val} from './form4-xml.mjs';
import {extractForm4Purchases} from './form4-core.mjs';
import {indexRecentOwnershipFilings} from './sec-ownership-index.mjs';
// Explicit, bounded SEC retrieval. Caller supplies a truthful contact User-Agent.
// No automatic retries or concurrent requests. An HTML primary document is never parsed as XML.
const MAX_BYTES=5_000_000;
const allowedUrl=url=>{
 const u=new URL(url);
 const archive=u.hostname==='www.sec.gov'&&/^\/Archives\/edgar\/data\/\d+\/\d+\/[\w./-]+$/.test(u.pathname);
 const submissions=u.hostname==='data.sec.gov'&&/^\/submissions\/CIK\d{10}\.json$/.test(u.pathname);
 if(u.protocol!=='https:'||(!archive&&!submissions)||u.pathname.split('/').includes('..')||u.search||u.hash)throw Error('Unsafe SEC URL');
 return u.href;
};
export async function fetchSecText(url,{fetchImpl=fetch,userAgent,signal}={}){
 if(typeof userAgent!=='string'||!/.+@.+\..+/.test(userAgent)||userAgent.length>200)throw Error('SEC contact User-Agent required');
 const safe=allowedUrl(url);
 const response=await fetchImpl(safe,{headers:{'User-Agent':userAgent,'Accept':'application/xml,text/xml,application/json,text/plain'},redirect:'error',signal});
 if(!response.ok)throw Error('SEC HTTP '+response.status);
 const size=Number(response.headers?.get?.('content-length'));
 if(Number.isFinite(size)&&size>MAX_BYTES)throw Error('SEC response too large');
 if(!response.body?.getReader){const text=await response.text();if(Buffer.byteLength(text,'utf8')>MAX_BYTES)throw Error('SEC response too large');return text;}
 const reader=response.body.getReader(),chunks=[];let total=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_BYTES)throw Error('SEC response too large');chunks.push(value)}}finally{reader.releaseLock()}
 return Buffer.concat(chunks.map(x=>Buffer.from(x)),total).toString('utf8');
}
export async function fetchRecentOwnershipFilings(cik,{fetchImpl=fetch,userAgent,signal,limit=100}={}){
 if(!/^\d{1,10}$/.test(String(cik??''))||BigInt(cik)===0n)throw Error('Invalid issuer CIK');
 const padded=String(cik).padStart(10,'0');
 const url='https://data.sec.gov/submissions/CIK'+padded+'.json';
 const submissions=JSON.parse(await fetchSecText(url,{fetchImpl,userAgent,signal}));
 if(BigInt(submissions.cik)!==BigInt(cik))throw Error('SEC submissions issuer CIK mismatch');
 return indexRecentOwnershipFilings(submissions,{limit});
}
export function selectOwnershipXml(index){
 const items=index?.directory?.item;
 if(!Array.isArray(items))throw Error('Invalid SEC archive index');
 const candidates=items.filter(i=>typeof i?.name==='string'&&/^[\w.-]+\.xml$/i.test(i.name)&&!/^(?:index|filing-summary|metadata)\.xml$/i.test(i.name));
 if(candidates.length!==1)throw Error('Ownership XML requires manual selection');
 return candidates[0].name;
}
export async function retrieveForm4Candidate(filing,{fetchImpl=fetch,userAgent,signal}={}){
 if(!filing||!['4','4/A'].includes(filing.formType)||!filing.filingIndexUrl||!filing.primaryDocumentUrl)throw Error('Invalid indexed Form 4');
 const indexUrl=allowedUrl(filing.filingIndexUrl+'index.json');
 const index=JSON.parse(await fetchSecText(indexUrl,{fetchImpl,userAgent,signal}));
 const xmlName=selectOwnershipXml(index);
 const xmlUrl=allowedUrl(filing.filingIndexUrl+xmlName);
 const xml=await fetchSecText(xmlUrl,{fetchImpl,userAgent,signal});
 const actualForm=val(parseOwnershipXml(xml),'documentType');
 if(actualForm!==filing.formType)throw Error('Indexed filing type mismatch');
 const transactions=extractForm4Purchases(xml,{ticker:filing.ticker,cik:filing.cik,accession:filing.accession,filingUrl:xmlUrl});
 if(transactions.some(t=>t.formType!==filing.formType))throw Error('Indexed filing type mismatch');
 return {accession:filing.accession,cik:filing.cik,formType:filing.formType,filingDate:filing.filingDate,acceptanceTime:filing.acceptanceTime??null,acceptanceTimezone:filing.acceptanceTimezone??null,sourceUrl:xmlUrl,transactions,validationStatus:'parsed_not_reconciled'};
}
