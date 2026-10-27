// Deterministic Form 4 non-derivative open-market purchase extraction.
// A transaction is a candidate only when code P, acquired A, and complete data agree.
// No HTML scraping, estimates, or inference from grants/derivatives.
const blocks=(xml,tag)=>[...xml.matchAll(new RegExp('<(?:[\\w.-]+:)?'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?'+tag+'>','g'))].map(m=>m[1]);
const value=(xml,tag)=>{const block=blocks(xml,tag)[0];if(block===undefined)return null;const v=blocks(block,'value')[0]??block;return v.replace(/<[^>]*>/g,'').trim()||null;};
const number=(v)=>v!==null&&/^(?:\\d+)(?:\\.\\d+)?$/.test(v)?Number(v):null;
export function extractForm4Purchases(xml,{ticker,cik,accession,filingUrl,filedAt}={}){
 if(typeof xml!=='string'||!xml.includes('ownershipDocument'))throw Error('Not a Form 4 ownership document');
 const form=value(xml,'documentType');
 if(form!=='4'&&form!=='4/A')throw Error('Not a Form 4 filing');
 const issuers=blocks(xml,'issuer');
 const issuerCik=issuers.length?value(issuers[0],'issuerCik'):null;
 if(!issuerCik||String(Number(issuerCik))!==String(Number(cik)))throw Error('Issuer CIK mismatch');
 const owners=blocks(xml,'reportingOwner');
 const ownerNames=owners.map(o=>value(o,'rptOwnerName')).filter(Boolean);
 const output=[];
 for(const table of blocks(xml,'nonDerivativeTable')){
  for(const tx of blocks(table,'nonDerivativeTransaction')){
   const coding=blocks(tx,'transactionCoding')[0]??'';
   const amounts=blocks(tx,'transactionAmounts')[0]??'';
   const code=value(coding,'transactionCode'),acquired=value(amounts,'transactionAcquiredDisposedCode');
   if(code!=='P'||acquired!=='A')continue;
   const shares=number(value(amounts,'transactionShares')),price=number(value(amounts,'transactionPricePerShare'));
   const date=value(blocks(tx,'transactionDate')[0]??'','value');
   if(!shares||price===null||!Number.isFinite(shares*price)||!/^\\d{4}-\\d{2}-\\d{2}$/.test(date??''))continue;
   const amount=shares*price;
   const post=blocks(tx,'postTransactionAmounts')[0]??'';
   output.push({ticker,cik,accession,filingUrl,filedAt,transactionDate:date,ownerNames,shares,pricePerShare:price,reportedPurchaseValue:Math.round(amount*100)/100,sharesOwnedAfter:number(value(post,'sharesOwnedFollowingTransaction')),transactionCode:'P',acquiredDisposedCode:'A',source:'SEC Form 4',note:'Reported open-market acquisition; not independently verified as discretionary or unscheduled'});
  }
 }
 return output;
}
