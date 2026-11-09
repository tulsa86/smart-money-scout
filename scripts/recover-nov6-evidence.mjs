// Historical evidence recovery only. Never edits forward journals or ledgers.
import fs from 'node:fs/promises';
const target='2026-11-06';
const symbols=['SPY','QQQ','NVDA','AMD','TSLA'];
const key=process.env.ALPACA_API_KEY_ID, secret=process.env.ALPACA_API_SECRET_KEY;
if(!key||!secret)throw new Error('Missing Alpaca credentials');
const output='recovery-evidence/'+target;
await fs.mkdir(output,{recursive:true});
const manifest={day:target,kind:'RETROSPECTIVE_MARKET_DATA_ONLY',feed:'Alpaca IEX 5Min',symbols:[],limitations:'Recovered after the session. Not a prospective decision, trade, or settlement.'};
for(const symbol of symbols){
 const url=new URL('https://data.alpaca.markets/v2/stocks/'+symbol+'/bars');
 for(const [k,v] of Object.entries({timeframe:'5Min',start:target+'T00:00:00Z',end:'2026-11-07T00:00:00Z',feed:'iex',limit:'10000'}))url.searchParams.set(k,v);
 const bars=[];
 for(let page=0;page<10;page++){
  const res=await fetch(url,{headers:{'APCA-API-KEY-ID':key,'APCA-API-SECRET-KEY':secret}});
  if(!res.ok)throw new Error(symbol+' HTTP '+res.status);
  const data=await res.json();
  bars.push(...(data.bars||[]));
  if(!data.next_page_token)break;
  if(page===9)throw new Error(symbol+' pagination limit');
  url.searchParams.set('page_token',data.next_page_token);
 }
 const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'});
 const rows=bars.filter(b=>date.format(new Date(b.t))===target&&clock.format(new Date(b.t))>='09:30'&&clock.format(new Date(b.t))<'16:00').map(b=>({time:b.t,open:b.o,high:b.h,low:b.l,close:b.c,volume:b.v}));
 if(rows.length<75||rows.length>78)throw new Error(symbol+' incomplete or unexpected session: '+rows.length);
 for(let i=0;i<rows.length;i++){
  const b=rows[i];
  if(!Number.isFinite(Date.parse(b.time))||(i>0&&Date.parse(b.time)<=Date.parse(rows[i-1].time))||![b.open,b.high,b.low,b.close,b.volume].every(Number.isFinite)||b.low<=0||b.high<Math.max(b.open,b.close,b.low)||b.low>Math.min(b.open,b.close)||b.volume<0)throw new Error(symbol+' invalid bar');
 }
 await fs.writeFile(output+'/'+symbol+'.csv','time,open,high,low,close,volume\n'+rows.map(b=>[b.time,b.open,b.high,b.low,b.close,b.volume].join(',')).join('\n')+'\n');
 manifest.symbols.push({symbol,bars:rows.length,first:rows[0].time,last:rows.at(-1).time});
}
await fs.writeFile(output+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest,null,2));
