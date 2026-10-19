import {captureResearch} from './research-capture.mjs';
import fs from 'node:fs/promises';
const PATH='public/paper-state.json';
const API='https://api.dexscreener.com';
const FEE=0.01;
const now=Date.now();
const initial=()=>({version:1,cash:100,positions:[],trades:[],events:[],lastCheck:null,checked:0,qualified:0,status:'Not started'});
const finite=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const record=(a,message)=>a.events.unshift({time:now,message});
async function json(url){const response=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('HTTP '+response.status+' for '+url.split('?')[0]);return response.json()}
async function discover(){
 // Combine several public discovery feeds; none is a complete market-wide listing.
 const feeds=['/token-profiles/latest/v1','/token-boosts/latest/v1','/token-boosts/top/v1'];
 const results=await Promise.allSettled(feeds.map(f=>json(API+f)));
 const addresses=new Set();
 const sources=[];
 const feedStats=[];
 for(let i=0;i<results.length;i++){
  const result=results[i];
  if(result.status!=='fulfilled'||!Array.isArray(result.value)){sources.push(feeds[i]+': unavailable');feedStats.push({feed:feeds[i],unavailable:true,listings:0,uniqueAdded:0});continue}
  let count=0,newMints=0;
  for(const p of result.value){if(p.chainId==='solana'&&typeof p.tokenAddress==='string'&&/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(p.tokenAddress)){if(!addresses.has(p.tokenAddress))newMints++;addresses.add(p.tokenAddress);count++}}
  feedStats.push({feed:feeds[i],listings:count,uniqueAdded:newMints});
  sources.push(feeds[i]+': '+count+' Solana listings');
 }
 if(!addresses.size)throw Error('No valid tokens from discovery feeds: '+sources.join('; '));
 // DEX Screener supports up to 30 token addresses per request.
 const mints=[...addresses].slice(0,180);
 const batches=[];for(let i=0;i<mints.length;i+=30)batches.push(mints.slice(i,i+30));
 const responses=await Promise.allSettled(batches.map(group=>json(API+'/tokens/v1/solana/'+group.join(','))));
 const best=new Map();
 let goodBatches=0;
 for(let i=0;i<responses.length;i++){
  const response=responses[i];if(response.status!=='fulfilled'||!Array.isArray(response.value))continue;
  goodBatches++;
  for(const p of response.value){
   if(p.chainId!=='solana'||!batches[i].includes(p.baseToken?.address)||!(finite(p.priceUsd)>0))continue;
   const id=p.baseToken.address;
   if(!best.has(id)||(finite(p.liquidity?.usd)??0)>(finite(best.get(id).liquidity?.usd)??0))best.set(id,p);
  }
 }
 if(!goodBatches)throw Error('All quote batches failed');
 return {pairs:[...best.values()],discovery:{sources,feedStats,uniqueMints:addresses.size,requested:mints.length,excludedByCap:Math.max(0,addresses.size-mints.length),quotedTokens:best.size,unquotedTokens:mints.length-best.size,quoteBatches:goodBatches,totalBatches:batches.length}};
}
function diagnose(pairs,positions,trades){
 const reasons={invalidPrice:0,lowLiquidity:0,lowVolume:0,momentum:0,tooNew:0,alreadyHeld:0,cooldown:0};
 const passed=[];
 for(const p of pairs){
  const id=p.baseToken?.address,price=finite(p.priceUsd),liq=finite(p.liquidity?.usd),vol=finite(p.volume?.h24),h1=finite(p.priceChange?.h1),age=p.pairCreatedAt?(now-p.pairCreatedAt)/86400000:null;
  // Count every failed condition; counts overlap and must not be summed.
  let valid=true;
  const fail=(key)=>{reasons[key]++;valid=false};
  if(!(price>0))fail('invalidPrice');
  if(!(liq>=100000))fail('lowLiquidity');
  if(!(vol!==null&&liq!==null&&vol>=liq))fail('lowVolume');
  if(!(h1!==null&&h1>=3&&h1<=25))fail('momentum');
  if(!(age!==null&&age>=7))fail('tooNew');
  if(positions.some(x=>x.id===id))fail('alreadyHeld');
  if(trades.some(x=>x.id===id&&now-x.closed<86400000))fail('cooldown');
  if(valid)passed.push(p);
 }
 return {reasons,passed:passed.sort((x,y)=>(finite(y.liquidity?.usd)??0)-(finite(x.liquidity?.usd)??0))};
}
async function main(){
 await fs.mkdir('public',{recursive:true});
 let a;try{a=JSON.parse(await fs.readFile(PATH,'utf8'));if(a.version!==1||!Array.isArray(a.positions)||!Array.isArray(a.trades)||!Array.isArray(a.events)||!Number.isFinite(a.cash))throw Error('Invalid state')}catch(e){if(e.code!=='ENOENT')throw e;a=initial()}
 try{
 const {pairs,discovery}=await discover(),quotes=new Map(pairs.map(p=>[p.baseToken.address,p]));
 a.discovery=discovery;
 try{const research=await captureResearch({pairs,api:API,now,positions:a.positions,trades:a.trades});record(a,'RESEARCH '+research.observations+' snapshots, '+research.outcomes+' outcomes, '+research.pending+' pending')}catch(e){record(a,'RESEARCH ERROR '+String(e));console.error('Research capture failed:',e);process.exitCode=1}
 const remaining=[];
 for(const pos of a.positions){
  let q=quotes.get(pos.id);
  // The latest-profiles discovery feed drops tokens; query held mints directly.
  if(!q){try{const held=await json(API+'/tokens/v1/solana/'+pos.id);if(Array.isArray(held))q=held.filter(p=>p.chainId==='solana'&&p.baseToken?.address===pos.id).sort((x,y)=>(finite(y.liquidity?.usd)??0)-(finite(x.liquidity?.usd)??0))[0]}catch(e){record(a,'Quote unavailable for '+pos.symbol+': '+String(e))}}
  const price=finite(q?.priceUsd);
  if(!(price>0)){remaining.push(pos);record(a,'No valid quote for '+pos.symbol+'; position held');continue}
  const proceeds=pos.units*price*(1-FEE),returnPct=(proceeds-pos.spent)/pos.spent;
  const reason=returnPct<=-.10?'Stop loss':returnPct>=.20?'Take profit':now-pos.opened>=86400000?'24-hour time exit':'';
  if(reason){a.cash+=proceeds;a.trades.unshift({id:pos.id,symbol:pos.symbol,entry:pos.entry,exit:price,spent:pos.spent,received:proceeds,pnl:proceeds-pos.spent,opened:pos.opened,closed:now,reason});record(a,'SELL '+pos.symbol+' · '+reason+' · P/L $'+(proceeds-pos.spent).toFixed(2))}
  else remaining.push({...pos,last:price,lastQuoteAt:now});
 }
 a.positions=remaining;
 const {reasons,passed:eligible}=diagnose(pairs,a.positions,a.trades);
 a.rejections=reasons;
 a.checked=pairs.length;a.qualified=eligible.length;
 for(const p of eligible){if(a.positions.length>=3||a.cash<10)break;const price=finite(p.priceUsd),id=p.baseToken.address,symbol=p.baseToken.symbol||id.slice(0,6);a.cash-=10;a.positions.push({id,symbol,units:9.9/price,entry:price,spent:10,opened:now,last:price,lastQuoteAt:now,reason:'Liquidity ≥ $100k; volume ≥ liquidity; 1h +3–25%; age ≥ 7 days'});record(a,'BUY '+symbol+' · $10 paper · all entry rules met')}
 a.status='OK';a.lastCheck=now;record(a,'SCAN '+a.checked+' tokens checked, '+a.qualified+' qualified, '+a.positions.length+' open · rejection counts: '+Object.entries(reasons).map(([k,v])=>k+' '+v).join(', '));
 }catch(e){a.status='ERROR: '+String(e);a.lastCheck=now;record(a,'SCAN ERROR '+String(e));process.exitCode=1}
 a.trades=a.trades.slice(0,300);a.events=a.events.slice(0,100);
 await fs.writeFile(PATH,JSON.stringify(a,null,2)+'\n');
 console.log(a.status+'; checked '+a.checked+'; qualified '+a.qualified+'; open '+a.positions.length+'; cash '+a.cash.toFixed(2));
}
await main();
