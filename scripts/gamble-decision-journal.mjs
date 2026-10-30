// Offline, append-only Gamble Zone decision evidence. Never places orders or evaluates fills.
import {createHash} from 'node:crypto';
export const GAMBLE_MODES=Object.freeze(['forced-daily','selective']);
const validTime=x=>typeof x==='string'&&/(Z|[+-]\d{2}:\d{2})$/.test(x)&&Number.isFinite(Date.parse(x));
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const nyDay=x=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(x));
export function verifyGambleDecisionJournal(rows){
 if(!Array.isArray(rows))throw Error('Invalid Gamble Zone journal');
 let prior=null;
 const seen=new Set();
 for(const row of rows){
  if(!row||row.schemaVersion!==1||row.kind!=='GAMBLE_PRESESSION_DECISION'||!GAMBLE_MODES.includes(row.mode)||row.previousDigest!==prior||!validTime(row.recordedAt)||!validTime(row.snapshot?.asOf)||!/^\d{4}-\d{2}-\d{2}$/.test(row.targetSession)||!['BUY_INTENT','SKIP'].includes(row.action)||!Number.isSafeInteger(row.bankrollCents)||row.bankrollCents<0||typeof row.ruleVersion!=='string'||!row.ruleVersion||typeof row.reason!=='string'||!row.reason||typeof row.snapshot.source!=='string'||!row.snapshot.source||!Array.isArray(row.snapshot.candidates))throw Error('Invalid Gamble Zone decision');
  if(Date.parse(row.snapshot.asOf)>Date.parse(row.recordedAt)||nyDay(row.recordedAt)>=row.targetSession||nyDay(row.snapshot.asOf)>=row.targetSession)throw Error('Decision must precede target session and evidence');
  if(row.action==='BUY_INTENT'&&(!/^[A-Z]{1,5}(?:[.-][A-Z])?$/.test(row.symbol)||!row.snapshot.candidates.some(c=>c.symbol===row.symbol)))throw Error('Selected stock absent from evidence');
  if(row.action==='SKIP'&&row.symbol!==null)throw Error('Skip must have null symbol');
  const key=row.mode+':'+row.targetSession;
  if(seen.has(key))throw Error('Duplicate mode/session decision');
  seen.add(key);
  const {digest,...payload}=row;
  if(hash(payload)!==digest)throw Error('Gamble Zone decision digest mismatch');
  prior=digest;
 }
 return rows;
}
export function appendGambleDecision(rows,{mode,targetSession,recordedAt,snapshot,action,symbol=null,bankrollCents=100000,ruleVersion,reason}){
 verifyGambleDecisionJournal(rows);
 if(!GAMBLE_MODES.includes(mode)||!validTime(recordedAt)||!snapshot||!validTime(snapshot.asOf)||!Array.isArray(snapshot.candidates)||typeof snapshot.source!=='string'||!snapshot.source.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(targetSession)||!['BUY_INTENT','SKIP'].includes(action)||!Number.isSafeInteger(bankrollCents)||bankrollCents<0||typeof ruleVersion!=='string'||!ruleVersion.trim()||typeof reason!=='string'||!reason.trim())throw Error('Invalid decision input');
 if(Date.parse(snapshot.asOf)>Date.parse(recordedAt)||nyDay(recordedAt)>=targetSession||nyDay(snapshot.asOf)>=targetSession)throw Error('Cannot record retrospective decision');
 if(action==='BUY_INTENT'&&(!/^[A-Z]{1,5}(?:[.-][A-Z])?$/.test(symbol)||!snapshot.candidates.some(c=>c.symbol===symbol)))throw Error('Selected stock absent from evidence');
 if(action==='SKIP'&&symbol!==null)throw Error('Skip must have null symbol');
 if(rows.some(r=>r.mode===mode&&r.targetSession===targetSession))throw Error('Decision already recorded for mode/session');
 const payload={schemaVersion:1,kind:'GAMBLE_PRESESSION_DECISION',mode,targetSession,recordedAt,action,symbol,bankrollCents,ruleVersion,reason,snapshot:structuredClone(snapshot),previousDigest:rows.at(-1)?.digest??null};
 const row={...payload,digest:hash(payload)};
 return verifyGambleDecisionJournal([...rows,row]);
}
