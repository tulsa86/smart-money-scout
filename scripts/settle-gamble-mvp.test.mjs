import test from 'node:test';
import assert from 'node:assert/strict';
import {appendGambleDecision} from './gamble-decision-journal.mjs';
import {newMvpLedger} from './gamble-mvp-ledger.mjs';
import {settleMvp,validateSettlement} from './settle-gamble-mvp.mjs';
const targetSession='2026-11-05',now='2026-11-06T03:00:00Z';
function journal(action='SKIP'){
 return appendGambleDecision([],{mode:'selective',targetSession,recordedAt:'2026-11-04T20:00:00Z',snapshot:{asOf:'2026-11-04T19:59:00Z',source:'test evidence',candidates:[{symbol:'SPY'}]},action,symbol:action==='BUY_INTENT'?'SPY':null,ruleVersion:'gamble-mvp-v1',reason:'test'});
}
test('settlement refuses missing pre-session decision and same-day settlement',()=>{
 assert.throws(()=>validateSettlement({targetSession,now,journal:[],ledger:newMvpLedger()}),/precommitted/);
 assert.throws(()=>validateSettlement({targetSession,now:'2026-11-05T21:00:00Z',journal:journal(),ledger:newMvpLedger()}),/next New York day/);
});
test('SKIP settles without data or orders, reruns idempotently',async()=>{
 const rows=journal(),first=await settleMvp({targetSession,now,journal:rows,ledger:newMvpLedger(),fetchEvidence:()=>{throw Error('should not fetch')}});
 assert.equal(first.ledger.sessions[0].status,'SKIP');
 assert.equal(first.ledger.cashCents,100000);
 const repeat=await settleMvp({targetSession,now,journal:rows,ledger:first.ledger});
 assert.equal(repeat.alreadyRecorded,true);
});
test('BUY_INTENT uses completed evidence and never sends orders',async()=>{
 const rows=journal('BUY_INTENT');
 const result=await settleMvp({targetSession,now,journal:rows,ledger:newMvpLedger(),key:'k',secret:'s',fetchEvidence:async()=>({symbol:'SPY',targetSession,openObservedAt:'2026-11-05T14:30:00Z',closeObservedAt:'2026-11-05T20:55:00Z',availableAt:now,open:100,close:101})});
 assert.equal(result.ledger.sessions[0].status,'SIMULATED_ROUND_TRIP');
 assert.equal(result.ledger.sessions[0].shares,2);
 assert.equal(result.ledger.sessions[0].simulationOnly,true);
});
