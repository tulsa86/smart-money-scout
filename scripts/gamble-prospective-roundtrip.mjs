// Offline-only prospective Gamble Zone round-trip orchestration.
// This module does not fetch prices, schedule jobs, or place orders.
import {createSimulatedLedger,simulateNextSessionEntry,simulatePositionExit,markSimulatedPortfolio} from './stock-simulated-execution.mjs';
export const MODES=Object.freeze(['forced-daily','selective']);
export function createGambleAccounts(){
 return Object.fromEntries(MODES.map(mode=>[mode,createSimulatedLedger(100000)]));
}
export function processGambleSession(accounts,inputs,{snapshotTime}={}){
 if(!accounts||!inputs||typeof inputs!=='object')throw Error('Invalid Gamble Zone inputs');
 const next={...accounts},results={};
 for(const mode of MODES){
  const ledger=accounts[mode],item=inputs[mode];
  if(!ledger||!item||!['BUY','HOLD'].includes(item.decision?.action))throw Error('Missing mode decision or ledger: '+mode);
  let updated=simulateNextSessionEntry(ledger,item.decision,item.openingBar??null);
  if(item.decision.action==='BUY'){
   if(!item.exitBar)throw Error('Missing exit evidence for '+mode);
   updated=simulatePositionExit(updated,{symbol:item.decision.symbol,shares:item.decision.shares,exitBar:item.exitBar,snapshotTime,reason:'SESSION_END'});
  }
  const valuation=markSimulatedPortfolio(updated,{}, {snapshotTime});
  next[mode]=updated;
  results[mode]={cashCents:valuation.cashCents,totalEquityCents:valuation.totalEquityCents,realizedPnlCents:updated.fills.filter(f=>f.kind==='SIMULATED_EXIT').reduce((n,f)=>n+f.realizedPnlCents,0),fillCount:updated.fills.length};
 }
 return {accounts:next,results,simulationOnly:true};
}
