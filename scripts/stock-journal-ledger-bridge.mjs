// Journal-to-ledger bridge. Does not fetch market data or place broker orders.
import {simulateNextSessionEntry} from './stock-simulated-execution.mjs';
import {parseSimulatedLedger,serializeSimulatedLedger} from './stock-ledger-persistence.mjs';
import {createHash} from 'node:crypto';
export const SIMULATION_ACTIVATION_AT='2026-10-30T00:00:00.000Z'; // Immutable minimum; historical journal predates this boundary.
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function verifyProspectiveJournal(rows){
 if(!Array.isArray(rows))throw Error('Invalid journal');
 let prior=null,last='';
 for(const row of rows){
  if(!row||row.schemaVersion!==2||row.previousDigest!==prior||typeof row.decisionAt!=='string'||row.decisionAt<=last||row.decision?.decisionAt!==row.decisionAt||row.executionStatus!=='NOT_EXECUTED'||row.decision.status!=='DECISION_ONLY_NO_FILL')throw Error('Invalid prospective journal chain or decision');
  const {digest,...payload}=row;
  if(hash(payload)!==digest)throw Error('Prospective journal digest mismatch');
  prior=digest;last=row.decisionAt;
 }
 return rows;
}
export function applyJournalEvidence(ledgerJson,journalJson,evidenceByDigest={}, {activationAt=null, evaluatedAt=null}={}){
 const rows=verifyProspectiveJournal(JSON.parse(journalJson));
 if(activationAt!==null&&(!Number.isFinite(Date.parse(activationAt))||!/(Z|[+-]\d{2}:\d{2})$/.test(activationAt)))throw Error('Invalid activation boundary');
 const effectiveActivationAt=activationAt&&Date.parse(activationAt)>Date.parse(SIMULATION_ACTIVATION_AT)?activationAt:SIMULATION_ACTIVATION_AT;
 if(evaluatedAt!==null&&(!Number.isFinite(Date.parse(evaluatedAt))||!/(Z|[+-]\d{2}:\d{2})$/.test(evaluatedAt)))throw Error('Invalid evaluation time');
 let ledger=parseSimulatedLedger(ledgerJson);
 const outcomes=[];
 ledger.executionOutcomes=ledger.executionOutcomes||[];
 const record=(row,status,detail=null)=>{const event={journalDigest:row.digest,decisionAt:row.decisionAt,status,detail};if(!ledger.executionOutcomes.some(x=>x.journalDigest===row.digest&&x.status===status))ledger.executionOutcomes.push(event);outcomes.push({digest:row.digest,status});};
 for(const row of rows){
  if(Date.parse(row.decisionAt)<Date.parse(effectiveActivationAt)){record(row,'HISTORICAL_DECISION_ONLY');continue;}
  if(ledger.processedDecisions.includes(row.decisionAt)){outcomes.push({digest:row.digest,status:'ALREADY_PROCESSED'});continue;}
  if(row.decision.action==='HOLD'){
   ledger=simulateNextSessionEntry(ledger,row.decision,null);
   outcomes.push({digest:row.digest,status:'HOLD_RECORDED'});
   continue;
  }
  const evidence=evidenceByDigest[row.digest];
  if(!evidence){outcomes.push({digest:row.digest,status:'PENDING_MARKET_EVIDENCE'});continue;}
  // Evidence must explicitly name the immutable journal entry. Never infer fills from a stale reference close.
  if(evidence.journalDigest!==row.digest||evidence.symbol!==row.decision.symbol)throw Error('Evidence source or journal digest mismatch');
  if(!evaluatedAt||typeof evidence.availableAt!=='string'||!/(Z|[+-]\\d{2}:\\d{2})$/.test(evidence.availableAt)||!Number.isFinite(Date.parse(evidence.availableAt))||Date.parse(evidence.availableAt)>Date.parse(evaluatedAt))throw Error('Evidence not available at evaluation time');
  if(evidence.kind==='VERIFIED_NO_FILL'){
   // A missing bar or API failure is NOT evidence of a halt. Require an explicit
   // externally sourced, timestamped market-status attestation for this decision.
   if(evidence.source!=='MARKET_STATUS_ATTESTATION'||!['HALT_OR_LULD','NO_OPEN_SESSION'].includes(evidence.reason)||typeof evidence.sourceRecordId!=='string'||evidence.sourceRecordId.trim().length<8||typeof evidence.sessionAt!=='string'||!/(Z|[+-]\\d{2}:\\d{2})$/.test(evidence.sessionAt)||!Number.isFinite(Date.parse(evidence.sessionAt))||Date.parse(evidence.sessionAt)<=Date.parse(row.decisionAt)||Date.parse(evidence.sessionAt)>Date.parse(evidence.availableAt))throw Error('Invalid verified no-fill attestation');
   ledger={...ledger,processedDecisions:[...ledger.processedDecisions,row.decisionAt]};
   record(row,'NO_FILL_VERIFIED',{reason:evidence.reason,source:evidence.source,sourceRecordId:evidence.sourceRecordId,sessionAt:evidence.sessionAt,availableAt:evidence.availableAt});
   continue;
  }
  if(evidence.kind!==undefined||evidence.source!=='ALPACA_1DAY_IEX')throw Error('Evidence source or journal digest mismatch');
  try{
   const next=simulateNextSessionEntry(ledger,row.decision,{symbol:evidence.symbol,observedAt:evidence.observedAt,availableAt:evidence.availableAt,open:evidence.open});
   ledger={...next,executionOutcomes:ledger.executionOutcomes};
   record(row,'SIMULATED_ENTRY_RECORDED');
  }catch(error){
   if(!/Insufficient cash or allocation limit/.test(error.message))throw error;
   ledger={...ledger,processedDecisions:[...ledger.processedDecisions,row.decisionAt]};
   record(row,'REJECTED_INSUFFICIENT_CASH_AFTER_SLIPPAGE',error.message);
  }
 }
 return {ledgerJson:serializeSimulatedLedger(ledger),outcomes};
}
