import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverStocks,planStockDecisions} from './stock-discovery.mjs';
const time='2026-10-27T20:00:00Z';
const row=(symbol,close,volume,previousClose=close)=>({symbol,close,volume,previousClose,observedAt:time});
const snap=rows=>({source:'offline-market-snapshot',asOf:time,rows});
test('dynamic discovery uses supplied symbols, not fixed test universe',()=>{
 const d=discoverStocks(snap([row('ACME',10,1000000,9),row('XYZ',20,100000,19),row('WIDE',4,2000000,3)]));
 assert.deepEqual(d.candidates.map(x=>x.symbol),['ACME','WIDE']);assert.equal(d.coverage.completeMarketCoverage,false);
});
test('deterministic prospective BUY has whole-share sizing but no fill',()=>{
 const d=discoverStocks(snap([row('ACME',10,1000000,9)]));
 const p=planStockDecisions(d,{decisionAt:'2026-10-27T20:05:00Z'});
 assert.equal(p.action,'BUY');assert.equal(p.shares,20);assert.equal(p.status,'DECISION_ONLY_NO_FILL');assert.equal(p.referencePrice,10);
});
test('can abstain, including empty universe and insufficient cash',()=>{
 const d=discoverStocks(snap([]));assert.equal(planStockDecisions(d,{decisionAt:time}).action,'HOLD');
 const e=discoverStocks(snap([row('ACME',100,100000,90)]));assert.equal(planStockDecisions(e,{decisionAt:time,cashCents:1000}).action,'HOLD');
});
test('rejects future observations, duplicate tickers and invalid data',()=>{
 assert.throws(()=>discoverStocks(snap([{...row('ACME',10,1000000),observedAt:'2026-10-28T20:00:00Z'}])),/Future/);
 assert.throws(()=>discoverStocks(snap([row('ACME',10,1000000),row('ACME',10,1000000)])),/duplicate/);
 assert.throws(()=>discoverStocks(snap([row('ACME',NaN,1000000)])),/Invalid market data/);
});
test('rejects decisions before observation and malformed candidates',()=>{
 const d=discoverStocks(snap([row('ACME',10,1000000)]));
 assert.throws(()=>planStockDecisions(d,{decisionAt:'2026-10-26T20:00:00Z'}),/precede/);
 assert.throws(()=>planStockDecisions({...d,candidates:[{...d.candidates[0],observedAt:'2026-10-28T20:00:00Z'}]},{decisionAt:time}),/future/);
});
