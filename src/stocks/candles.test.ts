import test from 'node:test';
import assert from 'node:assert/strict';
import {breakoutSignal,validateCandles} from './candles.ts';
const base=Date.parse('2026-10-01T14:30:00Z');
const make=(i:number,close=100,volume=100)=>({time:new Date(base+i*300000).toISOString(),open:100,high:Math.max(101,close),low:99,close,volume});
test('requires completed history',()=>assert.equal(breakoutSignal([make(0)]).action,'wait'));
test('detects confirmed high-volume breakout',()=>{
 const bars=Array.from({length:20},(_,i)=>make(i));
 const result=breakoutSignal([...bars,make(20,102,200)]);
 assert.equal(result.action,'buy');assert.equal(result.breakoutLevel,101);assert.equal(result.relativeVolume,2);
});
test('does not buy without volume confirmation',()=>{
 const bars=Array.from({length:20},(_,i)=>make(i));
 assert.equal(breakoutSignal([...bars,make(20,102,120)]).action,'wait');
});
test('does not buy when price fails to break previous high',()=>{
 const bars=Array.from({length:20},(_,i)=>make(i));
 assert.equal(breakoutSignal([...bars,make(20,101,300)]).action,'wait');
});
test('rejects malformed and out-of-order candles',()=>{
 assert.ok(validateCandles([make(1),make(0)]));
 assert.equal(breakoutSignal([...Array.from({length:20},(_,i)=>make(i)),{...make(20,102,200),low:103}]).action,'wait');
});
test('rejects impossible strategy parameters',()=>assert.equal(breakoutSignal(Array.from({length:21},(_,i)=>make(i)),0).action,'wait'));
