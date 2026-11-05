import test from 'node:test';
import assert from 'node:assert/strict';
import {executeDailyExperiment} from './gamble-mvp-daily-steps.mjs';
const noop={log(){},error(){}};
test('failed previous settlement does not suppress today's prospective decision',()=>{
 const calls=[];
 const result=executeDailyExperiment({pending:[{targetSession:'2026-11-05'}],decisions:[{targetSession:'2026-11-05'}],today:'2026-11-06',log:noop,run:(script,day)=>{calls.push([script,day]);if(script.includes('settle'))throw Error('missing settlement bars')}});
 assert.deepEqual(calls,[['scripts/settle-gamble-mvp.mjs','2026-11-05'],['scripts/record-gamble-presession.mjs','2026-11-06']]);
 assert.match(result.settlementFailure.message,/missing settlement bars/);
 assert.equal(result.decisionFailure,null);
});
test('decision failure remains visible and no duplicate decision is recorded',()=>{
 const result=executeDailyExperiment({pending:[],decisions:[],today:'2026-11-06',log:noop,run:()=>{throw Error('Alpaca unavailable')}});
 assert.match(result.decisionFailure.message,/Alpaca unavailable/);
 let calls=0;
 executeDailyExperiment({pending:[],decisions:[{targetSession:'2026-11-06'}],today:'2026-11-06',log:noop,run:()=>calls++});
 assert.equal(calls,0);
});
