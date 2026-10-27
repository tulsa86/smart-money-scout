// Conservative Form 4 Table I purchase-candidate extraction.
// Candidate != discretionary trade, exchange purchase, or investment signal.
// For production ingestion replace this minimal XML reader with a schema-aware parser.
const blocks=(xml,tag)=>[...xml.matchAll(new RegExp('<(?:[\\w.-]+:)?'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?'+tag+'>','g'))].map(m=>m[1]);
const value=(xml,tag)=>{const b=blocks(xml,tag)[0];if(b===undefined)return null;return (blocks(b,'value')[0]??b).replace(/<[^>]*>/g,'').trim()||null;};
const numeric=v=>v!==null&&/^\d+(?:\.\d+)?$/.test(v)?Number(v):null;
const dateOk=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T00:00:00Z'));
const common=v=>typeof v==='string'&&/\b(common stock|common shares|ordinary shares|class [a-z] common|class [a-z] ordinary)\b/i.test(v);
export function extractForm4Purchases(xml,{ticker,cik,accession,filingUrl,filedAt}={}){
 if(typeof xml!=='string'||!/<ownershipDocument(?:\s|>)/.test(xml))throw Error('Not a Form 4 ownership document');
 const form=value(xml,'documentType');
 if(form!=='4'&&form!=='4/A')throw Error('Not a Form 4 filing');
 const issuer=blocks(xml,'issuer')[0],issuerCik=issuer?value(issuer,'issuerCik'):null;
 if(!issuerCik||!/^\d+$/.test(issuerCik)||!/^\d+$/.test(String(cik??''))||BigInt(issuerCik)!==BigInt(cik))throw Error('Issuer CIK mismatch');
 const owners=blocks(xml,'reportingOwner');
 const ownerNames=owners.map(o=>value(o,'rptOwnerName')).filter(Boolean);
 const ownerCiks=owners.map(o=>value(o,'rptOwnerCik')).filter(Boolean);
 const output=[];
 for(const table of blocks(xml,'nonDerivativeTable')){
  for(const tx of blocks(table,'nonDerivativeTransaction')){
   const coding=blocks(tx,'transactionCoding')[0]??'';
   const amounts=blocks(tx,'transactionAmounts')[0]??'';
   if(value(coding,'transactionCode')!=='P'||value(amounts,'transactionAcquiredDisposedCode')!=='A')continue;
   const securityTitle=value(blocks(tx,'securityTitle')[0]??'','value');
   if(!common(securityTitle))continue;
   const shares=numeric(value(amounts,'transactionShares')),price=numeric(value(amounts,'transactionPricePerShare'));
   const date=value(blocks(tx,'transactionDate')[0]??'','value');
   if(shares===null||shares<=0||price===null||price<=0||!Number.isFinite(shares*price)||!dateOk(date))continue;
   const post=blocks(tx,'postTransactionAmounts')[0]??'';
   const planFlag=value(tx,'aff10b5One')??value(xml,'aff10b5One');
   const rule10b5_1=planFlag==='1'||planFlag==='true'?'yes':planFlag==='0'||planFlag==='false'?'no':'unknown';
   output.push({ticker,cik,accession,filingUrl,filedAt,formType:form,transactionDate:date,ownerNames,ownerCiks,securityTitle,shares,pricePerShare:price,reportedPurchaseValue:Math.round(shares*price*100)/100,sharesOwnedAfter:numeric(value(post,'sharesOwnedFollowingTransaction')),transactionCode:'P',acquiredDisposedCode:'A',rule10b5_1,amendmentStatus:form==='4/A'?'requires_reconciliation':'original',classification:'reported_purchase_candidate',source:'SEC Form 4',note:'Table I reported common-equity purchase candidate. Code P may include private purchases. Footnotes and amendment lineage require review.'});
  }
 }
 return output;
}
