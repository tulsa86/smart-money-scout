// Alpaca IEX 5-minute adapter. Read-only market data; records retrieval time as availability.
import {planGamblePresession} from './gamble-presession-planner.mjs';
const nyDay=x=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(x));
const nyClock=x=>new Intl.DateTimeFormat('en-GB',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(x));
const validTime=x=>typeof x==='string'&&/(Z|[+-]\d{2}:\d{2})$/.test(x)&&Number.isFinite(Date.parse(x));
export async function collectGamblePresession({key,secret,targetSession,now=new Date().toISOString(),fetchImpl=fetch,clock=()=>new Date().toISOString(),symbols=['SPY','QQQ','NVDA','AMD','TSLA']}){
 if(!key||!secret||!validTime(now)||!/^\d{4}-\d{2}-\d{2}$/.test(targetSession)||nyDay(now)>=targetSession||!Array.isArray(symbols)||symbols.length<1||new Set(symbols).size!==symbols.length)throw Error('Invalid prospective collection inputs');
 const observations=[];
 let commonLatest=null;
 for(const symbol of symbols){
  if(!/^[A-Z]{1,5}$/.test(symbol))throw Error('Invalid symbol');
  const start=new Date(Date.parse(now)-14*86400000).toISOString();
  const url=new URL('https://data.alpaca.markets/v2/stocks/'+symbol+'/bars');
  for(const [k,v] of Object.entries({timeframe:'5Min',start,end:now,feed:'iex',limit:'10000'}))url.searchParams.set(k,v);
  const bars=[];
  for(let page=0;page<10;page++){
   const response=await fetchImpl(url.toString(),{headers:{'APCA-API-KEY-ID':key,'APCA-API-SECRET-KEY':secret}});
   if(!response.ok)throw Error('Alpaca HTTP '+response.status+' for '+symbol);
   const data=await response.json();
   if(!Array.isArray(data.bars))throw Error('Missing Alpaca bars');
   bars.push(...data.bars);
   if(!data.next_page_token)break;
   if(page===9)throw Error('Alpaca pagination incomplete');
   url.searchParams.set('page_token',data.next_page_token);
  }
  const byDay=new Map();
  for(const b of bars){
   if(!validTime(b.t)||![b.o,b.c,b.v].every(Number.isFinite)||b.o<=0||b.c<=0||b.v<0)throw Error('Invalid Alpaca bar');
   if(nyDay(b.t)>=targetSession)throw Error('Target-session data would leak into decision');
   if(Date.parse(b.t)>Date.parse(now))throw Error('Future Alpaca bar');
   const clock=nyClock(b.t);if(clock<'09:30'||clock>'15:55')continue;
   const day=nyDay(b.t);if(day>=targetSession)throw Error('Target-session data would leak into decision');
   if(!byDay.has(day))byDay.set(day,[]);
   byDay.get(day).push(b);
  }
  const completed=[...byDay.entries()].filter(([,v])=>v.length===78&&new Set(v.map(b=>b.t)).size===78&&v.some(b=>nyClock(b.t)==='09:30')&&v.some(b=>nyClock(b.t)==='15:55')).sort((a,b)=>a[0].localeCompare(b[0]));
  if(completed.length<2)throw Error('Insufficient complete prior sessions for '+symbol);
  const [session,latest]=completed.at(-1);
  if(commonLatest!==null&&session!==commonLatest)throw Error('Symbols do not share latest completed session');
  commonLatest=session;
  latest.sort((a,b)=>Date.parse(a.t)-Date.parse(b.t));
  const previous=completed.slice(0,-1).map(([,v])=>v.reduce((n,b)=>n+b.v,0));
  const meanPriorVolume=previous.reduce((a,b)=>a+b,0)/previous.length;
  if(meanPriorVolume<=0)throw Error('Invalid prior volume baseline');
  observations.push({symbol,sessionCloseAt:latest.at(-1).t,availableAt:null,open:latest[0].o,close:latest.at(-1).c,volume:latest.reduce((n,b)=>n+b.v,0),meanPriorVolume});
 }
 // Fail closed unless the latest completed session was the most recent New York date before target.
 // A market holiday/weekend is allowed; stale data older than four calendar days is not.
 if((Date.parse(targetSession+'T00:00:00Z')-Date.parse(commonLatest+'T00:00:00Z'))/86400000>4)throw Error('Stale completed session');
 const collectedAt=clock();
 if(!validTime(collectedAt)||Date.parse(collectedAt)<Date.parse(now)||nyDay(collectedAt)>=targetSession)throw Error('Collection completed too late');
 for(const observation of observations)observation.availableAt=collectedAt;
 return {source:'Alpaca IEX 5Min read-only collection (five-symbol fixed universe)',sourceFetchedAt:collectedAt,observations};
}
export async function collectAndPlanGamble(rows,options){
 const evidence=await collectGamblePresession(options);
 return planGamblePresession(rows,{...evidence,targetSession:options.targetSession,recordedAt:evidence.sourceFetchedAt,bankrollCents:options.bankrollCents??100000});
}
