const symbols=['SPY','QQQ','NVDA','AMD','TSLA'];
const key=process.env.ALPACA_API_KEY_ID,secret=process.env.ALPACA_API_SECRET_KEY;
if(!key||!secret)throw new Error('Missing Alpaca API credentials in GitHub Actions secrets');
const fs=await import('node:fs/promises');
const end=new Date(Date.now()-20*60_000),start=new Date(end.getTime()-7*86400_000);
const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'});
const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
await fs.mkdir('public/stocks/intraday',{recursive:true});
const manifest={source:'Alpaca IEX',feed:'iex',timeframe:'5Min',fetchedAt:new Date().toISOString(),symbols:[],limitations:'Single-exchange volume, not consolidated US market. Historical simulation only.'};
for(const symbol of symbols){
 let url=new URL('https://data.alpaca.markets/v2/stocks/'+symbol+'/bars');
 url.searchParams.set('timeframe','5Min');url.searchParams.set('start',start.toISOString());url.searchParams.set('end',end.toISOString());url.searchParams.set('feed','iex');url.searchParams.set('limit','10000');
 const bars=[];
 for(let page=0;page<10;page++){
  const response=await fetch(url,{headers:{'APCA-API-KEY-ID':key,'APCA-API-SECRET-KEY':secret}});
  if(!response.ok)throw new Error(symbol+' API HTTP '+response.status+': '+(await response.text()).slice(0,200));
  const data=await response.json();
  bars.push(...(data.bars||[]));
  if(!data.next_page_token)break;
  if(page===9)throw new Error(symbol+' pagination exceeded limit');
  url.searchParams.set('page_token',data.next_page_token);
 }
 const rows=bars.filter(b=>{const d=new Date(b.t);const weekday=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short'}).format(d);const hm=clock.format(d);return weekday!=='Sat'&&weekday!=='Sun'&&hm>='09:30'&&hm<'16:00';}).map(b=>({time:b.t,open:b.o,high:b.h,low:b.l,close:b.c,volume:b.v}));
 for(let i=0;i<rows.length;i++){
  const b=rows[i];
  if(!Number.isFinite(Date.parse(b.time))||i&&Date.parse(b.time)<=Date.parse(rows[i-1].time)||![b.open,b.high,b.low,b.close,b.volume].every(Number.isFinite)||b.low<=0||b.high<Math.max(b.open,b.close,b.low)||b.low>Math.min(b.open,b.close)||b.volume<0)throw new Error(symbol+' invalid candle');
 }
 if(rows.length<22)throw new Error(symbol+' insufficient regular-session candles: '+rows.length);
 const csv='time,open,high,low,close,volume\n'+rows.map(b=>[b.time,b.open,b.high,b.low,b.close,b.volume].join(',')).join('\n')+'\n';
 await fs.writeFile('public/stocks/intraday/'+symbol+'.csv',csv);
 manifest.symbols.push({symbol,bars:rows.length,first:rows[0].time,last:rows.at(-1).time});
 console.log(symbol,rows.length,day.format(new Date(rows.at(-1).time)));
}
await fs.writeFile('public/stocks/intraday/manifest.json',JSON.stringify(manifest,null,2)+'\n');
