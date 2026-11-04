import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchMvpSessionEvidence} from './gamble-mvp-alpaca-readonly.mjs';
const bars=Array.from({length:78},(_,i)=>({t:new Date(Date.parse('2026-11-05T14:30:00Z')+i*300000).toISOString(),o:100,c:102}));
const args={symbol:'AMD',targetSession:'2026-11-05',key:'fixture-key',secret:'fixture-secret',availableAt:'2026-11-05T21:10:00Z'};
test('retrieves complete Alpaca session without orders',async()=>{
 let calls=0;
 const result=await fetchMvpSessionEvidence({...args,fetchImpl:async(url,options)=>{calls++;assert.match(url,/feed=iex/);assert.equal(options.headers['APCA-API-KEY-ID'],'fixture-key');return {ok:true,json:async()=>({bars})};}});
 assert.equal(calls,1);
 assert.equal(result.open,100);
 assert.equal(result.close,102);
});
test('fails closed on incomplete and unavailable data',async()=>{
 await assert.rejects(()=>fetchMvpSessionEvidence({...args,fetchImpl:async()=>({ok:true,json:async()=>({bars:bars.slice(0,-1)})})}),/Incomplete session/);
 await assert.rejects(()=>fetchMvpSessionEvidence({...args,availableAt:'2026-11-05T20:58:00Z',fetchImpl:async()=>({ok:true,json:async()=>({bars})})}),/not yet complete/);
 await assert.rejects(()=>fetchMvpSessionEvidence({...args,fetchImpl:async()=>({ok:false,status:429})}),/HTTP 429/);
});
