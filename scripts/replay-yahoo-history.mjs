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
const result=replayPortfolio(data,1000);
if(result.status!=='ok')throw new Error(result.error||'Replay failed');
const byStrategy={breakout:0,fallback:0};
const byExit={stop:0,target:0,'session-end':0,'end-of-data':0};
for(const entry of result.entries)for(const trade of entry.trades){byStrategy[trade.strategy]++;byExit[trade.reason]++;}
console.log(JSON.stringify({source:'Yahoo Finance 5-minute temporary data',note:'Historical simulation only; not paper orders. No raw Yahoo candles published.',sessions:result.entries.length,trades:result.trades,noTradeDays:result.noTradeDays,startingCash:result.startingCash,endingCash:result.endingCash,returnPct:result.netReturnPct,byStrategy,byExit},null,2));
