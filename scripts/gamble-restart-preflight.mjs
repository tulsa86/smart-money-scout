// Read-only restart diagnostics. No trading, journal writes, or backfills.
import fs from 'node:fs';
import {isRegularMarketDay,nyToday} from './gamble-market-calendar.mjs';
const today=nyToday(new Date());
const paths=['public/stocks/gamble-presession-journal.json','public/stocks/gamble-mvp-ledger.json'];
const checks={targetSession:today,regularMarketDay:isRegularMarketDay(today),scheduledRunsEnabled:false,files:{}};
for(const path of paths){
 if(!fs.existsSync(path)){checks.files[path]={exists:false};continue}
 const value=JSON.parse(fs.readFileSync(path,'utf8'));
 const rows=Array.isArray(value)?value:value.sessions;
 if(!Array.isArray(rows))throw Error('Invalid data shape: '+path);
 checks.files[path]={exists:true,records:rows.length,latestSession:rows.at(-1)?.targetSession??null};
}
console.log(JSON.stringify(checks,null,2));
console.log('Prospective collection requires all five symbols to have two fully contiguous 78-bar IEX sessions before the target open.');
console.log('This check does not verify live Alpaca coverage or credentials. Do not enable schedule without live preflight.');
