import test from 'node:test';
import assert from 'node:assert/strict';
import {backtestBreakout} from './backtest.ts';
const start=Date.parse('2026-10-20T13:30:00Z');
const bar=(i:number,overrides:Record<string,number>={})=>({time:new Date(start+i*300000).toISOString(),open:100,high:101,low:99,close:100,volume:100,...overrides});
test('never trades with insufficient history',()=>assert.equal(backtestBreakout([bar(0)]).status,'invalid'));
test('waits until next bar to enter and uses end-of-data exit',()=>{
 const bars=Array.from({length:20},(_,i)=>bar(i));
 bars.push(bar(20,{open:100,high:103,low:100,close:102,volume:200}));
 bars.push(bar(21,{open:102,high:103,low:101,close:102,volume:100}));
 const result=backtestBreakout(bars);
 assert.equal(result.status,'ok');assert.equal(result.trades.length,1);
 assert.equal(result.trades[0].entryTime,bars[21].time);
 assert.equal(result.trades[0].reason,'end-of-data');
});
test('rejects out-of-order data rather than sorting and hiding errors',()=>{
 const bars=Array.from({length:22},(_,i)=>bar(i));
 [bars[0],bars[1]]=[bars[1],bars[0]];
 assert.equal(backtestBreakout(bars).status,'invalid');
});
test('does not buy without a breakout',()=>{
 const result=backtestBreakout(Array.from({length:25},(_,i)=>bar(i)));
 assert.equal(result.status,'ok');assert.equal(result.trades.length,0);
});
test('gap through stop gets worse open fill',()=>{
 const bars=Array.from({length:20},(_,i)=>bar(i));
 bars.push(bar(20,{high:103,low:100,close:102,volume:200}));
 bars.push(bar(21,{open:102,high:103,low:101,close:102}));
 bars.push(bar(22,{open:95,high:96,low:94,close:95}));
 const result=backtestBreakout(bars);
 assert.equal(result.trades[0].reason,'stop');
 assert.ok(result.trades[0].exitPrice<95);
});

test('daily trade target uses a smaller fallback and records its strategy',()=>{
 const bars=Array.from({length:30},(_,i)=>bar(i));
 const result=backtestBreakout(bars,{dailyTradeTarget:true});
 assert.equal(result.status,'ok');
 assert.equal(result.trades.length,1);
 assert.equal(result.trades[0].strategy,'fallback');
 assert.ok(result.trades[0].shares<=2);
 assert.equal(result.trades[0].reason,'end-of-data');
});
test('daily trade target disabled preserves zero-trade baseline',()=>{
 const result=backtestBreakout(Array.from({length:30},(_,i)=>bar(i)),{dailyTradeTarget:false});
 assert.equal(result.trades.length,0);
});
test('fallback cannot trade without sufficient cash for a whole share',()=>{
 const result=backtestBreakout(Array.from({length:30},(_,i)=>bar(i)),{dailyTradeTarget:true,startingCash:100});
 assert.equal(result.trades.length,0);
});
