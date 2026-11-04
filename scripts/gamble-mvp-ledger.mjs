// Prospective, offline-only single-account MVP. No broker orders.
import {verifyGambleDecisionJournal} from './gamble-decision-journal.mjs';
const day=x=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(x));
const valid=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&/(Z|[+-]\d\d:\d\d)$/.test(x);
export const newMvpLedger=()=>({schemaVersion:1,kind:'GAMBLE_MVP_LEDGER',startingCashCents:100000,cashCents:100000,sessions:[]});
export function applyMvpSession(ledger,journal,{targetSession,evidence=null,recordedAt,slippageBps=5}={}){
 verifyGambleDecisionJournal(journal);
 if(ledger?.kind!=='GAMBLE_MVP_LEDGER'||ledger.schemaVersion!==1||!Array.isArray(ledger.sessions)||!Number.isSafeInteger(ledger.cashCents)||ledger.cashCents<0||!valid(recordedAt)||!Number.isInteger(slippageBps)||slippageBps<0||slippageBps>=10000||!/^\d{4}-\d{2}-\d{2}$/.test(targetSession))throw Error('Invalid ledger or recording inputs');
 if(ledger.sessions.some(s=>s.targetSession===targetSession)||ledger.sessions.length&&targetSession<=ledger.sessions.at(-1).targetSession)throw Error('Duplicate or backfilled session');
 const rows=journal.filter(r=>r.mode==='selective'&&r.targetSession===targetSession&&r.ruleVersion==='gamble-mvp-v1');
 if(rows.length!==1)throw Error('Missing unique frozen MVP decision');
 const d=rows[0];
 if(Date.parse(recordedAt)<=Date.parse(d.recordedAt)||day(d.recordedAt)>=targetSession)throw Error('Invalid decision timing');
 let status=d.action==='SKIP'?'SKIP':'MISSING_EVIDENCE',shares=0,entryPriceCents=null,exitPriceCents=null,pnlCents=0;
 if(d.action==='BUY_INTENT'&&evidence){
  if(evidence.symbol!==d.symbol||evidence.targetSession!==targetSession||!valid(evidence.openObservedAt)||!valid(evidence.closeObservedAt)||!valid(evidence.availableAt)||day(evidence.openObservedAt)!==targetSession||day(evidence.closeObservedAt)!==targetSession||Date.parse(evidence.openObservedAt)>=Date.parse(evidence.closeObservedAt)||Date.parse(evidence.availableAt)<Date.parse(evidence.closeObservedAt)||Date.parse(evidence.availableAt)>Date.parse(recordedAt)||!Number.isFinite(evidence.open)||evidence.open<=0||!Number.isFinite(evidence.close)||evidence.close<=0)throw Error('Invalid or unavailable session evidence');
  entryPriceCents=Math.round(evidence.open*(1+slippageBps/10000)*100);
  exitPriceCents=Math.round(evidence.close*(1-slippageBps/10000)*100);
  if(entryPriceCents<=0||exitPriceCents<=0)throw Error('Invalid fill price');
  shares=Math.floor(Math.min(25000,ledger.cashCents)/entryPriceCents);
  if(!shares)status='SKIP_UNAFFORDABLE';
  else{pnlCents=shares*(exitPriceCents-entryPriceCents);status='SIMULATED_ROUND_TRIP';}
 }
 const cashCents=ledger.cashCents+pnlCents;
 if(!Number.isSafeInteger(cashCents)||cashCents<0)throw Error('Accounting overflow');
 return {...ledger,cashCents,sessions:[...ledger.sessions,{targetSession,decisionDigest:d.digest,recordedAt,status,symbol:d.symbol,shares,entryPriceCents,exitPriceCents,pnlCents,cashCents,slippageBps,simulationOnly:true}]};
}

export function applyMvpSessionIdempotent(ledger,journal,input){
 const existing=ledger?.sessions?.find(s=>s.targetSession===input?.targetSession);
 if(existing){
  verifyGambleDecisionJournal(journal);
  const row=journal.find(r=>r.mode==='selective'&&r.targetSession===input.targetSession&&r.ruleVersion==='gamble-mvp-v1');
  if(!row||row.digest!==existing.decisionDigest)throw Error('Conflicting rerun decision');
  if(input.slippageBps!==undefined&&input.slippageBps!==existing.slippageBps)throw Error('Conflicting rerun slippage');
  if(input.evidence&&existing.status!=='SIMULATED_ROUND_TRIP'&&existing.status!=='SKIP_UNAFFORDABLE')throw Error('Cannot silently replace recorded outcome');
  return {ledger,alreadyRecorded:true};
 }
 return {ledger:applyMvpSession(ledger,journal,input),alreadyRecorded:false};
}
