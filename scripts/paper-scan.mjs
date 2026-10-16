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
 const profiles=await json(API+'/token-profiles/latest/v1');
 if(!Array.isArray(profiles))throw Error('Unexpected discovery response');
 const addresses=[...new Set(profiles.filter(p=>p.chainId==='solana'&&typeof p.tokenAddress==='string'&&/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(p.tokenAddress)).map(p=>p.tokenAddress))].slice(0,20);
 if(!addresses.length)return [];
 const pairs=await json(API+'/tokens/v1/solana/'+addresses.join(','));
 if(!Array.isArray(pairs))throw Error('Unexpected pairs response');
 const best=new Map();
 for(const p of pairs){if(p.chainId!=='solana'||!addresses.includes(p.baseToken?.address)||!(finite(p.priceUsd)>0))continue;const id=p.baseToken.address;if(!best.has(id)||(finite(p.liquidity?.usd)??0)>(finite(best.get(id).liquidity?.usd)??0))best.set(id,p)}
 return [...best.values()];
}
async function main(){
 await fs.mkdir('public',{recursive:true});
 let a;try{a=JSON.parse(await fs.readFile(PATH,'utf8'));if(a.version!==1||!Array.isArray(a.positions)||!Array.isArray(a.trades)||!Array.isArray(a.events)||!Number.isFinite(a.cash))throw Error('Invalid state')}catch(e){if(e.code!=='ENOENT')throw e;a=initial()}
 try{
 const pairs=await discover(),quotes=new Map(pairs.map(p=>[p.baseToken.address,p]));
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
 const eligible=pairs.filter(p=>{const price=finite(p.priceUsd),liq=finite(p.liquidity?.usd),vol=finite(p.volume?.h24),h1=finite(p.priceChange?.h1),age=p.pairCreatedAt?(now-p.pairCreatedAt)/86400000:0;return price>0&&liq>=100000&&vol>=liq&&h1>=3&&h1<=25&&age>=7&&!a.positions.some(x=>x.id===p.baseToken.address)&&!a.trades.some(x=>x.id===p.baseToken.address&&now-x.closed<86400000)}).sort((x,y)=>(finite(y.liquidity?.usd)??0)-(finite(x.liquidity?.usd)??0));
 a.checked=pairs.length;a.qualified=eligible.length;
 for(const p of eligible){if(a.positions.length>=3||a.cash<10)break;const price=finite(p.priceUsd),id=p.baseToken.address,symbol=p.baseToken.symbol||id.slice(0,6);a.cash-=10;a.positions.push({id,symbol,units:9.9/price,entry:price,spent:10,opened:now,last:price,lastQuoteAt:now,reason:'Liquidity ≥ $100k; volume ≥ liquidity; 1h +3–25%; age ≥ 7 days'});record(a,'BUY '+symbol+' · $10 paper · all entry rules met')}
 a.status='OK';a.lastCheck=now;record(a,'SCAN '+a.checked+' tokens checked, '+a.qualified+' qualified, '+a.positions.length+' open');
 }catch(e){a.status='ERROR: '+String(e);a.lastCheck=now;record(a,'SCAN ERROR '+String(e));process.exitCode=1}
 a.trades=a.trades.slice(0,300);a.events=a.events.slice(0,100);
 await fs.writeFile(PATH,JSON.stringify(a,null,2)+'\n');
 console.log(a.status+'; checked '+a.checked+'; qualified '+a.qualified+'; open '+a.positions.length+'; cash '+a.cash.toFixed(2));
}
await main();
