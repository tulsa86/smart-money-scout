// Deterministic pre-session selection from already available, completed prior-session evidence.
// No network calls, broker orders, or historical replay modifications.
import {appendGambleDecision} from './gamble-decision-journal.mjs';
const validTime=x=>typeof x==='string'&&/(Z|[+-]\d{2}:\d{2})$/.test(x)&&Number.isFinite(Date.parse(x));
const nyDay=x=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(x));
export function planGamblePresession(rows,{targetSession,recordedAt,source,sourceFetchedAt,observations,bankrollCents=100000,ruleVersion='gamble-prior-session-v1'}){
 if(!validTime(recordedAt)||!validTime(sourceFetchedAt)||Date.parse(sourceFetchedAt)>Date.parse(recordedAt)||nyDay(recordedAt)>=targetSession||typeof source!=='string'||!source.trim()||!Array.isArray(observations)||!observations.length)throw Error('Invalid or late pre-session evidence');
 const candidates=[];const seen=new Set();
 for(const o of observations){
  if(!o||typeof o.symbol!=='string'||!/^[A-Z]{1,5}(?:[.-][A-Z])?$/.test(o.symbol)||seen.has(o.symbol)||!validTime(o.sessionCloseAt)||!validTime(o.availableAt)||Date.parse(o.availableAt)>Date.parse(sourceFetchedAt)||Date.parse(o.sessionCloseAt)>Date.parse(o.availableAt)||nyDay(o.sessionCloseAt)>=targetSession||![o.open,o.close,o.volume,o.meanPriorVolume].every(Number.isFinite)||o.open<=0||o.close<=0||o.volume<0||o.meanPriorVolume<=0)throw Error('Invalid, future, or duplicate completed session observation');
  seen.add(o.symbol);
  const momentum=o.close/o.open-1,relativeVolume=o.volume/o.meanPriorVolume;
  candidates.push({symbol:o.symbol,sessionCloseAt:o.sessionCloseAt,availableAt:o.availableAt,momentum,relativeVolume,score:momentum>0&&relativeVolume>1?momentum*relativeVolume:null});
 }
 const ranked=candidates.filter(c=>c.score!==null).sort((a,b)=>b.score-a.score||a.symbol.localeCompare(b.symbol));
 const snapshot={source,asOf:sourceFetchedAt,candidates,limitations:'Pre-session selection from supplied prior-session bars; no independent market-wide discovery or live fill.'};
 let next=rows;
 for(const mode of ['forced-daily','selective']){
  // Forced-daily chooses a fallback from the supplied universe; selective may skip.
  const selected=mode==='forced-daily'?(ranked[0]??candidates.slice().sort((a,b)=>a.symbol.localeCompare(b.symbol))[0]):ranked[0];
  const action=selected?'BUY_INTENT':'SKIP';
  next=appendGambleDecision(next,{mode,targetSession,recordedAt,snapshot,action,symbol:selected?.symbol??null,bankrollCents,ruleVersion,reason:selected?(ranked.length?'Positive prior-session momentum and relative volume':'Forced-daily fallback from predeclared universe; not a qualifying signal'):'No positive prior-session momentum and relative-volume signal'});
 }
 return next;
}
