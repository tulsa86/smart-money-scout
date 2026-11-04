// Read-only Alpaca IEX retrieval for a previously committed MVP decision.
// This adapter cannot place orders or modify the ledger.
import {completedMvpEvidence} from './gamble-mvp-market-evidence.mjs';
export async function fetchMvpSessionEvidence({symbol,targetSession,key,secret,availableAt,fetchImpl=fetch}){
 if(!key||!secret||!/^\d{4}-\d{2}-\d{2}$/.test(targetSession)||!/^[A-Z]{1,5}$/.test(symbol)||!Number.isFinite(Date.parse(availableAt)))throw Error('Invalid Alpaca MVP request');
 const start=targetSession+'T00:00:00Z';
 const end=new Date(Date.parse(start)+2*86400000).toISOString();
 const url=new URL('https://data.alpaca.markets/v2/stocks/'+symbol+'/bars');
 for(const [k,v] of Object.entries({timeframe:'5Min',start,end,feed:'iex',limit:'10000'}))url.searchParams.set(k,v);
 const bars=[];
 for(let page=0;page<10;page++){
  const response=await fetchImpl(url.toString(),{headers:{'APCA-API-KEY-ID':key,'APCA-API-SECRET-KEY':secret}});
  if(!response.ok)throw Error('Alpaca MVP HTTP '+response.status);
  const body=await response.json();
  if(!Array.isArray(body.bars))throw Error('Alpaca MVP bars missing');
  bars.push(...body.bars);
  if(!body.next_page_token)break;
  if(page===9)throw Error('Alpaca MVP pagination incomplete');
  url.searchParams.set('page_token',body.next_page_token);
 }
 const nyDay=x=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(x));
 const nyClock=x=>new Intl.DateTimeFormat('en-GB',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(x));
 const sessionBars=bars.filter(b=>Number.isFinite(Date.parse(b.t))&&nyDay(b.t)===targetSession&&nyClock(b.t)>='09:30'&&nyClock(b.t)<='15:55');
 return completedMvpEvidence({symbol,targetSession,bars:sessionBars,availableAt});
}
