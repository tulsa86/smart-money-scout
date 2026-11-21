// Read-only IEX coverage audit. No trades, decisions, or repository writes.
import {pathToFileURL} from 'node:url';
import {isRegularMarketDay} from './gamble-market-calendar.mjs';
const SYMBOLS=['SPY','QQQ','NVDA','AMD','TSLA'];
const dayNY=t=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));
const timeNY=t=>new Intl.DateTimeFormat('en-GB',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(t));
const earlyCloseDay=day=>{const d=new Date(day+'T12:00:00Z');const y=d.getUTCFullYear();const thanksgiving=new Date(Date.UTC(y,10,1));thanksgiving.setUTCDate(1+(4-thanksgiving.getUTCDay()+7)%7+21);const friday=new Date(thanksgiving.getTime()+86400000).toISOString().slice(0,10);return day===friday||day===y+'-12-24'||(day===y+'-07-03'&&new Date(Date.UTC(y,6,4)).getUTCDay()!==0)||(day===y+'-07-02'&&new Date(Date.UTC(y,6,4)).getUTCDay()===0)};
const classify=day=>{const dow=new Date(day+'T12:00:00Z').getUTCDay();return dow===0||dow===6?'weekend':earlyCloseDay(day)?'early_close':isRegularMarketDay(day)?'regular':'holiday_or_other_closure'};
export function auditBars(bars){
 const days=new Map();
 for(const b of bars){
  if(!b||!Number.isFinite(Date.parse(b.t))||![b.o,b.c,b.v].every(Number.isFinite)||b.o<=0||b.c<=0||b.v<0)throw Error('Invalid IEX bar');
  const time=timeNY(b.t);
  if(time<'09:30'||time>'15:55')continue;
  const day=dayNY(b.t);
  if(!days.has(day))days.set(day,[]);
  days.get(day).push(b);
 }
 return [...days].sort(([a],[b])=>a.localeCompare(b)).map(([day,rows])=>{
  const times=rows.map(b=>Date.parse(b.t)).sort((a,b)=>a-b);
  const unique=new Set(times);
  const validSlots=times.every(t=>{
   const clock=timeNY(new Date(t).toISOString());
   const minutes=Number(clock.slice(0,2))*60+Number(clock.slice(3));
   return (minutes-(9*60+30))%5===0;
  });
  const completeEdges=timeNY(new Date(times[0]).toISOString())==='09:30'&&timeNY(new Date(times.at(-1)).toISOString())==='15:55';
  const count=unique.size;
  const observedVolume=rows.reduce((n,b)=>n+b.v,0);
  const sessionType=classify(day),regular=sessionType==='regular';
  return {day,sessionType,observedBars:rows.length,uniqueSlots:count,missingSlots:78-count,duplicateSlots:rows.length-count,completeEdges,validSlots,eligible75:regular&&count>=75&&count<=78&&unique.size===rows.length&&completeEdges&&validSlots,eligible78:regular&&count===78&&unique.size===rows.length&&completeEdges&&validSlots,observedVolume};
 });
}
export async function fetchAudit({key,secret,now=new Date(),fetchImpl=fetch,symbols=SYMBOLS}){
 if(!key||!secret)throw Error('Missing Alpaca read-only market-data credentials');
 const end=now.toISOString(),start=new Date(now.getTime()-14*86400000).toISOString();
 const result={source:'Alpaca IEX 5Min',asOf:end,windowStart:start,symbols:{}};
 for(const symbol of symbols){
  if(!/^[A-Z]{1,5}$/.test(symbol))throw Error('Invalid symbol');
  const url=new URL('https://data.alpaca.markets/v2/stocks/'+symbol+'/bars');
  for(const [k,v] of Object.entries({timeframe:'5Min',start,end,feed:'iex',limit:'10000'}))url.searchParams.set(k,v);
  const bars=[];
  for(let page=0;page<10;page++){
   const response=await fetchImpl(url.toString(),{headers:{'APCA-API-KEY-ID':key,'APCA-API-SECRET-KEY':secret}});
   if(!response.ok)throw Error('Alpaca HTTP '+response.status+' for '+symbol);
   const data=await response.json();
   if(!Array.isArray(data.bars))throw Error('Invalid Alpaca response');
   bars.push(...data.bars);
   if(!data.next_page_token)break;
   if(page===9)throw Error('Pagination limit reached');
   url.searchParams.set('page_token',data.next_page_token);
  }
  const rows=auditBars(bars);
  // Report absent dates explicitly; a missing trading day must not disappear from the audit.
  const seen=new Set(rows.map(r=>r.day));
  for(let t=Date.parse(start.slice(0,10)+'T12:00:00Z');t<Date.parse(end.slice(0,10)+'T12:00:00Z');t+=86400000){
   const day=new Date(t).toISOString().slice(0,10),sessionType=classify(day);
   if(!seen.has(day))rows.push({day,sessionType,observedBars:0,uniqueSlots:0,missingSlots:sessionType==='regular'?78:null,duplicateSlots:0,completeEdges:false,validSlots:true,eligible75:false,eligible78:false,observedVolume:0});
  }
  result.symbols[symbol]=rows.filter(r=>r.day<end.slice(0,10)).sort((a,b)=>a.day.localeCompare(b.day));
 }
 return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const report=await fetchAudit({key:process.env.ALPACA_API_KEY_ID,secret:process.env.ALPACA_API_SECRET_KEY});
 // Emit only aggregate coverage diagnostics, never raw bars or credentials.
 console.log(JSON.stringify(report,null,2));
}
