// Scheduled at 07:00 EST / 08:00 EDT. Never backfill a missed prediction.
import {readFile} from 'node:fs/promises';
import {executeDailyExperiment} from './gamble-mvp-daily-steps.mjs';
import {spawnSync} from 'node:child_process';
import {isRegularMarketDay,nyToday} from './gamble-market-calendar.mjs';
const now=new Date(),today=nyToday(now);
const time=new Intl.DateTimeFormat('en-GB',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
if(!isRegularMarketDay(today)){console.log('No full trading session today; skipped');process.exit(0)}
if(time>='09:30')throw Error('Missed premarket deadline; refusing retrospective prediction');
async function read(path,fallback){try{return JSON.parse(await readFile(path,'utf8'))}catch(e){if(e.code==='ENOENT')return fallback;throw e}}
const journal=await read('public/stocks/gamble-presession-journal.json',[]);
const ledger=await read('public/stocks/gamble-mvp-ledger.json',{sessions:[]});
const decisions=journal.filter(x=>x.mode==='selective'&&x.ruleVersion==='gamble-mvp-v1');

const run=(script,session)=>{const r=spawnSync(process.execPath,[script],{stdio:'inherit',env:{...process.env,GAMBLE_TARGET_SESSION:session}});if(r.status!==0)throw Error('Experiment step failed: '+script+' '+session)};
const pending=decisions.filter(x=>!ledger.sessions.some(s=>s.targetSession===x.targetSession)&&x.targetSession<today).sort((a,b)=>a.targetSession.localeCompare(b.targetSession));
if(pending.length>1)throw Error('Multiple unsettled sessions require investigation; no silent backfill');
// A previously recorded prediction may be settled late; never create a past prediction.
const {settlementFailure,decisionFailure}=executeDailyExperiment({pending,decisions,today,run});
if(settlementFailure||decisionFailure)process.exitCode=1;
