import test from 'node:test';import assert from 'node:assert/strict';import {isRegularMarketDay,priorRegularMarketDay} from './gamble-market-calendar.mjs';
test('regular dates, holidays, early closes',()=>{assert.equal(isRegularMarketDay('2026-11-04'),true);for(const d of ['2026-11-07','2026-11-26','2026-11-27','2026-12-25','2027-01-01','2027-03-26','2027-07-05'])assert.equal(isRegularMarketDay(d),false,d)});
test('previous session across weekend and holiday',()=>{assert.equal(priorRegularMarketDay('2026-11-09'),'2026-11-06');assert.equal(priorRegularMarketDay('2026-11-30'),'2026-11-25')});
test('invalid date fails closed',()=>assert.throws(()=>isRegularMarketDay('2026-02-30')));
