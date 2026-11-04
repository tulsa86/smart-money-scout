// Scheduled at 07:00 EST / 08:00 EDT. Never backfill a missed prediction.
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {isRegularMarketDay,priorRegularMarketDay,nyToday} from './gamble-market-calendar.mjs';
const now=new Date(),today=nyToday(now);
const time=new Intl.DateTimeFormat('en-GB',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
if(!isRegularMarketDay(today)){console.log('No full trading session today; skipped');process.exit(0)}
if(time>='09:30')throw Error('Missed premarket deadline; refusing retrospective prediction');
async function read(path,fallback){try{return JSON.parse(await readFile(path,'utf8'))}catch(e){if(e.code==='ENOENT')return fallback;throw e}}
const journal=await read('public/stocks/gamble-presession-journal.json',[]);
const ledger=await read('public/stocks/gamble-mvp-ledger.json',{sessions:[]});
const decisions=journal.filter(x=>x.mode==='selective'&&x.ruleVersion==='gamble-mvp-v1');
const previous=priorRegularMarketDay(today);
const run=(script,session)=>{const r=spawnSync(process.execPath,[script],{stdio:'inherit',env:{...process.env,GAMBLE_TARGET_SESSION:session}});if(r.status!==0)throw Error('Experiment step failed: '+script+' '+session)};
const pending=decisions.filter(x=>!ledger.sessions.some(s=>s.targetSession===x.targetSession)&&x.targetSession<today);
if(pending.length>1||pending.length===1&&pending[0].targetSession!==previous)throw Error('Unsettled older decisions require manual investigation');
if(pending.length===1)run('scripts/settle-gamble-mvp.mjs',previous);
if(!decisions.some(x=>x.targetSession===today))run('scripts/record-gamble-presession.mjs',today);
else console.log('Already committed today; no duplicate decision');
