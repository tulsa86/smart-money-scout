import test from 'node:test';
import assert from 'node:assert/strict';
import {auditBars,fetchAudit} from './gamble-iex-coverage-audit.mjs';
const bars=Array.from({length:78},(_,i)=>({t:new Date(Date.parse('2026-10-29T13:30:00Z')+i*300000).toISOString(),o:100,c:101,v:100}));
test('reports full coverage',()=>{const x=auditBars(bars)[0];assert.equal(x.eligible78,true);assert.equal(x.missingSlots,0)});
test('distinguishes sparse sessions from incomplete edges',()=>{const sparse=bars.filter((_,i)=>![12,20,35].includes(i));assert.equal(auditBars(sparse)[0].eligible75,true);assert.equal(auditBars(sparse.slice(1))[0].eligible75,false)});
test('duplicate timestamps fail eligibility',()=>{const x=auditBars([...bars,bars[1]])[0];assert.equal(x.duplicateSlots,1);assert.equal(x.eligible75,false)});
test('audit fetch is read-only and uses IEX feed',async()=>{
 let requests=0;
 const result=await fetchAudit({key:'test',secret:'test',now:new Date('2026-10-30T12:00:00Z'),symbols:['AMD'],fetchImpl:async(url,options)=>{requests++;assert.match(url,/feed=iex/);assert.equal(options.method,undefined);return {ok:true,json:async()=>({bars})}}});
 assert.equal(requests,1);assert.equal(result.symbols.AMD[0].eligible78,true);
});
test('provider failures are not silently accepted',async()=>{await assert.rejects(()=>fetchAudit({key:'x',secret:'y',symbols:['AMD'],fetchImpl:async()=>({ok:false,status:503})}),/HTTP 503/)});
