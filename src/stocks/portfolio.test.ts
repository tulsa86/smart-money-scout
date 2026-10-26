import test from 'node:test';
import assert from 'node:assert/strict';
import {replayPortfolio} from './portfolio.ts';
import type {Candle} from './candles.ts';
const start=Date.parse('2026-09-01T13:30:00Z');
function stock(multiplier:number):Candle[]{const bars:Candle[]=[];for(let d=0;d<9;d++){for(let i=0;i<78;i++){const open=100+d*multiplier+i*multiplier/78;bars.push({time:new Date(start+d*86400000+i*300000).toISOString(),open,high:open+0.3,low:open-0.3,close:open+multiplier/78,volume:100+d*10});}}return bars;}
test('prior-session selection refuses to trade without six completed prior sessions',()=>{
 const a=stock(0.5).slice(0,78*6);const b=stock(1).slice(0,78*6);
 const r=replayPortfolio({AAA:a,BBB:b},1000,'prior-session-momentum');
 assert.equal(r.status,'ok');assert.equal(r.entries.every(e=>e.symbol==='NONE'),true);
});
test('prior-session selector picks strongest eligible previous-day momentum',()=>{
 const r=replayPortfolio({AAA:stock(0.5),BBB:stock(1.5)},1000,'prior-session-momentum');
 assert.equal(r.status,'ok');
 assert.equal(r.entries[6].symbol,'BBB');
});

test('evaluation start uses prior sessions for selection without replaying earlier trades',()=>{
 const r=replayPortfolio({AAA:stock(0.5),BBB:stock(1.5)},900,'prior-session-momentum','2026-09-07');
 assert.equal(r.status,'ok');
 assert.equal(r.entries.every(e=>e.day>='2026-09-07'),true);
 assert.equal(r.entries[0].endingCash<=10000,true);
});
