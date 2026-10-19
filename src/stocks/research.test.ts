import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTicker,secSearchUrl} from './research.ts';
test('normalizes valid tickers',()=>{assert.equal(normalizeTicker(' msft '),'MSFT');assert.equal(normalizeTicker('brk.b'),'BRK.B')});
test('rejects malformed symbols',()=>{for(const value of ['','123','AAPL/','TOOLONG','AAPL B'])assert.throws(()=>normalizeTicker(value))});
test('SEC URL is grounded in validated ticker',()=>assert.equal(secSearchUrl('aapl'),'https://www.sec.gov/edgar/search/#/q=AAPL'));

import {parseSecTickerMap,matchSecCompany} from './research.ts';
test('SEC directory resolves exact ticker and padded CIK',()=>{const rows=parseSecTickerMap({'0':{cik_str:789019,ticker:'MSFT',title:'MICROSOFT CORP'},'1':{cik_str:1,ticker:'MS',title:'OTHER'}});assert.deepEqual(matchSecCompany(rows,'msft'),[{ticker:'MSFT',name:'MICROSOFT CORP',cik:'0000789019'}]);assert.deepEqual(matchSecCompany(rows,'M'),[])});
test('SEC directory rejects malformed payload',()=>assert.throws(()=>parseSecTickerMap(null)));
