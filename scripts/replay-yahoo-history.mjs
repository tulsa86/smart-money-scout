import fs from 'node:fs';
import {parseCandleCsv} from '../src/stocks/csv.ts';
import {replayPortfolio} from '../src/stocks/portfolio.ts';
const folder=process.argv[2];
if(!folder)throw new Error('Missing temporary candle directory');
const symbols=['SPY','QQQ','NVDA','AMD','TSLA'];
const data={};
for(const symbol of symbols){
 const parsed=parseCandleCsv(fs.readFileSync(folder+'/'+symbol+'.csv','utf8'));
 if(parsed.error)throw new Error(symbol+': '+parsed.error);
 data[symbol]=parsed.candles;
}
const result=replayPortfolio(data,1000,'prior-session-momentum');
const baseline=replayPortfolio(data,1000,'rotation');
if(result.status!=='ok')throw new Error(result.error||'Replay failed');
const byStrategy={breakout:0,fallback:0};
const byExit={stop:0,target:0,'session-end':0,'end-of-data':0};
for(const entry of result.entries)for(const trade of entry.trades){byStrategy[trade.strategy]++;byExit[trade.reason]++;}
function stats(replay){
 const trades=replay.entries.flatMap(e=>e.trades);
 const winners=trades.filter(t=>t.netPnl>0),losers=trades.filter(t=>t.netPnl<0);
 const grossWin=winners.reduce((n,t)=>n+t.netPnl,0),grossLoss=losers.reduce((n,t)=>n+t.netPnl,0);
 let peak=replay.startingCash,maxDrawdownPct=0;
 const weekly=new Map();
 let prevCash=replay.startingCash;
 for(const e of replay.entries){
  peak=Math.max(peak,e.endingCash);
  maxDrawdownPct=Math.max(maxDrawdownPct,(peak-e.endingCash)/peak*100);
  const date=new Date(e.day+'T12:00:00Z');
  const weekday=(date.getUTCDay()+6)%7;
  const monday=new Date(date.getTime()-weekday*86400000).toISOString().slice(0,10);
  const existing=weekly.get(monday)||{weekOf:monday,startingCash:prevCash,endingCash:prevCash,trades:0};
  existing.endingCash=e.endingCash;existing.trades+=e.trades.length;
  weekly.set(monday,existing);prevCash=e.endingCash;
 }
 const weeks=[...weekly.values()].map(w=>({...w,pnl:Number((w.endingCash-w.startingCash).toFixed(2)),returnPct:Number(((w.endingCash/w.startingCash-1)*100).toFixed(3))}));
 return {winCount:winners.length,lossCount:losers.length,flatCount:trades.length-winners.length-losers.length,winRatePct:trades.length?Number((100*winners.length/trades.length).toFixed(2)):null,averageTradePnl:trades.length?Number((trades.reduce((n,t)=>n+t.netPnl,0)/trades.length).toFixed(4)):null,grossProfit:Number(grossWin.toFixed(2)),grossLoss:Number(grossLoss.toFixed(2)),profitFactor:grossLoss<0?Number((grossWin/-grossLoss).toFixed(3)):null,bestTradePnl:trades.length?Number(Math.max(...trades.map(t=>t.netPnl)).toFixed(2)):null,worstTradePnl:trades.length?Number(Math.min(...trades.map(t=>t.netPnl)).toFixed(2)):null,maxSessionCloseDrawdownPct:Number(maxDrawdownPct.toFixed(3)),positiveWeeks:weeks.filter(w=>w.pnl>0).length,negativeWeeks:weeks.filter(w=>w.pnl<0).length,weeks};
}
function spyBenchmark(candles,startingCash){
 const first=candles[0],last=candles.at(-1);
 const shares=Math.floor(startingCash/first.open);
 const cashRemainder=startingCash-shares*first.open;
 const endingCash=cashRemainder+shares*last.close;
 return {method:'Buy whole SPY shares at first session open; hold through last session close; no dividends, fees, or slippage',firstTime:first.time,lastTime:last.time,shares,uninvestedCash:Number(cashRemainder.toFixed(2)),endingCash:Number(endingCash.toFixed(2)),returnPct:Number(((endingCash/startingCash-1)*100).toFixed(3))};
}
const selectedStats=stats(result),baselineStats=stats(baseline),spy=spyBenchmark(data.SPY,1000);
console.log(JSON.stringify({source:'Yahoo Finance 5-minute temporary data',note:'Historical simulation only; not paper orders. No raw Yahoo candles published.',sessions:result.entries.length,trades:result.trades,noTradeDays:result.noTradeDays,startingCash:result.startingCash,endingCash:result.endingCash,returnPct:result.netReturnPct,byStrategy,byExit,performance:selectedStats,baseline:{sessions:baseline.entries.length,trades:baseline.trades,endingCash:baseline.endingCash,returnPct:baseline.netReturnPct,performance:baselineStats},spyBuyAndHold:spy,selection:'Prior-session momentum and relative volume; no same-day stock-selection lookahead',limitations:'In-sample only. Weekly and drawdown use session-ending cash, not intraday mark-to-market. SPY benchmark excludes dividends and transaction costs. Simulated fill assumptions may not reflect actual execution.'},null,2));
