import test from 'node:test';
import assert from 'node:assert/strict';
import {planGamblePresession} from './gamble-presession-planner.mjs';
import {verifyGambleDecisionJournal} from './gamble-decision-journal.mjs';
const base={targetSession:'2026-11-02',recordedAt:'2026-10-30T21:00:00Z',source:'Alpaca IEX completed prior-session bars',sourceFetchedAt:'2026-10-30T20:45:00Z',observations:[{symbol:'AMD',sessionCloseAt:'2026-10-30T19:55:00Z',availableAt:'2026-10-30T20:20:00Z',open:100,close:103,volume:120000,meanPriorVolume:100000},{symbol:'SPY',sessionCloseAt:'2026-10-30T19:55:00Z',availableAt:'2026-10-30T20:20:00Z',open:500,close:495,volume:90000,meanPriorVolume:100000}]};
test('same evidence creates independent forced and selective pre-session decisions',()=>{
 const journal=planGamblePresession([] ,base);
 assert.equal(verifyGambleDecisionJournal(journal).length,2);
 assert.deepEqual(journal.map(r=>r.mode),['forced-daily','selective']);
 assert.deepEqual(journal.map(r=>r.symbol),['AMD','AMD']);
 assert.equal(journal[0].bankrollCents,100000);
 assert.equal(journal[1].previousDigest,journal[0].digest);
});
test('forced fallback does not silently turn into selective trade',()=>{
 const journal=planGamblePresession([],{...base,observations:base.observations.map(o=>({...o,close:o.open*0.99}))});
 assert.equal(journal[0].action,'BUY_INTENT');
 assert.equal(journal[1].action,'SKIP');
 assert.equal(journal[1].symbol,null);
});
test('late and incomplete source evidence fail closed',()=>{
 assert.throws(()=>planGamblePresession([],{...base,sourceFetchedAt:'2026-10-30T22:00:00Z'}),/late/);
 assert.throws(()=>planGamblePresession([],{...base,observations:[{...base.observations[0],availableAt:'2026-10-30T21:30:00Z'}]}),/future/);
 assert.throws(()=>planGamblePresession([],{...base,targetSession:'2026-10-30'}),/late/);
 assert.throws(()=>planGamblePresession([],{...base,observations:[base.observations[0],base.observations[0]]}),/duplicate/);
});
