import fs from 'node:fs';
import {parseCandleCsv} from '../src/stocks/csv.ts';
import {replayPortfolio} from '../src/stocks/portfolio.ts';

const symbols=['SPY','QQQ','NVDA','AMD','TSLA'];
const ledgerPath='public/stocks/forward-ledger.json';
const journalPath='public/stocks/forward-journal.json';
const money=n=>Math.round((n+Number.EPSILON)*100);
const dateOf=iso=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));
const data={};
for(const symbol of symbols){
 const parsed=parseCandleCsv(fs.readFileSync('public/stocks/intraday/'+symbol+'.csv','utf8'));
 if(parsed.error)throw new Error(symbol+': '+parsed.error);
 data[symbol]=parsed.candles;
}
const common=symbols.map(s=>new Set(data[s].map(c=>dateOf(c.time)))).reduce((a,b)=>new Set([...a].filter(d=>b.has(d))));
const target=[...common].sort().at(-1);
if(!target)throw new Error('No common trading sessions');
if(!symbols.every(s=>data[s].filter(c=>dateOf(c.time)===target).length>=75))throw new Error('Latest session incomplete');
const old=fs.existsSync(ledgerPath)?JSON.parse(fs.readFileSync(ledgerPath,'utf8')):[];
if(!Array.isArray(old))throw new Error('Invalid ledger');
for(let i=0;i<old.length;i++){
 const e=old[i],previous=i?old[i-1].endingCashCents:100000;
 if(!Number.isInteger(e.startingCashCents)||!Number.isInteger(e.endingCashCents)||!Number.isInteger(e.pnlCents)||e.startingCashCents!==previous||e.endingCashCents!==previous+e.pnlCents||i&&e.day<=old[i-1].day)throw new Error('Ledger continuity invalid at '+e.day);
}
if(old.some(e=>e.day===target)){console.log('Session already in immutable ledger: '+target);process.exit(0);}
if(old.length&&target<old.at(-1).day)throw new Error('Refusing to backfill prospective ledger');
const startingCashCents=old.length?old.at(-1).endingCashCents:100000;
if(startingCashCents<=0)throw new Error('Account exhausted');
const replay=replayPortfolio(data,startingCashCents/100,'prior-session-momentum',target);
if(replay.status!=='ok')throw new Error(replay.error);
const entry=replay.entries.find(e=>e.day===target);
if(!entry)throw new Error('Missing target session');
const first=entry.symbol==='NONE'?'NO_CANDIDATE':entry.note.startsWith('Insufficient')?'INSUFFICIENT_DATA':entry.trades.length?'TRADE_EXECUTED':'QUALIFIED_NO_TRADE';
if(first==='INSUFFICIENT_DATA')throw new Error('Insufficient warmup; refusing to record as no-trade');
const pnlCents=money(entry.pnl),endingCashCents=startingCashCents+pnlCents;
const spyClose=data.SPY.filter(c=>dateOf(c.time)===target).at(-1).close;
const record={schemaVersion:1,day:target,status:first,strategy:'prior-session-momentum-v1',feed:'Alpaca IEX 5m',startingCashCents,pnlCents,endingCashCents,selectedTicker:entry.symbol,trades:entry.trades,spyClose,recordedAt:new Date().toISOString(),limitations:'End-of-session retrospective candle evaluation; simulated only, no live orders.'};
fs.writeFileSync(ledgerPath,JSON.stringify([...old,record],null,2)+'\n');
console.log(JSON.stringify({appended:record,totalSessions:old.length+1},null,2));
