// Pure persistence validation: callers explicitly read/write JSON, never submit broker orders.
import {createSimulatedLedger} from './stock-simulated-execution.mjs';
const integer=x=>Number.isSafeInteger(x)&&x>=0;
export function parseSimulatedLedger(json){
 const x=JSON.parse(json);
 if(!x||x.schemaVersion!==1||!integer(x.startingCashCents)||!integer(x.cashCents)||!x.positions||Array.isArray(x.positions)||typeof x.positions!=='object'||!Array.isArray(x.fills)||!Array.isArray(x.processedDecisions))throw Error('Invalid persisted simulated ledger');
 if(new Set(x.processedDecisions).size!==x.processedDecisions.length||x.processedDecisions.some(t=>typeof t!=='string'||!Number.isFinite(Date.parse(t))))throw Error('Invalid processed decision IDs');
 let spent=0;const reconstructed={};
 for(const fill of x.fills){
  if(fill.kind!=='SIMULATED_ENTRY'||fill.simulationOnly!==true||typeof fill.symbol!=='string'||!/^[A-Z]{1,5}(?:[.-][A-Z])?$/.test(fill.symbol)||!integer(fill.shares)||fill.shares===0||!integer(fill.priceCents)||fill.priceCents===0||!integer(fill.costCents)||fill.costCents!==fill.priceCents*fill.shares||!x.processedDecisions.includes(fill.decisionAt))throw Error('Invalid simulated fill');
  spent+=fill.costCents;
  const p=reconstructed[fill.symbol]||{shares:0,costBasisCents:0};
  reconstructed[fill.symbol]={shares:p.shares+fill.shares,costBasisCents:p.costBasisCents+fill.costCents};
 }
 if(!Number.isSafeInteger(spent)||x.startingCashCents-spent!==x.cashCents||JSON.stringify(Object.entries(reconstructed).sort())!==JSON.stringify(Object.entries(x.positions).sort()))throw Error('Simulated ledger accounting mismatch');
 return x;
}
export function serializeSimulatedLedger(ledger){
 return JSON.stringify(parseSimulatedLedger(JSON.stringify(ledger)),null,2)+'\n';
}
export function newSimulatedLedgerFile(){return serializeSimulatedLedger(createSimulatedLedger());}
