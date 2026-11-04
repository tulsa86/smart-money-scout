// Manual, read-only settlement of an already committed selective Gamble decision.
// Never creates retrospective decisions or sends broker orders.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {verifyGambleDecisionJournal} from './gamble-decision-journal.mjs';
import {newMvpLedger,applyMvpSessionIdempotent} from './gamble-mvp-ledger.mjs';
import {fetchMvpSessionEvidence} from './gamble-mvp-alpaca-readonly.mjs';

const nyDay=x=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(x));
export function validateSettlement({targetSession,now,journal,ledger}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(targetSession)||!Number.isFinite(Date.parse(now))||nyDay(now)<=targetSession)throw Error('Settle only after target session has ended (next New York day)');
 verifyGambleDecisionJournal(journal);
 const matches=journal.filter(row=>row.targetSession===targetSession&&row.mode==='selective'&&row.ruleVersion==='gamble-mvp-v1');
 if(matches.length!==1)throw Error('No unique precommitted selective MVP decision; never backfill');
 const decision=matches[0];
 if(nyDay(decision.recordedAt)>=targetSession)throw Error('Decision was not pre-session');
 if(ledger?.kind!=='GAMBLE_MVP_LEDGER'||!Array.isArray(ledger.sessions))throw Error('Invalid MVP ledger');
 if(ledger.sessions.length&&targetSession<ledger.sessions.at(-1).targetSession)throw Error('Cannot backfill earlier session');
 return decision;
}
export async function settleMvp({targetSession,now,journal,ledger,key,secret,fetchEvidence=fetchMvpSessionEvidence}){
 const decision=validateSettlement({targetSession,now,journal,ledger});
 const already=ledger.sessions.find(s=>s.targetSession===targetSession);
 if(already)return applyMvpSessionIdempotent(ledger,journal,{targetSession,recordedAt:now});
 if(decision.action==='BUY_INTENT'&&(!key||!secret))throw Error('Missing read-only market-data credentials');
 const evidence=decision.action==='BUY_INTENT'?await fetchEvidence({symbol:decision.symbol,targetSession,key,secret,availableAt:now}):null;
 return applyMvpSessionIdempotent(ledger,journal,{targetSession,evidence,recordedAt:now});
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 const targetSession=process.env.GAMBLE_TARGET_SESSION,now=new Date().toISOString();
 const journal=JSON.parse(await readFile('public/stocks/gamble-presession-journal.json','utf8'));
 let ledger;
 try{ledger=JSON.parse(await readFile('public/stocks/gamble-mvp-ledger.json','utf8'))}
 catch(e){if(e.code!=='ENOENT')throw e;ledger=newMvpLedger()}
 const result=await settleMvp({targetSession,now,journal,ledger,key:process.env.ALPACA_API_KEY_ID,secret:process.env.ALPACA_API_SECRET_KEY});
 if(!result.alreadyRecorded){
  await mkdir('public/stocks',{recursive:true});
  await writeFile('public/stocks/gamble-mvp-ledger.json',JSON.stringify(result.ledger,null,2)+'\n');
 }
 console.log(result.alreadyRecorded?'Already settled; no changes':'Settled simulated MVP session (no orders)');
}
