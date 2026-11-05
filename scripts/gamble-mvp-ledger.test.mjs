import test from 'node:test';
import assert from 'node:assert/strict';
import {appendGambleDecision} from './gamble-decision-journal.mjs';
import {newMvpLedger,applyMvpSession,applyMvpSessionIdempotent} from './gamble-mvp-ledger.mjs';
const session='2026-11-05';
const decisionAt='2026-11-04T21:30:00Z';
const candidate={symbol:'AMD',score:0.04};
const journal=action=>appendGambleDecision([],{mode:'selective',targetSession:session,recordedAt:decisionAt,snapshot:{asOf:'2026-11-04T21:20:00Z',source:'fixture',candidates:[candidate]},action,symbol:action==='SKIP'?null:'AMD',bankrollCents:100000,ruleVersion:'gamble-mvp-v1',reason:'fixture'});
const evidence={symbol:'AMD',targetSession:session,openObservedAt:'2026-11-05T14:30:00Z',closeObservedAt:'2026-11-05T20:55:00Z',availableAt:'2026-11-05T21:05:00Z',open:100,close:102};
const at='2026-11-05T21:10:00Z';
test('single account records $250 maximum exposure and full same-day simulated cash round trip',()=>{
 const original=newMvpLedger();
 const result=applyMvpSession(original,journal('BUY_INTENT'),{targetSession:session,evidence,recordedAt:at});
 assert.equal(result.sessions[0].status,'SIMULATED_ROUND_TRIP');
 assert.equal(result.sessions[0].shares,2);
 assert.equal(result.sessions[0].entryPriceCents,10005);
 assert.equal(result.sessions[0].exitPriceCents,10195);
 assert.equal(result.cashCents,100380);
 assert.equal(original.cashCents,100000);
 assert.equal(result.sessions[0].simulationOnly,true);
 assert.throws(()=>applyMvpSession(result,journal('BUY_INTENT'),{targetSession:session,evidence,recordedAt:at}),/Duplicate or backfilled/);
});
test('no-signal day and unavailable evidence are explicitly recorded without invented fills',()=>{
 const skip=applyMvpSession(newMvpLedger(),journal('SKIP'),{targetSession:session,recordedAt:at});
 assert.equal(skip.sessions[0].status,'SKIP');
 assert.equal(skip.cashCents,100000);
 const missing=applyMvpSession(newMvpLedger(),journal('BUY_INTENT'),{targetSession:session,recordedAt:at});
 assert.equal(missing.sessions[0].status,'MISSING_EVIDENCE');
 assert.equal(missing.sessions[0].shares,0);
});
test('rejects premature and mismatched evidence, and unaffordable shares',()=>{
 const j=journal('BUY_INTENT');
 assert.throws(()=>applyMvpSession(newMvpLedger(),j,{targetSession:session,evidence,recordedAt:'2026-11-05T20:58:00Z'}),/Invalid or unavailable/);
 assert.throws(()=>applyMvpSession(newMvpLedger(),j,{targetSession:session,evidence:{...evidence,symbol:'TSLA'},recordedAt:at}),/Invalid or unavailable/);
 const unaffordable=applyMvpSession(newMvpLedger(),j,{targetSession:session,evidence:{...evidence,open:300,close:290},recordedAt:at});
 assert.equal(unaffordable.sessions[0].status,'SKIP_UNAFFORDABLE');
 assert.equal(unaffordable.cashCents,100000);
});

test('rerun is a no-op and conflicting decisions or evidence cannot rewrite history',()=>{
 const j=journal('BUY_INTENT');
 const first=applyMvpSessionIdempotent(newMvpLedger(),j,{targetSession:session,evidence,recordedAt:at});
 assert.equal(first.alreadyRecorded,false);
 const repeat=applyMvpSessionIdempotent(first.ledger,j,{targetSession:session,recordedAt:at});
 assert.equal(repeat.alreadyRecorded,true);
 assert.strictEqual(repeat.ledger,first.ledger);
 assert.throws(()=>applyMvpSessionIdempotent(first.ledger,j,{targetSession:session,recordedAt:at,slippageBps:25}),/Conflicting rerun/);
 const missing=applyMvpSessionIdempotent(newMvpLedger(),j,{targetSession:session,recordedAt:at}).ledger;
 assert.throws(()=>applyMvpSessionIdempotent(missing,j,{targetSession:session,evidence,recordedAt:at}),/Cannot silently replace/);
});

test('same-day premarket decision settles after session, but post-open decisions are rejected',()=>{
 const make=(recordedAt)=>appendGambleDecision([],{mode:'selective',targetSession:session,recordedAt,snapshot:{asOf:recordedAt,source:'fixture',candidates:[candidate]},action:'SKIP',symbol:null,ruleVersion:'gamble-mvp-v1',reason:'fixture'});
 const premarket=make('2026-11-05T13:15:00Z');
 const result=applyMvpSession(newMvpLedger(),premarket,{targetSession:session,recordedAt:'2026-11-06T14:00:00Z'});
 assert.equal(result.sessions[0].status,'SKIP');
 assert.throws(()=>make('2026-11-05T14:30:00Z'),/retrospective/);
});
