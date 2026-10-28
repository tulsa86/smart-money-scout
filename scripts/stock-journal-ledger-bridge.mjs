// Journal-to-ledger bridge. Does not fetch market data or place broker orders.
import {simulateNextSessionEntry} from './stock-simulated-execution.mjs';
import {parseSimulatedLedger,serializeSimulatedLedger} from './stock-ledger-persistence.mjs';
import {createHash} from 'node:crypto';
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
export function applyJournalEvidence(ledgerJson,journalJson,evidenceByDigest={}){
 const rows=verifyProspectiveJournal(JSON.parse(journalJson));
 let ledger=parseSimulatedLedger(ledgerJson);
 const outcomes=[];
 for(const row of rows){
  if(ledger.processedDecisions.includes(row.decisionAt)){outcomes.push({digest:row.digest,status:'ALREADY_PROCESSED'});continue;}
  if(row.decision.action==='HOLD'){
   ledger=simulateNextSessionEntry(ledger,row.decision,null);
   outcomes.push({digest:row.digest,status:'HOLD_RECORDED'});
   continue;
  }
  const evidence=evidenceByDigest[row.digest];
  if(!evidence){outcomes.push({digest:row.digest,status:'AWAITING_VERIFIED_MARKET_EVIDENCE'});continue;}
  // Evidence must explicitly name the immutable journal entry. Never infer fills from a stale reference close.
  if(evidence.journalDigest!==row.digest||evidence.symbol!==row.decision.symbol||evidence.source!=='ALPACA_1DAY_IES'&&evidence.source!=='ALPACA_1DAY_IEX')throw Error('Evidence source or journal digest mismatch');
  const next=simulateNextSessionEntry(ledger,row.decision,{symbol:evidence.symbol,observedAt:evidence.observedAt,availableAt:evidence.availableAt,open:evidence.open});
  ledger=next;
  outcomes.push({digest:row.digest,status:'SIMULATED_ENTRY_RECORDED'});
 }
 return {ledgerJson:serializeSimulatedLedger(ledger),outcomes};
}
