import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulatedLedger,simulateNextSessionEntry,simulatePositionExit} from './stock-simulated-execution.mjs';
const decision={kind:'PROSPECTIVE_STOCK_DECISION',status:'DECISION_ONLY_NO_FILL',action:'BUY',symbol:'SOFI',shares:12,allocationLimitCents:20000,decisionAt:'2026-10-28T23:07:01.403Z'};
const bar={symbol:'SOFI',observedAt:'2026-10-29T04:00:00Z',availableAt:'2026-10-29T20:45:00Z',open:16.50};
test('simulated entry accounts for cash and shares without broker orders',()=>{
 const initial=createSimulatedLedger();
 const next=simulateNextSessionEntry(initial,decision,bar);
 assert.equal(initial.fills.length,0);
 assert.equal(next.cashCents,80188);
 assert.deepEqual(next.positions.SOFI,{shares:12,costBasisCents:19812});
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

test('5bps slippage rounds to cents and rejects post-slippage cash overflow',()=>{
 const d={...decision,shares:1,allocationLimitCents:10000};
 assert.throws(()=>simulateNextSessionEntry(createSimulatedLedger(10000),d,{...bar,open:100}),/Insufficient cash/);
 const filled=simulateNextSessionEntry(createSimulatedLedger(10005),{...d,allocationLimitCents:10005},{...bar,open:100});
 assert.equal(filled.fills[0].priceCents,10005);
 assert.equal(filled.cashCents,0);
});
test('mark-to-market uses only available close and does not change cash',async()=>{
 const l=simulateNextSessionEntry(createSimulatedLedger(),decision,bar);
 const m={SOFI:{close:16,observedAt:'2026-10-30T04:00:00Z',availableAt:'2026-10-30T21:00:00Z',source:'IEX'}};
 const {markSimulatedPortfolio}=await import('./stock-simulated-execution.mjs');
 const v=markSimulatedPortfolio(l,m,{snapshotTime:'2026-10-30T22:00:00Z'});
 assert.equal(v.totalEquityCents,v.cashCents+v.unrealizedEquityCents);
 assert.equal(v.cashCents,l.cashCents);
 assert.throws(()=>markSimulatedPortfolio(l,m,{snapshotTime:'2026-10-30T20:00:00Z'}),/Unavailable/);
});

test('exit realizes cash, charges sell-side slippage, and preserves original ledger',()=>{
 const entered=simulateNextSessionEntry(createSimulatedLedger(),decision,bar);
 const exitBar={symbol:'SOFI',observedAt:'2026-10-30T20:00:00Z',availableAt:'2026-10-30T20:05:00Z',close:17};
 const closed=simulatePositionExit(entered,{symbol:'SOFI',shares:12,exitBar,snapshotTime:'2026-10-30T20:06:00Z',reason:'SESSION_END'});
 assert.equal(closed.fills.at(-1).priceCents,1699);
 assert.equal(closed.fills.at(-1).proceedsCents,20388);
 assert.equal(closed.fills.at(-1).realizedPnlCents,576);
 assert.equal(closed.cashCents,100576);
 assert.deepEqual(closed.positions,{});
 assert.equal(entered.cashCents,80188);
 assert.equal(entered.fills.length,1);
 assert.equal(closed.cashCents,closed.startingCashCents+closed.fills.at(-1).realizedPnlCents);
 assert.throws(()=>simulatePositionExit(closed,{symbol:'SOFI',shares:1,exitBar,snapshotTime:'2026-10-30T20:06:00Z'}),/Invalid exit position/);
});
test('exit refuses future prices and same-observation duplicate closes',()=>{
 const entered=simulateNextSessionEntry(createSimulatedLedger(),decision,bar);
 const exitBar={symbol:'SOFI',observedAt:'2026-10-30T20:00:00Z',availableAt:'2026-10-30T20:05:00Z',close:17};
 assert.throws(()=>simulatePositionExit(entered,{symbol:'SOFI',shares:12,exitBar,snapshotTime:'2026-10-30T20:04:00Z'}),/not available/);
 assert.throws(()=>simulatePositionExit(entered,{symbol:'SOFI',shares:12,exitBar:{...exitBar,observedAt:'2026-10-29T20:00:00Z'},snapshotTime:'2026-10-30T20:06:00Z'}),/follow available entry/);
 const partial=simulatePositionExit(entered,{symbol:'SOFI',shares:6,exitBar,snapshotTime:'2026-10-30T20:06:00Z'});
 assert.deepEqual(partial.positions.SOFI,{shares:6,costBasisCents:9906});
 assert.throws(()=>simulatePositionExit(partial,{symbol:'SOFI',shares:6,exitBar,snapshotTime:'2026-10-30T20:07:00Z'}),/Duplicate exit/);
});
