import fs from 'node:fs/promises';
import {produceAlpacaDecision} from './alpaca-stock-discovery.mjs';
import {appendStockDecisionJournal} from './stock-decision-journal.mjs';
const path='public/stocks/stock-decision-journal.json';
const key=process.env.ALPACA_API_KEY_ID,secret=process.env.ALPACA_API_SECRET_KEY;
if(!key||!secret)throw Error('Alpaca market data credentials required');
const decisionAt=new Date().toISOString();
const {discovery,decision}=await produceAlpacaDecision({key,secret,decisionAt});
let old=[];
try{old=JSON.parse(await fs.readFile(path,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
const journal=appendStockDecisionJournal(old,{discovery,decision});
await fs.mkdir('public/stocks',{recursive:true});
await fs.writeFile(path,JSON.stringify(journal,null,2)+'\n');
console.log('Recorded '+decision.action+' from '+discovery.candidates.length+' limited-market candidates; NO EXECUTION OR FILL');
