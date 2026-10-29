// Deterministic, offline-only simulated entry accounting. No broker client or order endpoints.
const validTime=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&/(Z|[+-]\d\d:\d\d)$/.test(x);
export const SLIPPAGE_BPS=5;\nconst cents=x=>Number.isSafeInteger(x)&&x>=0;
export function createSimulatedLedger(startingCashCents=100000){
 if(!cents(startingCashCents))throw Error('Invalid starting cash');
 return {schemaVersion:1,startingCashCents,cashCents:startingCashCents,positions:{},fills:[],processedDecisions:[]};
}
export function simulateNextSessionEntry(ledger,decision,openingBar){
 if(!ledger||ledger.schemaVersion!==1||!cents(ledger.cashCents)||!Array.isArray(ledger.fills)||!Array.isArray(ledger.processedDecisions)||!ledger.positions)throw Error('Invalid ledger');
 if(!decision||decision.kind!=='PROSPECTIVE_STOCK_DECISION'||!validTime(decision.decisionAt)||!['BUY','HOLD'].includes(decision.action)||decision.status!=='DECISION_ONLY_NO_FILL')throw Error('Invalid prospective decision');
 if(ledger.processedDecisions.includes(decision.decisionAt))throw Error('Decision already processed');
 const base={...ledger,positions:{...ledger.positions},fills:[...ledger.fills],processedDecisions:[...ledger.processedDecisions,decision.decisionAt]};
 if(decision.action==='HOLD')return base;
 if(!openingBar||openingBar.symbol!==decision.symbol||!validTime(openingBar.observedAt)||!Number.isFinite(openingBar.open)||openingBar.open<=0||!Number.isSafeInteger(decision.shares)||decision.shares<=0)throw Error('Invalid opening bar or quantity');
 // Alpaca daily bars timestamp their session at 04:00/05:00 UTC; compare New York session dates, not bar timestamps.
 const nyDate=x=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(x)).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day;};
 const session=nyDate(openingBar.observedAt),decisionSession=nyDate(decision.decisionAt);
 if(session<=decisionSession)throw Error('Opening session must follow decision session');
 if(Date.parse(openingBar.availableAt||'')<=Date.parse(decision.decisionAt)||!validTime(openingBar.availableAt))throw Error('Opening price availability must follow decision');
 const priceCents=Math.round(openingBar.open*(1+SLIPPAGE_BPS/10000)*100),costCents=priceCents*decision.shares;
 if(!Number.isSafeInteger(costCents)||costCents>base.cashCents||costCents>decision.allocationLimitCents)throw Error('Insufficient cash or allocation limit at opening price');
 const current=base.positions[decision.symbol]||{shares:0,costBasisCents:0};
 base.positions[decision.symbol]={shares:current.shares+decision.shares,costBasisCents:current.costBasisCents+costCents};
 base.cashCents-=costCents;
 base.fills.push({kind:'SIMULATED_ENTRY',symbol:decision.symbol,shares:decision.shares,priceCents,costCents,slippageBps:SLIPPAGE_BPS,decisionAt:decision.decisionAt,session,priceAvailableAt:openingBar.availableAt,recordedAt:openingBar.availableAt,simulationOnly:true});
 return base;
}

export function markSimulatedPortfolio(ledger,marks,{snapshotTime}={}){
 if(!validTime(snapshotTime)||!ledger||!cents(ledger.cashCents)||!ledger.positions||!marks||typeof marks!=='object')throw Error('Invalid valuation inputs');
 let unrealizedEquityCents=0,costBasisCents=0;
 const markEvidence={};
 for(const [symbol,p] of Object.entries(ledger.positions)){
  const m=marks[symbol];
  if(!m||!validTime(m.observedAt)||!validTime(m.availableAt)||Date.parse(m.availableAt)>Date.parse(snapshotTime)||Date.parse(m.availableAt)<Date.parse(m.observedAt)||!Number.isFinite(m.close)||m.close<=0||!cents(p.shares)||!cents(p.costBasisCents))throw Error('Unavailable or invalid completed close for '+symbol);
  const value=Math.round(m.close*100)*p.shares;
  if(!Number.isSafeInteger(value))throw Error('Valuation overflow');
  unrealizedEquityCents+=value;costBasisCents+=p.costBasisCents;
  markEvidence[symbol]={observedAt:m.observedAt,availableAt:m.availableAt,source:m.source??'UNSPECIFIED'};
 }
 const totalEquityCents=ledger.cashCents+unrealizedEquityCents;
 if(!Number.isSafeInteger(totalEquityCents)||!Number.isSafeInteger(costBasisCents))throw Error('Valuation overflow');
 return {snapshotTime,cashCents:ledger.cashCents,unrealizedEquityCents,totalEquityCents,unrealizedPnlCents:unrealizedEquityCents-costBasisCents,markEvidence};
}
