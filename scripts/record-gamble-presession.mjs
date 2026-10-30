// Manually invoked, read-only market-data collection and prospective decision recording.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {collectAndPlanGamble} from './gamble-alpaca-presession.mjs';
import {verifyGambleDecisionJournal} from './gamble-decision-journal.mjs';

const targetSession=process.env.GAMBLE_TARGET_SESSION;
const key=process.env.ALPACA_API_KEY_ID;
const secret=process.env.ALPACA_API_SECRET_KEY;
if(!targetSession||!key||!secret)throw Error('Missing target session or market-data credentials');
const path='public/stocks/gamble-presession-journal.json';
let existing=[];
try{existing=JSON.parse(await readFile(path,'utf8'))}
catch(error){if(error.code!=='ENOENT')throw error}
verifyGambleDecisionJournal(existing);
if(existing.some(row=>row.targetSession===targetSession))throw Error('Session already recorded');
const next=await collectAndPlanGamble(existing,{targetSession,key,secret});
await mkdir('public/stocks',{recursive:true});
await writeFile(path,JSON.stringify(next,null,2)+'\n');
console.log('Recorded pre-session decisions only; no fills or orders');
