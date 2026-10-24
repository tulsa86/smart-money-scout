import {backtestBreakout,type SimTrade} from './backtest.ts';
import {validateCandles,type Candle} from './candles.ts';

export type JournalEntry={day:string;symbol:string;trades:SimTrade[];pnl:number;endingCash:number;note:string};
export type PortfolioReplay={status:'ok'|'invalid';error?:string;startingCash:number;endingCash:number;netReturnPct:number;entries:JournalEntry[];trades:number;noTradeDays:number};
const day=(iso:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));
const money=(n:number)=>Math.round(n*100)/100;
/** Fixed daily rotation across available symbols, decided before each session.
 * One stock/day and one shared cash account; avoids retrospective stock picking,
 * simultaneous positions, and double-counting the same $1,000.
 */
export function replayPortfolio(data:Record<string,readonly Candle[]>,startingCash=1000):PortfolioReplay{
 const fail=(error:string):PortfolioReplay=>({status:'invalid',error,startingCash,endingCash:startingCash,netReturnPct:0,entries:[],trades:0,noTradeDays:0});
 if(!Number.isFinite(startingCash)||startingCash<=0)return fail('Invalid starting cash');
 const symbols=Object.keys(data).sort();
 if(!symbols.length)return fail('No stock data loaded');
 const grouped=new Map<string,Map<string,Candle[]>>();
 const days=new Set<string>();
 for(const symbol of symbols){
  const candles=data[symbol];
  const error=validateCandles(candles);
  if(error)return fail(symbol+': '+error);
  const sessions=new Map<string,Candle[]>();
  for(const c of candles){const d=day(c.time);if(!sessions.has(d))sessions.set(d,[]);sessions.get(d)!.push(c);days.add(d);}
  grouped.set(symbol,sessions);
 }
 let cash=startingCash,trades=0,noTradeDays=0;
 const entries:JournalEntry[]=[];
 for(const [index,d] of [...days].sort().entries()){
  // Choose the next available symbol in a deterministic predeclared rotation.
  const available=symbols.filter(s=>grouped.get(s)!.has(d));
  if(!available.length)continue;
  const symbol=available[index%available.length];
  const all=data[symbol],first=all.findIndex(c=>day(c.time)===d);
  const session=grouped.get(symbol)!.get(d)!;
  const warmup=all.slice(Math.max(0,first-20),first);
  const result=backtestBreakout([...warmup,...session],{startingCash:cash,dailyTradeTarget:true});
  if(result.status==='invalid'){
   entries.push({day:d,symbol,trades:[],pnl:0,endingCash:money(cash),note:'Insufficient valid warmup data; no trade'});
   noTradeDays++;continue;
  }
  const pnl=result.endingCash-cash;
  cash=result.endingCash;trades+=result.trades.length;
  if(!result.trades.length)noTradeDays++;
  entries.push({day:d,symbol,trades:result.trades,pnl:money(pnl),endingCash:money(cash),note:result.trades.length?'Historical replay':'No qualifying trade'});
 }
 return {status:'ok',startingCash,endingCash:money(cash),netReturnPct:money((cash/startingCash-1)*100),entries,trades,noTradeDays};
}
