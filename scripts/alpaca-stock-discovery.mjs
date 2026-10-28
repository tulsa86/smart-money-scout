import {discoverStocks,planStockDecisions} from './stock-discovery.mjs';
const BASE='https://data.alpaca.markets';
const validTime=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&/(Z|[+-]\d\d:\d\d)$/.test(x);
async function json(path,{key,secret,fetchImpl}) {
 const r=await fetchImpl(BASE+path,{headers:{'APCA-API-KEY-ID':key,'APCA-API-SECRET-KEY':secret,accept:'application/json'},signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error('Alpaca data HTTP '+r.status);
 return r.json();
}
// Alpaca's most-active screener is a limited discovery feed, NOT complete market coverage.
// Daily bars are deliberately used only after the UTC date has advanced beyond the bar's date.
export async function fetchAlpacaStockSnapshot({key,secret,decisionAt,fetchImpl=fetch,top=20}={}) {
 if(!key||!secret||!validTime(decisionAt)||!Number.isInteger(top)||top<1||top>20)throw Error('Valid Alpaca credentials, decision time, and top<=20 required');
 const active=await json('/v1beta1/screener/stocks/most-actives?by=volume&top='+top,{key,secret,fetchImpl});
 if(!Array.isArray(active.most_actives))throw Error('Missing Alpaca most_actives');
 const symbols=[...new Set(active.most_actives.map(x=>x.symbol).filter(x=>typeof x==='string'&&/^[A-Z]{1,5}(?:[.-][A-Z])?$/.test(x)))];
 if(!symbols.length)throw Error('No valid Alpaca most-active stock symbols');
 const until=new Date(decisionAt).toISOString().slice(0,10);
 const start=new Date(Date.parse(until+'T00:00:00Z')-10*86400000).toISOString();
 const rows=[];
 for(const symbol of symbols){
  const params=new URLSearchParams({symbols:symbol,timeframe:'1Day',start,end:decisionAt,limit:'20',adjustment:'raw',feed:'iex'});
  const result=await json('/v2/stocks/bars?'+params,{key,secret,fetchImpl});
  if(result.next_page_token)throw Error('Unexpected paginated daily bars for '+symbol);
  const bars=result.bars?.[symbol];
  if(!Array.isArray(bars))throw Error('Missing daily bars for '+symbol);
  const completed=bars.filter(b=>validTime(b.t)&&b.t.slice(0,10)<until&&Number.isFinite(b.c)&&b.c>0&&Number.isFinite(b.v)&&b.v>=0).sort((a,b)=>Date.parse(a.t)-Date.parse(b.t));
  if(completed.length<2)continue;
  const latest=completed.at(-1),previous=completed.at(-2);
  rows.push({symbol,close:latest.c,volume:latest.v,previousClose:previous.c,observedAt:latest.t});
 }
 if(!rows.length)throw Error('No eligible completed daily bars; refusing empty success');
 return {source:'Alpaca most-actives volume + Alpaca IEX 1Day bars; limited feed',asOf:decisionAt,rows,discoveryMeta:{feed:'iex',mostActiveSymbols:symbols.length,barEligibleSymbols:rows.length,completeMarketCoverage:false}};
}
export async function produceAlpacaDecision(options){
 const snapshot=await fetchAlpacaStockSnapshot(options);
 const discovery=discoverStocks(snapshot);
 const decision=planStockDecisions(discovery,{decisionAt:options.decisionAt,cashCents:options.cashCents??100000});
 return {discovery,decision};
}
