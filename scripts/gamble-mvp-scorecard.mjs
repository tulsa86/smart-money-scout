// Read-only Gamble MVP report. A missing result is never silently treated as a SKIP.
export function summarizeGambleMvp({ledger,eligibleSessions,decisions=[]}){
 if(!ledger||ledger.kind!=='GAMBLE_MVP_LEDGER'||!Array.isArray(ledger.sessions)||!Array.isArray(eligibleSessions)||new Set(eligibleSessions).size!==eligibleSessions.length||eligibleSessions.length>30)throw Error('Invalid report inputs');
 const byDay=new Map(ledger.sessions.map(s=>[s.targetSession,s]));
 const decisionDays=new Set(decisions.filter(d=>d.mode==='selective'&&d.ruleVersion==='gamble-mvp-v1').map(d=>d.targetSession));
 const rows=eligibleSessions.map(date=>{
  const s=byDay.get(date);
  const status=s?.status??(decisionDays.has(date)?'UNSETTLED':'MISSING_DECISION');
  const valid=status==='SIMULATED_ROUND_TRIP'||status==='SKIP';
  return {date,status,valid,pnlCents:s?.pnlCents??null};
 });
 const trades=rows.filter(r=>r.status==='SIMULATED_ROUND_TRIP');
 const validSessions=rows.filter(r=>r.valid).length;
 const total=eligibleSessions.length;
 const complete=total===30;
 const finalCashCents=ledger.cashCents;
 const netPnlCents=finalCashCents-ledger.startingCashCents;
 return {complete,eligibleCount:total,validSessions,coverage:total?validSessions/total:0,operationalGate:complete?(validSessions>=29?'PASS':'FAIL'):'PENDING',trades:trades.length,skips:rows.filter(r=>r.status==='SKIP').length,netPnlCents,accountReturnPct:netPnlCents/ledger.startingCashCents*100,rows};
}
