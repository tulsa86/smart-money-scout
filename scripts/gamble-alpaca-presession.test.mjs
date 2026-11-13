import test from 'node:test';
import assert from 'node:assert/strict';
import {collectGamblePresession,collectAndPlanGamble} from './gamble-alpaca-presession.mjs';
const day='2026-10-29';
const bars=Array.from({length:78},(_,i)=>({t:new Date(Date.parse(day+'T13:30:00Z')+i*300000).toISOString(),o:100,c:101,v:100}));
const prior=Array.from({length:78},(_,i)=>({t:new Date(Date.parse('2026-10-28T13:30:00Z')+i*300000).toISOString(),o:100,c:100,v:80}));
const opts={key:'test',secret:'test',targetSession:'2026-10-30',now:'2026-10-29T21:00:00Z',clock:()=> '2026-10-29T21:00:00Z',symbols:['AMD'],fetchImpl:async()=>({ok:true,json:async()=>({bars:[...prior,...bars]})})};
test('Alpaca adapter creates two decision-only prospective records',async()=>{
 const journal=await collectAndPlanGamble([] ,opts);
 assert.equal(journal.length,2);
 assert.equal(journal[0].snapshot.candidates[0].availableAt,opts.now);
 assert.equal(journal[1].mode,'selective');
});
test('missing bars and target-session leakage fail closed',async()=>{
 await assert.rejects(()=>collectGamblePresession({...opts,fetchImpl:async()=>({ok:true,json:async()=>({bars:[...prior,...bars.slice(0,74)]})})}),/Latest observed session incomplete/);
 await assert.rejects(()=>collectGamblePresession({...opts,fetchImpl:async()=>({ok:true,json:async()=>({bars:[...prior,...bars,{...bars[0],t:'2026-10-30T13:30:00Z'}]})})}),/Target-session/);
});
test('late collection and API errors fail closed',async()=>{
 await assert.rejects(()=>collectGamblePresession({...opts,clock:()=> '2026-10-30T14:00:00Z'}),/too late/);
 await assert.rejects(()=>collectGamblePresession({...opts,fetchImpl:async()=>({ok:false,status:503})}),/HTTP 503/);
});

test('an incomplete newest day cannot be silently replaced by an older complete session',async()=>{
 const later={...bars[0],t:'2026-10-30T13:30:00Z'};
 await assert.rejects(()=>collectGamblePresession({...opts,targetSession:'2026-11-02',now:'2026-10-30T20:00:00Z',clock:()=> '2026-10-30T20:00:00Z',fetchImpl:async()=>({ok:true,json:async()=>({bars:[...prior,...bars,later]})})}),/Latest observed session incomplete/);
});

test('weekend target is rejected before any market-data request',async()=>{
 await assert.rejects(()=>collectGamblePresession({...opts,targetSession:'2026-10-31'}),/Invalid prospective collection inputs/);
});

test('MVP adapter forwards selective-only mode and frozen rule version',async()=>{
 const journal=await collectAndPlanGamble([],{...opts,modes:['selective'],ruleVersion:'gamble-mvp-v1'});
 assert.equal(journal.length,1);
 assert.equal(journal[0].mode,'selective');
 assert.equal(journal[0].ruleVersion,'gamble-mvp-v1');
 assert.equal(journal[0].action,'BUY_INTENT');
 assert.equal(journal[0].symbol,'AMD');
 assert.equal(journal[0].snapshot.candidates[0].score>0,true);
});
test('MVP no-signal collection skips without forced fallback',async()=>{
 const falling=bars.map(b=>({...b,c:99}));
 const journal=await collectAndPlanGamble([],{...opts,modes:['selective'],ruleVersion:'gamble-mvp-v1',fetchImpl:async()=>({ok:true,json:async()=>({bars:[...prior,...falling]})})});
 assert.equal(journal.length,1);
 assert.equal(journal[0].mode,'selective');
 assert.equal(journal[0].ruleVersion,'gamble-mvp-v1');
 assert.equal(journal[0].action,'SKIP');
 assert.equal(journal[0].symbol,null);
});

test('presession rejects duplicate intervals even with 78 bars',async()=>{
 const duplicate=bars.map((b,i)=>i===20?{...b,t:bars[19].t}:b);
 await assert.rejects(()=>collectGamblePresession({...opts,fetchImpl:async()=>({ok:true,json:async()=>({bars:[...prior,...duplicate]})})}),/Latest observed session incomplete/);
});
test('presession rejects four missing intervals even when an extra late bar is supplied',async()=>{
 const gap=[...bars.filter((_,i)=>![20,21,22,23].includes(i)),{...bars[0],t:'2026-10-29T20:00:00Z'}];
 await assert.rejects(()=>collectGamblePresession({...opts,fetchImpl:async()=>({ok:true,json:async()=>({bars:[...prior,...gap]})})}),/Latest observed session incomplete/);
});

test('same-day 08:15 NY collection is permitted and post-open is rejected',async()=>{
 const morning='2026-10-30T12:15:00Z';
 const journal=await collectAndPlanGamble([],{...opts,now:morning,clock:()=>morning,modes:['selective'],ruleVersion:'gamble-mvp-v1'});
 assert.equal(journal.length,1);
 assert.equal(journal[0].targetSession,'2026-10-30');
 await assert.rejects(()=>collectGamblePresession({...opts,now:'2026-10-30T13:30:00Z',clock:()=> '2026-10-30T13:30:00Z'}),/Invalid prospective collection inputs/);
});

test('sparse IEX session with three missing interior intervals remains usable without invented bars',async()=>{
 const sparse=bars.filter((_,i)=>![10,20,30].includes(i));
 const result=await collectGamblePresession({...opts,fetchImpl:async()=>({ok:true,json:async()=>({bars:[...prior,...sparse]})})});
 assert.equal(result.observations.length,1);
 assert.equal(result.observations[0].volume,7800);
 assert.match(result.source,/75\/78/);
});
test('missing opening or closing bar fails closed even when count meets threshold',async()=>{
 for(const subset of [bars.slice(1),bars.slice(0,-1)]){
  await assert.rejects(()=>collectGamblePresession({...opts,fetchImpl:async()=>({ok:true,json:async()=>({bars:[...prior,...subset]})})}),/Latest observed session incomplete/);
 }
});
