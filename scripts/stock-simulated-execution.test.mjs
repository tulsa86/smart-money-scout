import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulatedLedger,simulateNextSessionEntry} from './stock-simulated-execution.mjs';
const decision={kind:'PROSPECTIVE_STOCK_DECISION',status:'DECISION_ONLY_NO_FILL',action:'BUY',symbol:'SOFI',shares:12,allocationLimitCents:20000,decisionAt:'2026-10-28T23:07:01.403Z'};
const bar={symbol:'SOFI',observedAt:'2026-10-29T04:00:00Z',availableAt:'2026-10-29T20:45:00Z',open:16.50};
test('simulated entry accounts for cash and shares without broker orders',()=>{
 const initial=createSimulatedLedger();
 const next=simulateNextSessionEntry(initial,decision,bar);
 assert.equal(initial.fills.length,0);
 assert.equal(next.cashCents,80200);
 assert.deepEqual(next.positions.SOFI,{shares:12,costBasisCents:19800});
 assert.equal(next.fills[0].simulationOnly,true);
 assert.throws(()=>simulateNextSessionEntry(next,decision,bar),/already processed/);
});
test('rejects same-session fills, unavailable prices and opening gaps beyond allocation',()=>{
 assert.throws(()=>simulateNextSessionEntry(createSimulatedLedger(),decision,{...bar,observedAt:'2026-10-28T04:00:00Z'}),/follow decision/);
 assert.throws(()=>simulateNextSessionEntry(createSimulatedLedger(),decision,{...bar,availableAt:'2026-10-28T20:00:00Z'}),/availability/);
 assert.throws(()=>simulateNextSessionEntry(createSimulatedLedger(),decision,{...bar,open:20}),/allocation/);
});
test('hold does not change cash or create fills',()=>{
 const next=simulateNextSessionEntry(createSimulatedLedger(),{...decision,action:'HOLD'},null);
 assert.equal(next.cashCents,100000);
 assert.equal(next.fills.length,0);
});
