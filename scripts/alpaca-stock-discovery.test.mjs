import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchAlpacaStockSnapshot,produceAlpacaDecision} from './alpaca-stock-discovery.mjs';
import {appendStockDecisionJournal} from './stock-decision-journal.mjs';
const decisionAt='2026-10-28T20:00:00Z';
const bar=(t,c,v=1000000)=>({t,c,v});
const calls=[];
const fetchImpl=async url=>{
 calls.push(url);
 if(url.includes('most-actives'))return {ok:true,json:async()=>({most_actives:[{symbol:'ACME'},{symbol:'XYZ'}]})};
 const symbol=new URL(url).searchParams.get('symbols');
 return {ok:true,json:async()=>({bars:{[symbol]:[bar('2026-10-22T04:00:00Z',10),bar('2026-10-23T04:00:00Z',10.1),bar('2026-10-26T04:00:00Z',10.2),bar('2026-10-27T04:00:00Z',symbol==='ACME'?10.5:9),bar('2026-10-28T04:00:00Z',999)]}})};
};
test('fetches actual Alpaca endpoints and excludes unfinished decision-day candles',async()=>{
 calls.length=0;
 const x=await fetchAlpacaStockSnapshot({key:'test',secret:'test',decisionAt,fetchImpl});
 assert.equal(x.rows.length,2);assert.equal(x.rows[0].close,10.5);
 assert.ok(calls.some(x=>x.includes('/v1beta1/screener/stocks/most-actives')));
 assert.ok(calls.some(x=>x.includes('/v2/stocks/bars?')));
 assert.equal(x.discoveryMeta.completeMarketCoverage,false);
});
test('makes and journals a prospective decision without inventing fills',async()=>{
 const {discovery,decision}=await produceAlpacaDecision({key:'test',secret:'test',decisionAt,fetchImpl});
 assert.equal(decision.action,'BUY');assert.equal(decision.symbol,'ACME');
 const journal=appendStockDecisionJournal([],{discovery,decision});
 assert.equal(journal[0].executionStatus,'NOT_EXECUTED');assert.equal(journal[0].pnl,null);
 assert.match(journal[0].digest,/^[a-f0-9]{64}$/);
 assert.throws(()=>appendStockDecisionJournal(journal,{discovery,decision}),/Duplicate/);
});
test('fails closed on bad provider response and time',async()=>{
 await assert.rejects(fetchAlpacaStockSnapshot({key:'x',secret:'y',decisionAt,fetchImpl:async()=>({ok:true,json:async()=>({})})}),/most_actives/);
 await assert.rejects(fetchAlpacaStockSnapshot({key:'x',secret:'y',decisionAt:'not a time',fetchImpl}),/Valid Alpaca/);
});

test('hash chain detects altered or removed earlier decisions',async()=>{
 const {discovery,decision}=await produceAlpacaDecision({key:'test',secret:'test',decisionAt,fetchImpl});
 const first=appendStockDecisionJournal([],{discovery,decision});
 const later={...decision,decisionAt:'2026-10-29T21:00:00Z'};
 const second=appendStockDecisionJournal(first,{discovery,decision:later});
 assert.equal(second[1].previousDigest,second[0].digest);
 assert.throws(()=>appendStockDecisionJournal([{...second[0],digest:'0'.repeat(64)},second[1]],{discovery,decision:{...decision,decisionAt:'2026-10-30T21:00:00Z'}}),/integrity|chain/i);
 assert.throws(()=>appendStockDecisionJournal([second[1]],{discovery,decision:{...decision,decisionAt:'2026-10-30T21:00:00Z'}}),/chain/i);
});

test('includes same-day daily bar only after New York close buffer',async()=>{
 const after=await fetchAlpacaStockSnapshot({key:'test',secret:'test',decisionAt:'2026-10-28T21:00:00Z',fetchImpl});
 assert.equal(after.rows[0].close,999);
 const before=await fetchAlpacaStockSnapshot({key:'test',secret:'test',decisionAt:'2026-10-28T20:29:00Z',fetchImpl});
 assert.equal(before.rows[0].close,10.5);
});
test('DST changes the New York close cutoff automatically',async()=>{
 const winterFetch=async url=>{
  if(url.includes('most-actives'))return {ok:true,json:async()=>({most_actives:[{symbol:'ACME'}]})};
  return {ok:true,json:async()=>({bars:{ACME:[bar('2026-10-29T04:00:00Z',8),bar('2026-10-30T04:00:00Z',9),bar('2026-11-02T05:00:00Z',10),bar('2026-11-03T05:00:00Z',11),bar('2026-11-04T05:00:00Z',12)]}})};
 };
 const before=await fetchAlpacaStockSnapshot({key:'test',secret:'test',decisionAt:'2026-11-04T21:29:00Z',fetchImpl:winterFetch});
 const after=await fetchAlpacaStockSnapshot({key:'test',secret:'test',decisionAt:'2026-11-04T21:31:00Z',fetchImpl:winterFetch});
 assert.equal(before.rows[0].close,11);
 assert.equal(after.rows[0].close,12);
});
