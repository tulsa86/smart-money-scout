// Stock-only discovery and prospective decision planning. No network, orders, or invented fills.
const iso = value => typeof value === 'string' && /Z$|[+-]\d\d:\d\d$/.test(value) && Number.isFinite(Date.parse(value));
const ticker = value => typeof value === 'string' && /^[A-Z]{1,5}(?:[.-][A-Z])?$/.test(value);
const finite = value => typeof value === 'number' && Number.isFinite(value);
export const MIN_PRICE_CENTS=500;
export const MIN_DOLLAR_VOLUME=5_000_000;
export const MAX_DAILY_GAIN=0.15;
export const MAX_THREE_SESSION_GAIN=0.25;
export function discoverStocks(snapshot, {minPrice=MIN_PRICE_CENTS/100,minDollarVolume=MIN_DOLLAR_VOLUME,maxCandidates=50}={}) {
 if (!snapshot || !iso(snapshot.asOf) || !Array.isArray(snapshot.rows) || typeof snapshot.source!=='string' || !snapshot.source.trim()) throw Error('Timestamped market snapshot and source required');
 if (!finite(minPrice)||minPrice<=0||!finite(minDollarVolume)||minDollarVolume<=0||!Number.isInteger(maxCandidates)||maxCandidates<1) throw Error('Invalid discovery parameters');
 const seen=new Set(), candidates=[], rejected=[];
 for (const row of snapshot.rows) {
  if (!row || !ticker(row.symbol) || seen.has(row.symbol)) throw Error('Invalid or duplicate stock symbol');
  seen.add(row.symbol);
  if (!iso(row.observedAt) || Date.parse(row.observedAt)>Date.parse(snapshot.asOf)) throw Error('Future or invalid market observation');
  if (!finite(row.close)||!finite(row.volume)||!finite(row.previousClose)||row.close<=0||row.previousClose<=0||row.volume<0) throw Error('Invalid market data');
  const dollarVolume=row.close*row.volume;
  if(row.close<minPrice){rejected.push({symbol:row.symbol,reason:'BELOW_PRICE_FLOOR',rejectionReason:'BELOW_PRICE_FLOOR'});continue}
  if(dollarVolume<minDollarVolume){rejected.push({symbol:row.symbol,reason:'INSUFFICIENT_DOLLAR_VOLUME',rejectionReason:'INSUFFICIENT_DOLLAR_VOLUME'});continue}
  const dailyGain=row.close/row.previousClose-1;
  const threeDayGain=Array.isArray(row.priorCloses)&&row.priorCloses.length>=3?row.close/row.priorCloses.at(-3)-1:null;
  if(dailyGain>MAX_DAILY_GAIN||(threeDayGain!==null&&threeDayGain>MAX_THREE_SESSION_GAIN)){rejected.push({symbol:row.symbol,reason:'EXHAUSTION_RISK',rejectionReason:'EXHAUSTION_RISK'});continue}
  candidates.push({symbol:row.symbol,observedAt:row.observedAt,close:row.close,previousClose:row.previousClose,volume:row.volume,dollarVolume,changePct:(row.close/row.previousClose-1)*100});
 }
 candidates.sort((a,b)=>b.dollarVolume-a.dollarVolume||a.symbol.localeCompare(b.symbol));
 return {schemaVersion:1,kind:'STOCK_DISCOVERY',source:snapshot.source,asOf:snapshot.asOf,coverage:{supplied:snapshot.rows.length,eligible:candidates.length,returned:Math.min(candidates.length,maxCandidates),rejected:rejected.length,completeMarketCoverage:false},candidates:candidates.slice(0,maxCandidates),rejected};
}
export function planStockDecisions(discovery,{decisionAt,cashCents=100000,maxAllocationPct=0.2,minChangePct=1,ruleVersion='stock-eod-momentum-v1'}={}) {
 if(!discovery||discovery.kind!=='STOCK_DISCOVERY'||!iso(discovery.asOf)||!Array.isArray(discovery.candidates))throw Error('Valid discovery required');
 if(!iso(decisionAt)||Date.parse(decisionAt)<Date.parse(discovery.asOf))throw Error('Decision cannot precede data');
 if(!Number.isSafeInteger(cashCents)||cashCents<0||!finite(maxAllocationPct)||maxAllocationPct<=0||maxAllocationPct>1||!finite(minChangePct)||minChangePct<0)throw Error('Invalid allocation settings');
 if(typeof ruleVersion!=='string'||!ruleVersion.trim())throw Error('Rule version required');
 const ranked=discovery.candidates.map(c=>{
  if(!ticker(c.symbol)||!iso(c.observedAt)||Date.parse(c.observedAt)>Date.parse(decisionAt)||!finite(c.close)||c.close<=0||!finite(c.changePct))throw Error('Invalid or future candidate');
  return c;
 }).sort((a,b)=>b.changePct-a.changePct||a.symbol.localeCompare(b.symbol));
 const candidate=ranked.find(c=>c.changePct>=minChangePct);
 const budgetCents=Math.floor(cashCents*maxAllocationPct);
 const shares=candidate?Math.floor(budgetCents/Math.ceil(candidate.close*100)):0;
 const action=candidate&&shares>0?'BUY':'HOLD';
 return {schemaVersion:1,kind:'PROSPECTIVE_STOCK_DECISION',decisionAt,sourceAsOf:discovery.asOf,source:discovery.source,ruleVersion,action,symbol:action==='BUY'?candidate.symbol:null,shares:action==='BUY'?shares:0,referencePrice:action==='BUY'?candidate.close:null,startingCashCents:cashCents,allocationLimitCents:budgetCents,reason:action==='BUY'?'Prior-observation momentum threshold passed; simulated order NOT executed':candidate?'Insufficient cash for whole-share allocation':'No qualifying candidates',discoveredSymbols:discovery.candidates.map(c=>c.symbol),status:'DECISION_ONLY_NO_FILL'};
}
