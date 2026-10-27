// Conservative filing ledger: never infer amendment lineage from matching trade fields.
// Only explicit original accession linkage may supersede earlier records.
const accessionOk=x=>typeof x==='string'&&/^\d{10}-\d{2}-\d{6}$/.test(x);
const validRecord=r=>r&&accessionOk(r.accession)&&/^\d+$/.test(String(r.cik??''))&&['4','4/A'].includes(r.formType);
const issuerKey=cik=>String(BigInt(cik));
const filingKey=r=>issuerKey(r.cik)+':'+r.accession;
export function reconcileForm4Filings(filings){
 if(!Array.isArray(filings))throw Error('Expected filings array');
 const byKey=new Map();
 for(const filing of filings){
  if(!filing||!Array.isArray(filing.transactions)||!filing.transactions.every(validRecord))throw Error('Invalid filing transactions');
  if(!accessionOk(filing.accession)||!/^\d+$/.test(String(filing.cik??'')))throw Error('Invalid filing identity');
  if(filing.transactions.some(t=>t.accession!==filing.accession||BigInt(t.cik)!==BigInt(filing.cik)))throw Error('Transaction filing mismatch');
  const key=filingKey(filing);
  if(byKey.has(key))throw Error('Duplicate accession in input');
  byKey.set(key,{...filing,key});
 }
 const superseded=new Set(),unresolved=[],uncertainIssuers=new Set();
 for(const filing of byKey.values()){
  const amendment=filing.transactions.some(t=>t.formType==='4/A')||filing.formType==='4/A';
  if(!amendment)continue;
  const original=filing.amendsAccession;
  if(!accessionOk(original)){uncertainIssuers.add(issuerKey(filing.cik));unresolved.push({accession:filing.accession,reason:'missing_original_accession'});continue}
  const prior=byKey.get(filingKey({...filing,accession:original}));
  if(!prior||prior.accession===filing.accession){uncertainIssuers.add(issuerKey(filing.cik));unresolved.push({accession:filing.accession,reason:'original_not_found'});continue}
  // An amendment can change only selected rows. Without authoritative transaction-level
  // linkage, neither original nor amended transactions are safe to aggregate.
  superseded.add(prior.key);
  unresolved.push({accession:filing.accession,reason:'amendment_requires_transaction_review',originalAccession:original});
 }
 const reported=[],quarantined=[];
 for(const filing of byKey.values()){
  const uncertain=superseded.has(filing.key)||uncertainIssuers.has(issuerKey(filing.cik))||unresolved.some(u=>u.accession===filing.accession);
  for(const t of filing.transactions)(uncertain?quarantined:reported).push({...t,ledgerStatus:uncertain?'requires_reconciliation':'reported_only'});
 }
 return {reported,quarantined,unresolved,supersededAccessions:[...superseded].map(k=>byKey.get(k).accession)};
}
