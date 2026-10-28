// Conservative SEC Form 4/A reconciliation. No automatic fuzzy matching or deletions.
// Entries are research candidates, never investment signals.
const accessionOk = s => typeof s==='string' && /^\d{10}-\d{2}-\d{6}$/.test(s);
const filingOk = f => f && accessionOk(f.accession) && ['4','4/A'].includes(f.formType) && Array.isArray(f.transactions);
const key = f => f.accession;
export function reconcileForm4Filings(filings,{verifiedLinks={}}={}){
 if(!Array.isArray(filings)||!filings.every(filingOk))throw Error('Invalid Form 4 filing records');
 const byAccession=new Map();
 for(const filing of filings){
  if(byAccession.has(key(filing)))throw Error('Duplicate SEC accession');
  byAccession.set(key(filing),filing);
 }
 const superseded=new Map();
 const review=[];
 for(const filing of filings){
  if(filing.formType!=='4/A')continue;
  const original=verifiedLinks[filing.accession];
  if(!original){
   review.push({accession:filing.accession,reason:'amendment_link_unverified'});
   continue;
  }
  if(!accessionOk(original)||original===filing.accession||!byAccession.has(original)){
   review.push({accession:filing.accession,reason:'linked_original_missing_or_invalid'});
   continue;
  }
  const prior=byAccession.get(original);
  if(prior.formType!=='4'||prior.issuerCik!==filing.issuerCik){
   review.push({accession:filing.accession,reason:'linked_original_incompatible'});
   continue;
  }
  if(superseded.has(original)){
   review.push({accession:filing.accession,reason:'conflicting_amendment_links'});
   continue;
  }
  superseded.set(original,filing.accession);
 }
 const records=filings.map(filing=>{
  const replacement=superseded.get(filing.accession);
  const isAmendment=filing.formType==='4/A';
  const linkedOriginal=verifiedLinks[filing.accession];
  const verified=isAmendment&&linkedOriginal&&superseded.get(linkedOriginal)===filing.accession;
  return {...filing,status:replacement?'SUPERSEDED_BY_AMENDMENT':isAmendment?(verified?'ACTIVE_AMENDED':'REQUIRES_REVIEW'):'ACTIVE',supersededBy:replacement??null};
 });
 // Do not count unlinked amendments. Keep original active until lineage is verified.
 const countable=records.filter(r=>r.status==='ACTIVE'||r.status==='ACTIVE_AMENDED');
 return {records,review,countableTransactions:countable.flatMap(r=>r.transactions.map(tx=>({...tx,accession:r.accession})))};
}
