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
 await assert.rejects(()=>collectGamblePresession({...opts,fetchImpl:async()=>({ok:true,json:async()=>({bars:[...prior,...bars.slice(0,77)]})})}),/Latest observed session incomplete/);
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
