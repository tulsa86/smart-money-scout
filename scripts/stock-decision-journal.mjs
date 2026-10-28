import {createHash} from 'node:crypto';
const iso=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&/(Z|[+-]\d\d:\d\d)$/.test(x);
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function appendStockDecisionJournal(rows,{discovery,decision}){
 if(!Array.isArray(rows))throw Error('Journal must be an array');
 if(!discovery||discovery.kind!=='STOCK_DISCOVERY'||!decision||decision.kind!=='PROSPECTIVE_STOCK_DECISION'||!iso(decision.decisionAt)||!iso(discovery.asOf)||decision.sourceAsOf!==discovery.asOf||decision.source!==discovery.source||decision.status!=='DECISION_ONLY_NO_FILL')throw Error('Invalid decision evidence');
 if(Date.parse(decision.decisionAt)<Date.parse(discovery.asOf))throw Error('Decision predates discovery');
 let last='',previousDigest=null;
 for(const row of rows){
  if(!iso(row.decisionAt)||row.decisionAt<=last||typeof row.digest!=='string'||row.previousDigest!==previousDigest)throw Error('Invalid journal order or hash chain');
  const {digest,...payload}=row;
  if(hash(payload)!==digest)throw Error('Journal integrity mismatch');
  last=row.decisionAt;previousDigest=digest;
 }
 if(last&&decision.decisionAt<=last)throw Error('Duplicate or backfilled decision');
 const payload={schemaVersion:2,previousDigest,decisionAt:decision.decisionAt,discovery,decision,executionStatus:'NOT_EXECUTED',pnl:null};
 return [...rows,{...payload,digest:hash(payload)}];
}
