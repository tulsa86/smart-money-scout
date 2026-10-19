import fs from 'node:fs/promises';
const OUT='public/research/discovery-comparison.json';
const API='https://api.dexscreener.com';
const GECKO='https://api.geckoterminal.com/api/v2/networks/solana/trending_pools?page=1';
const now=Date.now();
const number=x=>x===null||x===undefined||x===''?null:(Number.isFinite(Number(x))?Number(x):null);
async function get(url){const r=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('HTTP '+r.status);return r.json()}
const feeds=['/token-profiles/latest/v1','/token-boosts/latest/v1','/token-boosts/top/v1'];
const base58=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
async function candidates(){
 const results=await Promise.allSettled(feeds.map(f=>get(API+f)));
 const ids=new Set(),errors=[];
 for(let i=0;i<results.length;i++){
  const r=results[i];if(r.status!=='fulfilled'||!Array.isArray(r.value)){errors.push(feeds[i]+': unavailable');continue}
  for(const p of r.value)if(p.chainId==='solana'&&base58.test(p.tokenAddress||''))ids.add(p.tokenAddress);
 }
 return {ids,errors};
}
async function quotes(ids){
 const list=[...ids],out=new Map(),errors=[];
 for(let i=0;i<list.length;i+=30){
  try{const data=await get(API+'/tokens/v1/solana/'+list.slice(i,i+30).join(','));
   if(!Array.isArray(data))throw Error('unexpected quote response');
   for(const p of data)if(p.chainId==='solana'&&ids.has(p.baseToken?.address)&&number(p.priceUsd)>0){
    const id=p.baseToken.address;
    if(!out.has(id)||(number(p.liquidity?.usd)??0)>(number(out.get(id).liquidity?.usd)??0))out.set(id,p);
   }
  }catch(e){errors.push(String(e))}
 }
 return {out,errors};
}
function qualify({price,liquidity,volume,change,created}){
 const age=created===null?null:(now-created)/86400000;
 return price!==null&&price>0&&liquidity!==null&&liquidity>=100000&&volume!==null&&volume>=liquidity&&change!==null&&change>=3&&change<=25&&age!==null&&age>=7;
}
function dexMetrics(p){return {price:number(p.priceUsd),liquidity:number(p.liquidity?.usd),volume:number(p.volume?.h24),change:number(p.priceChange?.h1),created:number(p.pairCreatedAt)}}
function geckoMetrics(p){
 const a=p.attributes||{},v=a.volume_usd||{},changes=a.price_change_percentage||{};
 const date=Date.parse(a.pool_created_at||'');
 return {price:number(a.base_token_price_usd),liquidity:number(a.reserve_in_usd),volume:number(v.h24),change:number(changes.h1),created:Number.isFinite(date)?date:null};
}
const report={generatedAt:new Date(now).toISOString(),experiment:'read-only discovery comparison; no trades or research outcomes',sources:{}};
const old=await candidates();
const baseline=await quotes(old.ids);
const baselinePairs=[...baseline.out.values()];
report.sources.promotional={discovered:old.ids.size,quoted:baselinePairs.length,eligible:baselinePairs.filter(p=>qualify(dexMetrics(p))).length,errors:[...old.errors,...baseline.errors]};
try{
 const response=await get(GECKO);
 if(!Array.isArray(response.data))throw Error('missing pools array');
 const pools=response.data;
 const mintIds=new Set();
 for(const p of pools){const id=p.relationships?.base_token?.data?.id||'';const mint=id.startsWith('solana_')?id.slice(7):'';if(base58.test(mint))mintIds.add(mint)}
 const overlap=[...mintIds].filter(x=>old.ids.has(x)).length;
 const directEligible=pools.filter(p=>qualify(geckoMetrics(p))).length;
 const matched=await quotes(mintIds);
 const comparable=[...matched.out.values()];
 report.sources.trendingPools={endpoint:GECKO,pools:pools.length,baseTokens:mintIds.size,overlapWithPromotional:overlap,geckoEligiblePools:directEligible,dexQuotedTokens:comparable.length,dexEligibleTokens:comparable.filter(p=>qualify(dexMetrics(p))).length,errors:matched.errors};
}catch(e){report.sources.trendingPools={endpoint:GECKO,error:String(e)}}
await fs.mkdir('public/research',{recursive:true});
await fs.writeFile(OUT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
