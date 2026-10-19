import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const script=path.resolve('scripts/paper-scan.mjs');
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'sms-simulation-'));
const mint='11111111111111111111111111111111';
const scenarios=[
 {name:'qualifying entry',price:1,starting:null,expect:'BUY',cash:90,open:1,trades:0},
 {name:'profit-taking rally',price:1.3,starting:'open',expect:'Take profit',cash:102.7413,open:0,trades:1},
 {name:'gap-through-stop crash',price:0.2,starting:'open',expect:'Stop loss',cash:91.9602,open:0,trades:1},
 {name:'missing held quote',price:null,starting:'open',expect:'position held',cash:90,open:1,trades:0},
 {name:'ineligible low liquidity',price:1,liquidity:100,starting:null,expect:'lowLiquidity',cash:100,open:0,trades:0}
];
const preload=`const id='11111111111111111111111111111111';
const s=JSON.parse(process.env.SMS_SCENARIO);
globalThis.fetch=async url=>{
 const u=String(url);
 const pair=s.price===null?[]:[{chainId:'solana',baseToken:{address:id,symbol:'TEST'},priceUsd:String(s.price),liquidity:{usd:s.liquidity??200000},volume:{h24:400000},priceChange:{h1:8},pairCreatedAt:Date.now()-10*86400000}];
 const body=u.includes('/tokens/v1/solana/')?pair:[{chainId:'solana',tokenAddress:id}];
 return {ok:true,json:async()=>body};
};`;
try{
 const preloadPath=path.join(tmp,'mock.mjs');
 await fs.writeFile(preloadPath,preload);
 for(const s of scenarios){
  const dir=path.join(tmp,s.name.replaceAll(' ','-'));
  await fs.mkdir(path.join(dir,'public'),{recursive:true});
  if(s.starting==='open'){
   const state={version:1,cash:90,positions:[{id:mint,symbol:'TEST',units:9.9,entry:1,spent:10,opened:Date.now()-3600000,last:1}],trades:[],events:[],lastCheck:null,checked:0,qualified:0,status:'OK'};
   await fs.writeFile(path.join(dir,'public/paper-state.json'),JSON.stringify(state));
  }
  const result=spawnSync(process.execPath,['--import',preloadPath,script],{cwd:dir,encoding:'utf8',env:{...process.env,SMS_SCENARIO:JSON.stringify(s)}});
  assert.equal(result.status,0,s.name+' process failed: '+result.stderr+' '+result.stdout);
  const state=JSON.parse(await fs.readFile(path.join(dir,'public/paper-state.json'),'utf8'));
  assert.equal(state.status,'OK',s.name);
  assert.equal(state.positions.length,s.open,s.name+' positions');
  assert.equal(state.trades.length,s.trades,s.name+' trades');
  assert.ok(Math.abs(state.cash-s.cash)<0.01,s.name+' cash: '+state.cash);
  if(s.expect==='BUY')assert.ok(state.events.some(e=>e.message.includes('BUY TEST')),s.name);
  else if(s.expect==='lowLiquidity')assert.ok(state.rejections.lowLiquidity>0,s.name);
  else assert.ok(state.events.some(e=>e.message.includes(s.expect)),s.name);
  if(s.name==='gap-through-stop crash')assert.ok(state.trades[0].pnl < -8,'stop loss must not cap gap losses at 10%');
  console.log('PASS '+s.name);
 }
 console.log('All '+scenarios.length+' isolated end-to-end paper scanner simulations passed. No live account files modified.');
}finally{await fs.rm(tmp,{recursive:true,force:true})}
