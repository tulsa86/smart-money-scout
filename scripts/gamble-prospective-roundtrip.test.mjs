import test from 'node:test';
import assert from 'node:assert/strict';
import {createGambleAccounts,processGambleSession} from './gamble-prospective-roundtrip.mjs';
const at='2026-10-29T20:10:00Z';
const buy={kind:'PROSPECTIVE_STOCK_DECISION',status:'DECISION_ONLY_NO_FILL',action:'BUY',symbol:'SOFI',shares:12,allocationLimitCents:20000,decisionAt:'2026-10-28T23:07:01.403Z'};
const hold={...buy,action:'HOLD',decisionAt:'2026-10-28T23:08:01.403Z'};
const openingBar={symbol:'SOFI',observedAt:'2026-10-29T13:30:00Z',availableAt:'2026-10-29T13:35:00Z',open:16.50};
const exitBar={symbol:'SOFI',observedAt:'2026-10-29T19:55:00Z',availableAt:'2026-10-29T20:00:00Z',close:17};
test('independent $1000 accounts record full round trip and cash-only skip',()=>{
 const original=createGambleAccounts();
 const {accounts,results}=processGambleSession(original,{'forced-daily':{decision:buy,openingBar,exitBar},selective:{decision:hold}},{snapshotTime:at});
 assert.equal(results['forced-daily'].cashCents,100576);
 assert.equal(results['forced-daily'].realizedPnlCents,576);
 assert.equal(results.selective.totalEquityCents,100000);
 assert.equal(accounts.selective.fills.length,0);
 assert.equal(original['forced-daily'].fills.length,0);
 assert.deepEqual(accounts['forced-daily'].positions,{});
});
test('missing exit or unavailable exit fails closed without mutating either account',()=>{
 const original=createGambleAccounts();
 assert.throws(()=>processGambleSession(original,{'forced-daily':{decision:buy,openingBar},selective:{decision:hold}},{snapshotTime:at}),/Missing exit evidence/);
 assert.throws(()=>processGambleSession(original,{'forced-daily':{decision:buy,openingBar,exitBar},selective:{decision:hold}},{snapshotTime:'2026-10-29T19:59:00Z'}),/not available/);
 assert.equal(original['forced-daily'].cashCents,100000);
});

test('rejects next-day exits and opening data only published after the exit',()=>{
 const original=createGambleAccounts();
 const selective={decision:hold};
 assert.throws(()=>processGambleSession(original,{'forced-daily':{decision:buy,openingBar,exitBar:{...exitBar,observedAt:'2026-10-30T19:55:00Z',availableAt:'2026-10-30T20:00:00Z'}},selective},{snapshotTime:'2026-10-30T20:10:00Z'}),/Intraday entry\/exit timing/);
 assert.throws(()=>processGambleSession(original,{'forced-daily':{decision:buy,openingBar:{...openingBar,availableAt:'2026-10-29T20:01:00Z'},exitBar},selective},{snapshotTime:at}),/Intraday entry\/exit timing/);
});
