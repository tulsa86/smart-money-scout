// Pure persistence validation: callers explicitly read/write JSON, never submit broker orders.
import {createSimulatedLedger} from './stock-simulated-execution.mjs';
const integer=x=>Number.isSafeInteger(x)&&x>=0;
export function parseSimulatedLedger(json){
 const x=JSON.parse(json);
 if(!x||x.schemaVersion!==1||!integer(x.startingCashCents)||!integer(x.cashCents)||!x.positions||Array.isArray(x.positions)||typeof x.positions!=='object'||!Array.isArray(x.fills)||!Array.isArray(x.processedDecisions)|| (x.executionOutcomes!==undefined&&!Array.isArray(x.executionOutcomes)))throw Error('Invalid persisted simulated ledger');
 if(new Set(x.processedDecisions).size!==x.processedDecisions.length||x.processedDecisions.some(t=>typeof t!=='string'||!Number.isFinite(Date.parse(t))))throw Error('Invalid processed decision IDs');
 if(x.executionOutcomes!==undefined){for(const event of x.executionOutcomes){if(!event||typeof event.journalDigest!=='string'||!/^[a-f0-9]{64}$/.test(event.journalDigest)||typeof event.decisionAt!=='string'||!Number.isFinite(Date.parse(event.decisionAt))||!['HISTORICAL_DECISION_ONLY','NO_FILL_MISSING_EVIDENCE','REJECTED_INSUFFICIENT_CASH_AFTER_SLIPPAGE','SIMULATED_ENTRY_RECORDED'].includes(event.status))throw Error('Invalid persisted execution outcome');}}
 if(x.executionOutcomes!==undefined){
  const terminal=new Set(['HISTORICAL_DECISION_ONLY','NO_FILL_MISSING_EVIDENCE','REJECTED_INSUFFICIENT_CASH_AFTER_SLIPPAGE','SIMULATED_ENTRY_RECORDED']);
  const seen=new Set();
  for(const event of x.executionOutcomes){
   if(seen.has(event.journalDigest))throw Error('Duplicate terminal execution outcome');
   seen.add(event.journalDigest);
   if(!terminal.has(event.status))throw Error('Invalid terminal execution outcome');
   const processed=x.processedDecisions.includes(event.decisionAt);
   if(event.status==='HISTORICAL_DECISION_ONLY'&&processed)throw Error('Historical decision was processed');
   if(['REJECTED_INSUFFICIENT_CASH_AFTER_SLIPPAGE','SIMULATED_ENTRY_RECORDED'].includes(event.status)&&!processed)throw Error('Terminal outcome missing processed decision');
  }
 }
 let spent=0;const reconstructed={};
 const fillDecisions=new Set();
 for(const fill of x.fills){
  if(fill.kind!=='SIMULATED_ENTRY'||fill.simulationOnly!==true||typeof fill.symbol!=='string'||!/^[A-Z]{1,5}(?:[.-][A-Z])?$/.test(fill.symbol)||!integer(fill.shares)||fill.shares===0||!integer(fill.priceCents)||fill.priceCents===0||!integer(fill.costCents)||fill.costCents!==fill.priceCents*fill.shares||!x.processedDecisions.includes(fill.decisionAt))throw Error('Invalid simulated fill');
  if(fillDecisions.has(fill.decisionAt))throw Error('Duplicate fill for decision');
  fillDecisions.add(fill.decisionAt);
  spent+=fill.costCents;
  const p=reconstructed[fill.symbol]||{shares:0,costBasisCents:0};
  reconstructed[fill.symbol]={shares:p.shares+fill.shares,costBasisCents:p.costBasisCents+fill.costCents};
 }
 if(x.executionOutcomes!==undefined){for(const event of x.executionOutcomes){if(event.status==='SIMULATED_ENTRY_RECORDED'&&!fillDecisions.has(event.decisionAt))throw Error('Fill outcome without fill');if(event.status==='REJECTED_INSUFFICIENT_CASH_AFTER_SLIPPAGE'&&fillDecisions.has(event.decisionAt))throw Error('Rejected decision has fill');}}
 if(!Number.isSafeInteger(spent)||x.startingCashCents-spent!==x.cashCents||JSON.stringify(Object.entries(reconstructed).sort())!==JSON.stringify(Object.entries(x.positions).sort()))throw Error('Simulated ledger accounting mismatch');
 return x;
}
export function serializeSimulatedLedger(ledger){
 return JSON.stringify(parseSimulatedLedger(JSON.stringify(ledger)),null,2)+'\n';
}
export function newSimulatedLedgerFile(){return serializeSimulatedLedger(createSimulatedLedger());}
