import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'sms-research-test-'));
try{
 const root=path.join(tmp,'public/research/2026-10-19');
 await fs.mkdir(root,{recursive:true});
 const t=Date.parse('2026-10-19T10:00:00Z');
 const o=[{id:'tokenA',symbol:'A',time:t,price:1,liquidityUsd:150000,change1hPct:5,pairCreatedAt:t-8*86400000},{id:'tokenB',symbol:'B',time:t,price:1,liquidityUsd:10000,change1hPct:-2,pairCreatedAt:t-86400000}];
 const x=[{id:'tokenA',observedAt:t,horizonMinutes:15,returnPct:10,delayMinutes:5,status:'observed'},{id:'tokenB',observedAt:t,horizonMinutes:15,returnPct:-20,delayMinutes:25,status:'observed'}];
 await fs.writeFile(path.join(root,'observations.ndjson'),o.map(JSON.stringify).join('\n')+'\n');
 await fs.writeFile(path.join(root,'outcomes.ndjson'),x.map(JSON.stringify).join('\n')+'\n');
 await fs.writeFile(path.join(tmp,'public/research/summary.json'),JSON.stringify({observations:2,outcomes:2}));
 for(const script of ['research-audit.mjs','research-analysis.mjs']){
  const result=spawnSync(process.execPath,[path.resolve('scripts',script)],{cwd:tmp,encoding:'utf8'});
  assert.equal(result.status,0,script+': '+result.stderr);
 }
 const quality=JSON.parse(await fs.readFile(path.join(tmp,'public/research/quality.json'),'utf8'));
 const analysis=JSON.parse(await fs.readFile(path.join(tmp,'public/research/analysis.json'),'utf8'));
 assert.equal(quality.summaryMatchesFiles,true);
 assert.equal(quality.nearTargetOutcomes,1);
 assert.equal(quality.duplicateObservations,0);
 assert.equal(analysis.horizons['15'].independentTokenExamples,1);
 assert.equal(analysis.horizons['15'].groups.momentum[2].tokens,1);
 assert.equal(analysis.readyForHypothesisTesting,false);
 console.log('Research audit and analysis fixture tests passed.');
}finally{await fs.rm(tmp,{recursive:true,force:true})}
