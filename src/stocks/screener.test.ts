import test from 'node:test';
import assert from 'node:assert/strict';
import {passesScreener,defaultScreenerFilters} from './screener.ts';
import type {FundamentalScore} from './fundamentals.ts';
const sample:FundamentalScore={ticker:'TEST',score:60,revenueGrowth:0.10,earningsGrowth:0.2,netMargin:0.15,reasons:[]};
test('default screener thresholds include exact boundaries',()=>{assert.deepEqual(defaultScreenerFilters,{minRevenueGrowth:10,minNetMargin:15,minScore:60});assert.equal(passesScreener(sample),true)});
test('fails each criterion below threshold',()=>{assert.equal(passesScreener({...sample,score:59}),false);assert.equal(passesScreener({...sample,revenueGrowth:0.09}),false);assert.equal(passesScreener({...sample,netMargin:0.14}),false)});
test('missing or non-finite metrics never pass',()=>{for(const changed of [{score:null},{revenueGrowth:null},{netMargin:null},{score:NaN},{netMargin:Infinity}])assert.equal(passesScreener({...sample,...changed}),false)});
test('adjustable thresholds are honored',()=>{assert.equal(passesScreener(sample,{minRevenueGrowth:11,minNetMargin:15,minScore:60}),false);assert.equal(passesScreener(sample,{minRevenueGrowth:5,minNetMargin:10,minScore:50}),true)});
