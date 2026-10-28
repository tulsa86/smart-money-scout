import {createHash} from 'node:crypto';
const iso=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&/(Z|[+-]\d\d:\d\d)$/.test(x);
export function appendStockDecisionJournal(rows,{discovery,decision}){
 if(!Array.isArray(rows))throw Error('Journal must be an array');
 if(!discovery||discovery.kind!=='STOCK_DISCOVERY'||!decision||decision.kind!=='PROSPECTIVE_STOCK_DECISION'||!iso(decision.decisionAt)||!iso(discovery.asOf)||decision.sourceAsOf!==discovery.asOf||decision.source!==discovery.source||decision.status!=='DECISION_ONLY_NO_FILL')throw Error('Invalid decision evidence');
 if(Date.parse(decision.decisionAt)<Date.parse(discovery.asOf))throw Error('Decision predates discovery');
 let last='';
 for(const row of rows){if(!iso(row.decisionAt)||row.decisionAt<=last||typeof row.digest!=='string')throw Error('Invalid journal order');last=row.decisionAt}
 if(last&&decision.decisionAt<=last)throw Error('Duplicate or backfilled decision');
 const payload={schemaVersion:1,decisionAt:decision.decisionAt,discovery,decision,executionStatus:'NOT_EXECUTED',pnl:null};
 const digest=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
 return [...rows,{...payload,digest}];
}
