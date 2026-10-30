// Deterministic, offline-only simulated entry accounting. No broker client or order endpoints.
const validTime=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&/(Z|[+-]\d\d:\d\d)$/.test(x);
export const SLIPPAGE_BPS=5;
const cents=x=>Number.isSafeInteger(x)&&x>=0;
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

/**
 * Offline simulated closing fill. Uses a completed, available exit observation,
 * never a broker order. Caller must choose the exit according to frozen rules.
 * This is not an intraday execution guarantee.
 */
export function simulatePositionExit(ledger,{symbol,shares,exitBar,snapshotTime,reason='RULE_EXIT'}){
 if(!ledger||ledger.schemaVersion!==1||!cents(ledger.cashCents)||!Array.isArray(ledger.fills)||!ledger.positions||!Array.isArray(ledger.processedDecisions))throw Error('Invalid ledger');
 const position=ledger.positions[symbol];
 if(!position||!Number.isSafeInteger(shares)||shares<=0||shares>position.shares||!cents(position.costBasisCents)||!Number.isSafeInteger(position.shares)||position.shares<=0)throw Error('Invalid exit position or quantity');
 if(!exitBar||exitBar.symbol!==symbol||!validTime(exitBar.observedAt)||!validTime(exitBar.availableAt)||!validTime(snapshotTime)||!Number.isFinite(exitBar.close)||exitBar.close<=0||Date.parse(exitBar.availableAt)<Date.parse(exitBar.observedAt)||Date.parse(exitBar.availableAt)>Date.parse(snapshotTime))throw Error('Exit price is not available at snapshot');
 const entries=ledger.fills.filter(f=>f.kind==='SIMULATED_ENTRY'&&f.symbol===symbol);
 if(!entries.length||Date.parse(exitBar.observedAt)<=Math.max(...entries.map(f=>Date.parse(f.recordedAt))))throw Error('Exit observation must follow available entry');
 if(ledger.fills.some(f=>f.kind==='SIMULATED_EXIT'&&f.symbol===symbol&&f.priceAvailableAt===exitBar.availableAt))throw Error('Duplicate exit observation');
 const priceCents=Math.round(exitBar.close*(1-SLIPPAGE_BPS/10000)*100);
 if(!cents(priceCents)||priceCents===0)throw Error('Invalid exit price after slippage');
 const proceedsCents=priceCents*shares;
 if(!Number.isSafeInteger(proceedsCents)||!Number.isSafeInteger(ledger.cashCents+proceedsCents))throw Error('Exit proceeds overflow');
 const releasedCostBasisCents=shares===position.shares?position.costBasisCents:Math.round(position.costBasisCents*shares/position.shares);
 const positions={...ledger.positions};
 if(shares===position.shares)delete positions[symbol];
 else positions[symbol]={shares:position.shares-shares,costBasisCents:position.costBasisCents-releasedCostBasisCents};
 return {...ledger,cashCents:ledger.cashCents+proceedsCents,positions,
  fills:[...ledger.fills,{kind:'SIMULATED_EXIT',symbol,shares,priceCents,proceedsCents,releasedCostBasisCents,realizedPnlCents:proceedsCents-releasedCostBasisCents,slippageBps:SLIPPAGE_BPS,reason,observedAt:exitBar.observedAt,priceAvailableAt:exitBar.availableAt,recordedAt:snapshotTime,simulationOnly:true}]};
}
