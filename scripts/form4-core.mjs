import {parseOwnershipXml,children,first,val} from './form4-xml.mjs';
// SEC Form 4 Table I reported purchase candidates, NOT investment signals.
const numeric=v=>v!==null&&/^\d+(?:\.\d+)?$/.test(v)?Number(v):null;
const dateOk=v=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T00:00:00Z');return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===v};
const common=v=>typeof v==='string'&&/\b(common stock|common shares|ordinary shares|class [a-z] common|class [a-z] ordinary)\b/i.test(v);
const text=node=>node?.text?.trim()||null;
export function extractForm4Purchases(xml,{ticker,cik,accession,filingUrl,filedAt}={}){
 const root=parseOwnershipXml(xml);
 const form=val(root,'documentType');
 if(form!=='4'&&form!=='4/A')throw Error('Not a Form 4 filing');
 const issuerCik=val(first(root,'issuer'),'issuerCik');
 if(!issuerCik||!/^\d+$/.test(issuerCik)||!/^\d+$/.test(String(cik??''))||BigInt(issuerCik)!==BigInt(cik))throw Error('Issuer CIK mismatch');
 const owners=children(root,'reportingOwner');
 const ownerNames=owners.map(o=>val(first(o,'reportingOwnerId'),'rptOwnerName')).filter(Boolean);
 const ownerCiks=owners.map(o=>val(first(o,'reportingOwnerId'),'rptOwnerCik')).filter(Boolean);
 const footnotes=children(first(root,'footnotes'),'footnote').map(n=>text(n)).filter(Boolean);
 const output=[];
 for(const table of children(root,'nonDerivativeTable')){
  for(const tx of children(table,'nonDerivativeTransaction')){
   const coding=first(tx,'transactionCoding'),amounts=first(tx,'transactionAmounts');
   if(val(coding,'transactionCode')!=='P'||val(amounts,'transactionAcquiredDisposedCode')!=='A')continue;
   const securityTitle=val(tx,'securityTitle');
   if(!common(securityTitle))continue;
   const shares=numeric(val(amounts,'transactionShares')),price=numeric(val(amounts,'transactionPricePerShare'));
   const date=val(tx,'transactionDate');
   if(shares===null||shares<=0||price===null||price<=0||!Number.isFinite(shares*price)||!dateOk(date))continue;
   const flag=val(coding,'aff10b5One')??val(tx,'aff10b5One')??val(root,'aff10b5One')??val(coding,'affirmative10b5Flag')??val(tx,'affirmative10b5Flag')??val(root,'affirmative10b5Flag');
   const explicit=flag==='1'||flag==='true'?'yes':flag==='0'||flag==='false'?'no':'unknown';
   const possiblePlanReference=footnotes.some(s=>/10b5[\s-]?1|rule\s*10b5|pre.arranged/i.test(s));
   const rule10b5_1=explicit==='yes'?'yes':possiblePlanReference?'requires_review':explicit;
   output.push({ticker,cik,accession,filingUrl,filedAt,formType:form,transactionDate:date,ownerNames,ownerCiks,securityTitle,shares,pricePerShare:price,reportedPurchaseValue:Math.round(shares*price*100)/100,sharesOwnedAfter:numeric(val(first(tx,'postTransactionAmounts'),'sharesOwnedFollowingTransaction')),transactionCode:'P',acquiredDisposedCode:'A',rule10b5_1,amendmentStatus:form==='4/A'?'requires_reconciliation':'original',classification:'reported_purchase_candidate',source:'SEC Form 4',note:'Table I reported common-equity purchase candidate. Code P may include private purchases; no investment implication. Amendments require reconciliation.'});
  }
 }
 return output;
}
