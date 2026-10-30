import test from 'node:test';
import assert from 'node:assert/strict';
import {appendGambleDecision,verifyGambleDecisionJournal} from './gamble-decision-journal.mjs';
const snapshot={source:'prior-session Alpaca IEX 5m',asOf:'2026-10-29T20:10:00Z',candidates:[{symbol:'AMD',score:1.25},{symbol:'SPY',score:0.3}]};
const common={targetSession:'2026-10-30',recordedAt:'2026-10-29T21:00:00Z',snapshot,bankrollCents:100000,ruleVersion:'gamble-baseline-v1'};
test('forced and selective decisions coexist with separate identities and digest chain',()=>{
 const a=appendGambleDecision([],{...common,mode:'forced-daily',action:'BUY_INTENT',symbol:'AMD',reason:'Prior-session relative momentum'});
 const b=appendGambleDecision(a,{...common,mode:'selective',action:'SKIP',symbol:null,reason:'No qualifying selective signal'});
 assert.equal(verifyGambleDecisionJournal(b).length,2);
 assert.equal(b[1].previousDigest,b[0].digest);
 assert.equal(b[0].bankrollCents,100000);
 assert.throws(()=>appendGambleDecision(b,{...common,mode:'selective',action:'SKIP',reason:'Duplicate'}),/already recorded/);
});
test('future and retrospective evidence fail closed',()=>{
 assert.throws(()=>appendGambleDecision([],{...common,mode:'forced-daily',action:'BUY_INTENT',symbol:'AMD',reason:'x',recordedAt:'2026-10-30T14:00:00Z'}),/retrospective/);
 assert.throws(()=>appendGambleDecision([],{...common,mode:'forced-daily',action:'BUY_INTENT',symbol:'AMD',reason:'x',snapshot:{...snapshot,asOf:'2026-10-29T22:00:00Z'}}),/retrospective/);
});
test('tampering and unsupported symbol are rejected',()=>{
 assert.throws(()=>appendGambleDecision([],{...common,mode:'forced-daily',action:'BUY_INTENT',symbol:'FAKE',reason:'x'}),/absent/);
 const a=appendGambleDecision([],{...common,mode:'selective',action:'SKIP',reason:'No signal'});
 assert.throws(()=>verifyGambleDecisionJournal([{...a[0],reason:'Rewritten'}]),/digest mismatch/);
 assert.equal(a[0].action,'SKIP');
});
