import React,{useEffect,useState} from 'react';
type Trade={entryTime:string;exitTime:string;strategy:string;reason:string;shares:number;netPnl:number};
type Entry={day:string;symbol:string;decision:string;note:string;pnl:number;trades:Trade[];spyClose?:number;fixedSizeIllustrativeBalance?:number};
type Report={mode:string;firstSession:string|null;lastSession:string|null;sessions:number;simulatedTrades:number;noTradeSessions:number;winRatePct:number|null;cumulativePnl:number;illustrativeBalance:number;spyCloseToCloseReturnPct:number|null;spyBenchmarkStart:string|null;limitations:string};
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
export default function ForwardPerformance(){
 const [data,setData]=useState<{report:Report;entries:Entry[]}|null>(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{let active=true;setLoading(true);setError('');Promise.all(['forward-report.json','forward-journal.json'].map(async name=>{const r=await fetch(import.meta.env.BASE_URL+'stocks/'+name,{cache:'no-store'});if(!r.ok)throw new Error(name+' unavailable (HTTP '+r.status+')');return r.json();})).then(([report,entries])=>{if(!Array.isArray(entries)||!Number.isFinite(report.illustrativeBalance))throw new Error('Invalid forward data');if(active)setData({report,entries});}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Unable to load forward results');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[refresh]);
 const r=data?.report;
 const equity=data?.entries.reduce<{day:string;balance:number}[]>((points,entry)=>{const previous=points.length?points[points.length-1].balance:1000;points.push({day:entry.day,balance:Math.round((previous+entry.pnl)*100)/100});return points;},[])||[];
 const values=[1000,...equity.map(p=>p.balance)];
 const min=Math.min(...values)-1,max=Math.max(...values)+1;
 const plot=equity.length?([{day:'Start',balance:1000},...equity].map((p,i,a)=>String((i/(a.length-1))*100)+','+String(100-(p.balance-min)/(max-min)*100)).join(' ')):'';
 return <section className="forward-dashboard">
  <div className="forward-top"><div><span className="scout-kicker">AUTOMATED HISTORICAL RESEARCH · NO ORDERS</span><h2>Forward performance</h2><p>Decisions recorded after each market session. Results are simulations, not brokerage activity.</p></div><button type="button" onClick={()=>setRefresh(n=>n+1)} disabled={loading}>{loading?'Loading…':'Refresh data'}</button></div>
  {error&&<p role="alert" className="forward-error">Unable to load performance: {error}</p>}
  {r&&<><div className="forward-metrics">
   <article><span>Illustrative balance</span><strong>{money(r.illustrativeBalance)}</strong><small>Fixed-size $1,000 simulations, not compounded</small></article>
   <article><span>Cumulative P&L</span><strong className={r.cumulativePnl<0?'red':'green'}>{money(r.cumulativePnl)}</strong><small>Since {r.firstSession||'first recorded session'}</small></article>
   <article><span>Recorded sessions</span><strong>{r.sessions}</strong><small>{r.noTradeSessions} no-trade sessions</small></article>
   <article><span>Win rate</span><strong>{r.winRatePct===null?'Not available':r.winRatePct.toFixed(1)+'%'}</strong><small>{r.simulatedTrades} simulated trades</small></article>
  </div><div className="forward-equity"><h3>Recorded equity path</h3><p>Fixed-size cumulative P&L. Each observation is recorded after its trading session.</p>{equity.length>1?<><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Line chart of illustrative simulated balance across recorded sessions"><polyline points={plot} fill="none" stroke="#9be9bd" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/></svg><div className="forward-chart-labels"><span>{equity[0].day}</span><span>{equity.at(-1)?.day}</span></div></>:<p>Waiting for another recorded session before drawing a trend.</p>}</div><div className="forward-benchmark"><h3>SPY benchmark</h3><strong>{r.spyCloseToCloseReturnPct===null?'Awaiting prices':r.spyCloseToCloseReturnPct.toFixed(2)+'%'}</strong><p>{r.spyBenchmarkStart?'Close-to-close change since '+r.spyBenchmarkStart:'No matching closing-price observations yet.'} Not a matched-capital investment comparison.</p></div>
  <div className="forward-history"><h3>Daily decision journal</h3><p>Newest sessions first. Existing records are preserved when the workflow reruns.</p>{data.entries.slice().reverse().map(entry=><article key={entry.day} className="forward-entry"><div className="forward-entry-top"><strong>{entry.day} · {entry.symbol}</strong><span className={entry.pnl<0?'red':'green'}>{money(entry.pnl)}</span></div><p>{entry.decision.replaceAll('-',' ')} · {entry.note}</p>{entry.trades.map((trade,i)=><p key={i} className="forward-trade">{trade.strategy} · {trade.shares} shares · {trade.reason} · {money(trade.netPnl)}</p>)}</article>)}</div>
  <p className="forward-footnote">{r.limitations}</p></>}
 </section>;
}
