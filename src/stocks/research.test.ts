import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTicker,secSearchUrl} from './research.ts';
test('normalizes valid tickers',()=>{assert.equal(normalizeTicker(' msft '),'MSFT');assert.equal(normalizeTicker('brk.b'),'BRK.B')});
test('rejects malformed symbols',()=>{for(const value of ['','123','AAPL/','TOOLONG','AAPL B'])assert.throws(()=>normalizeTicker(value))});
test('SEC URL is grounded in validated ticker',()=>assert.equal(secSearchUrl('aapl'),'https://www.sec.gov/edgar/search/#/q=AAPL'));
