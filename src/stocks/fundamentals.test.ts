import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scoreFundamentals} from './fundamentals.ts';
const fig=(value:number,start:string,end:string)=>({value,periodStart:start,periodEnd:end,filed:'2026-02-01',accession:'0000000001-26-000001'});
test('scores comparable annual fundamentals with explanations',()=>{
 const company={facts:{
  revenue:[fig(120,'2025-01-01','2025-12-31'),fig(100,'2024-01-01','2024-12-31')],
  netIncome:[fig(24,'2025-01-01','2025-12-31'),fig(20,'2024-01-01','2024-12-31')]
 }};
 const result=scoreFundamentals('TEST',company);
 assert.equal(result.revenueGrowth,0.2);
 assert.equal(result.earningsGrowth,0.2);
 assert.equal(result.netMargin,0.2);
 assert.ok(result.score!==null&&result.score>=0&&result.score<=100);
 assert.equal(result.reasons.length,4);
});
test('withholds score for missing historical data',()=>{
 const result=scoreFundamentals('TEST',{facts:{revenue:[fig(100,'2025-01-01','2025-12-31')],netIncome:[fig(10,'2025-01-01','2025-12-31')]}});
 assert.equal(result.score,null);
});
test('rejects mismatched periods',()=>{
 const result=scoreFundamentals('TEST',{facts:{revenue:[fig(100,'2025-01-01','2025-12-31')],netIncome:[fig(10,'2024-01-01','2024-12-31')]}});
 assert.equal(result.score,null);
});
