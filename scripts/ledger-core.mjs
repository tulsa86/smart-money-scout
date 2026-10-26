export const INITIAL_CASH_CENTS=100000;
export const STATUSES=new Set(['TRADE_EXECUTED','QUALIFIED_NO_TRADE','NO_CANDIDATE','INSUFFICIENT_DATA','PIPELINE_OUTAGE']);
export function validateLedger(rows){
 if(!Array.isArray(rows))throw new Error('Ledger must be an array');
 let priorDay='',cash=INITIAL_CASH_CENTS;
 for(const r of rows){
  if(!r||typeof r.day!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(r.day)||r.day<=priorDay)throw new Error('Invalid or duplicate session date');
  if(!STATUSES.has(r.status))throw new Error('Invalid session status: '+r.status);
  if(!Number.isInteger(r.startingCashCents)||!Number.isInteger(r.endingCashCents)||!Number.isInteger(r.pnlCents))throw new Error('Cash values must be integer cents');
  if(r.startingCashCents!==cash||r.endingCashCents!==cash+r.pnlCents)throw new Error('Ledger cash continuity broken: '+r.day);
  if(['PIPELINE_OUTAGE','INSUFFICIENT_DATA','NO_CANDIDATE','QUALIFIED_NO_TRADE'].includes(r.status)&&(r.pnlCents!==0||r.trades?.length))throw new Error('Nontrade session contains trading activity');
  if(r.status==='TRADE_EXECUTED'&&(!Array.isArray(r.trades)||!r.trades.length))throw new Error('Executed status requires trades');
  cash=r.endingCashCents;priorDay=r.day;
 }
 return cash;
}
export function appendSession(rows,record){
 validateLedger(rows);
 if(rows.some(r=>r.day===record.day))throw new Error('Session already recorded: '+record.day);
 if(rows.length&&record.day<=rows.at(-1).day)throw new Error('Cannot backfill prospective sessions');
 const next=[...rows,record];validateLedger(next);return next;
}
