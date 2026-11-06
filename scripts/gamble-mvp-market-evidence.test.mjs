import test from 'node:test';
import assert from 'node:assert/strict';
import {completedMvpEvidence} from './gamble-mvp-market-evidence.mjs';
const targetSession='2026-11-05';
const bars=Array.from({length:78},(_,i)=>({t:new Date(Date.parse('2026-11-05T14:30:00Z')+i*300000).toISOString(),o:100+i/100,c:100+i/100+0.01}));
const base={symbol:'AMD',targetSession,bars,availableAt:'2026-11-05T21:05:00Z'};
test('completed regular-session IEX bars become deterministic evidence',()=>{
 const result=completedMvpEvidence(base);
 assert.equal(result.open,100);
 assert.equal(result.close,bars.at(-1).c);
 assert.equal(result.closeObservedAt,'2026-11-05T20:55:00.000Z');
 assert.deepEqual(completedMvpEvidence({...base,bars:[...bars].reverse()}),result);
});
test('missing, duplicate, early, and wrong-session bars fail closed',()=>{
 assert.throws(()=>completedMvpEvidence({...base,bars:bars.slice(0,-1)}),/Missing opening or closing/);
 assert.throws(()=>completedMvpEvidence({...base,bars:[...bars.slice(0,-1),bars[0]]}),/Duplicate/);
 assert.throws(()=>completedMvpEvidence({...base,availableAt:'2026-11-05T20:58:00Z'}),/not yet complete/);
 assert.throws(()=>completedMvpEvidence({...base,bars:bars.map((b,i)=>i===5?{...b,t:'2026-11-04T14:55:00Z'}:b)}),/Invalid or future/);
 assert.throws(()=>completedMvpEvidence({...base,bars:bars.filter((_,i)=>i!==4).concat({...bars[77],t:'2026-11-05T21:00:00Z'})}),/Missing opening or closing bar/);
});

test('missing intermediate IEX bars are documented but endpoints still settle',()=>{
 const partial=bars.filter((_,i)=>i!==14&&i!==38);
 const evidence=completedMvpEvidence({...base,bars:partial});
 assert.equal(evidence.barCount,76);
 assert.equal(evidence.missingIntermediateBars,2);
 assert.equal(evidence.open,100);
 assert.equal(evidence.close,bars.at(-1).c);
});
