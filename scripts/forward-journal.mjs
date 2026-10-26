import fs from 'node:fs';
import {parseCandleCsv} from '../src/stocks/csv.ts';
import {replayPortfolio} from '../src/stocks/portfolio.ts';
const symbols=['SPY','QQQ','NVDA','AMD','TSLA'],data={};
for(const symbol of symbols){
 const parsed=parseCandleCsv(fs.readFileSync('public/stocks/intraday/'+symbol+'.csv','utf8'));
 if(parsed.error)throw new Error(symbol+': '+parsed.error);
 data[symbol]=parsed.candles;
}
const replay=replayPortfolio(data,1000,'prior-session-momentum');
if(replay.status!=='ok')throw new Error(replay.error);
const dates=symbols.map(s=>new Set(data[s].map(c=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(c.time)))));
const common=[...dates[0]].filter(d=>dates.every(set=>set.has(d))).sort();
const target=common.at(-1);
if(!target)throw new Error('No common sessions');
const entries=replay.entries.filter(e=>e.day===target);
if(entries.length!==1)throw new Error('Missing latest session result');
const entry=entries[0];
const fullSession=symbols.every(s=>data[s].filter(c=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(c.time))===target).length>=75);
if(!fullSession)throw new Error('Latest session appears incomplete; skipping forward evaluation');
const spyBars=data.SPY.filter(c=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(c.time))===target);
const spyClose=spyBars.at(-1).close;
const record={day:target,spyClose,source:'Alpaca IEX five-minute candles',mode:'prior-session-momentum',symbol:entry.symbol,decision:entry.symbol==='NONE'?'no-eligible-stock':entry.trades.length?'simulated-trade':'no-signal',note:entry.note,trades:entry.trades,pnl:entry.pnl,limitations:'Research-only replay; no orders. IEX volume is not consolidated. Rolling-window cash and PnL are not cumulative forward returns.'};
const path='public/stocks/forward-journal.json';
let journal=[];
if(fs.existsSync(path)){const old=JSON.parse(fs.readFileSync(path,'utf8'));if(!Array.isArray(old))throw new Error('Invalid forward journal');journal=old;}
if(journal.some(r=>r.day===target)){console.log('Already recorded '+target+'; existing observation preserved');process.exit(0);}
if(journal.length&&target<=journal.at(-1).day)throw new Error('Non-monotonic forward journal date');
// Keep the original daily $1,000-sized simulation intact; cumulative P&L is fixed-size, not compounded.
const cumulativePnl=journal.reduce((sum,r)=>sum+(Number.isFinite(r.pnl)?r.pnl:0),0)+record.pnl;
record.fixedSizeCumulativePnl=Number(cumulativePnl.toFixed(2));
record.fixedSizeIllustrativeBalance=Number((1000+cumulativePnl).toFixed(2));
// The first observed SPY close is the benchmark anchor, not an invented entry price.
const anchor=journal.find(r=>Number.isFinite(r.spyClose));
record.spyReturnSinceAnchorPct=anchor?Number(((spyClose/anchor.spyClose-1)*100).toFixed(4)):0;
journal.push(record);
fs.writeFileSync(path,JSON.stringify(journal,null,2)+'\n');
console.log(JSON.stringify({appended:record,totalSessions:journal.length},null,2));
