import fs from 'node:fs/promises';
const ROOT='public/research';
const HORIZONS=[15,60,240,1440];
const DAY=86400000;
const valid=n=>typeof n==='number'&&Number.isFinite(n);
const numeric=x=>{if(x===null||x===undefined||x==='')return null;const n=Number(x);return Number.isFinite(n)?n:null};
const day=t=>new Date(t).toISOString().slice(0,10);
async function read(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'))}catch(e){if(e.code==='ENOENT')return fallback;throw e}}
async function append(date,file,rows){if(!rows.length)return;const dir=ROOT+'/'+date;await fs.mkdir(dir,{recursive:true});await fs.appendFile(dir+'/'+file,rows.map(x=>JSON.stringify(x)).join('\n')+'\n')}
async function getQuotes(ids,api){const quotes=new Map();let failures=0;for(let i=0;i<ids.length;i+=30){try{const response=await fetch(api+'/tokens/v1/solana/'+ids.slice(i,i+30).join(','),{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('HTTP '+response.status);const pairs=await response.json();if(!Array.isArray(pairs))throw Error('Unexpected response');for(const p of pairs){if(p.chainId!=='solana'||!ids.includes(p.baseToken?.address))continue;const price=numeric(p.priceUsd);if(!(price>0))continue;const previous=quotes.get(p.baseToken.address);if(!previous||(numeric(p.liquidity?.usd)??0)>(numeric(previous.liquidity?.usd)??0))quotes.set(p.baseToken.address,p)}}catch{failures++}}return {quotes,failures}}
export async function captureResearch({pairs,api,now,positions,trades}){
 await fs.mkdir(ROOT,{recursive:true});
 const queuePath=ROOT+'/pending.json',summaryPath=ROOT+'/summary.json';
 const queue=await read(queuePath,[]);
 if(!Array.isArray(queue))throw Error('Invalid research queue');
 const summary=await read(summaryPath,{version:1,observations:0,outcomes:0,complete:0,missing:0,days:0,lastCapture:null});
 const pending=queue.filter(x=>x&&valid(x.time)&&typeof x.id==='string'&&valid(x.price)&&x.price>0&&Array.isArray(x.done));
 // Resolve matured horizons, with a bounded number of additional quote requests.
 const due=pending.filter(x=>HORIZONS.some(h=>!x.done.includes(h)&&now>=x.time+h*60000)).slice(0,120);
 const dueIds=[...new Set(due.map(x=>x.id))];
 const {quotes,failures}=dueIds.length?await getQuotes(dueIds,api):{quotes:new Map(),failures:0};
 const outcomes=[];
 for(const x of due){for(const horizon of HORIZONS){if(x.done.includes(horizon)||now<x.time+horizon*60000)continue;
  const quote=quotes.get(x.id),price=numeric(quote?.priceUsd);
  // Missing prices are recorded as missing, never interpreted as zero return.
  const status=price>0?'observed':'missing';
  outcomes.push({id:x.id,symbol:x.symbol,observedAt:x.time,evaluatedAt:now,horizonMinutes:horizon,entryPrice:x.price,exitPrice:price,returnPct:price>0?(price/x.price-1)*100:null,status,delayMinutes:Math.round((now-x.time-horizon*60000)/60000)});
  x.done.push(horizon);
 }}
 // Four stratified observations per scan: diversify liquidity, age and momentum.
 // Prefer tokens not observed recently, while retaining occasional repeat observations.
 const recent=new Map();
 for(const x of pending){if(!recent.has(x.id)||recent.get(x.id)<x.time)recent.set(x.id,x.time)}
 const candidates=pairs.filter(p=>numeric(p.priceUsd)>0&&p.baseToken?.address);
 const buckets=[[],[],[],[]];
 for(const p of candidates){
  const liq=numeric(p.liquidity?.usd)??0,age=p.pairCreatedAt?(now-p.pairCreatedAt)/DAY:0,momentum=numeric(p.priceChange?.h1)??0;
  const bucket=liq>=100000&&age>=7?0:liq>=100000?1:momentum>=3?2:3;
  buckets[bucket].push(p);
 }
 const score=p=>{const last=recent.get(p.baseToken.address);return last===undefined?Number.MAX_SAFE_INTEGER:now-last};
 for(const bucket of buckets)bucket.sort((a,b)=>score(b)-score(a)||(numeric(b.liquidity?.usd)??0)-(numeric(a.liquidity?.usd)??0)||a.baseToken.address.localeCompare(b.baseToken.address));
 const sampled=[],chosen=new Set();
 for(const bucket of buckets){const p=bucket.find(x=>!chosen.has(x.baseToken.address));if(p&&sampled.length<4){sampled.push(p);chosen.add(p.baseToken.address)}}
 const leftovers=candidates.filter(x=>!chosen.has(x.baseToken.address)).sort((a,b)=>score(b)-score(a)||(numeric(b.liquidity?.usd)??0)-(numeric(a.liquidity?.usd)??0));
 for(const p of leftovers){if(sampled.length>=4)break;sampled.push(p);chosen.add(p.baseToken.address)}
 const observations=sampled.map(p=>({id:p.baseToken.address,symbol:p.baseToken.symbol||p.baseToken.address.slice(0,6),time:now,price:numeric(p.priceUsd),liquidityUsd:numeric(p.liquidity?.usd),volume24hUsd:numeric(p.volume?.h24),change1hPct:numeric(p.priceChange?.h1),change24hPct:numeric(p.priceChange?.h24),pairCreatedAt:numeric(p.pairCreatedAt),source:'dexscreener',sampling:'stratified-recency-v2',schema:2}));
 const fresh=observations.map(x=>({id:x.id,symbol:x.symbol,time:x.time,price:x.price,done:[]}));
 // Append before queue update: if interrupted, at worst duplicate observations, not fabricated outcomes.
 await append(day(now),'observations.ndjson',observations);
 for(const [d,rows] of Map.groupBy(outcomes,x=>day(x.evaluatedAt)))await append(d,'outcomes.ndjson',rows);
 const remaining=pending.filter(x=>x.done.length<HORIZONS.length&&now-x.time<3*DAY);
 await fs.writeFile(queuePath,JSON.stringify([...remaining,...fresh])+'\n');
 const previousDay=summary.lastCapture?day(summary.lastCapture):null;
 summary.observations+=observations.length;summary.outcomes+=outcomes.length;summary.complete+=outcomes.filter(x=>x.status==='observed').length;summary.missing+=outcomes.filter(x=>x.status==='missing').length;summary.days+=(previousDay!==day(now)?1:0);summary.lastCapture=now;summary.pending=remaining.length+fresh.length;summary.quoteBatchFailures=failures;summary.sampledPerScan=4;summary.horizonsMinutes=HORIZONS;
 await fs.writeFile(summaryPath,JSON.stringify(summary,null,2)+'\n');
 return {observations:observations.length,outcomes:outcomes.length,pending:summary.pending,failures};
}
