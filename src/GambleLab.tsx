import React,{useEffect,useState} from 'react';
import {parseCandleCsv} from './stocks/csv.ts';
import {backtestBreakout} from './stocks/backtest.ts';
import {replayPortfolio,type PortfolioReplay} from './stocks/portfolio.ts';
const engineReady=typeof backtestBreakout==='function';
type DailyRow={day:string;status:string;selectedTicker:string;startingCashCents:number;pnlCents:number;endingCashCents:number;trades:{shares:number;netPnl:number;strategy:string;reason:string}[];limitations?:string};
type DailyReport={sessions:number;simulatedTrades:number;noTradeSessions:number;cumulativePnl:number;illustrativeBalance:number;firstSession:string;lastSession:string;limitations:string};
type DecisionRow={mode:string;targetSession:string;action:string;symbol:string|null;recordedAt:string;reason:string};
const usd=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);

export default function GambleLab(){
 const [daily,setDaily]=useState<{ledger:DailyRow[];report:DailyReport}|null>(null);
 const [decisions,setDecisions]=useState<DecisionRow[]>([]);
 const [dashboardError,setDashboardError]=useState('');
 const [dashboardBusy,setDashboardBusy]=useState(true);
 async function refreshDashboard(){
  setDashboardBusy(true);setDashboardError('');
  try{
   const root=import.meta.env.BASE_URL+'stocks/';
   const [ledgerResponse,reportResponse]=await Promise.all([fetch(root+'forward-ledger.json',{cache:'no-store'}),fetch(root+'forward-report.json',{cache:'no-store'})]);
   if(!ledgerResponse.ok||!reportResponse.ok)throw Error('Published historical report unavailable');
   const ledger=await ledgerResponse.json() as DailyRow[];
   const report=await reportResponse.json() as DailyReport;
   if(!Array.isArray(ledger)||!Number.isFinite(report.illustrativeBalance)||ledger.length!==report.sessions||!ledger.every(r=>Number.isSafeInteger(r.endingCashCents)&&Number.isSafeInteger(r.pnlCents)&&Array.isArray(r.trades))||ledger.length>0&&ledger.at(-1)!.endingCashCents!==Math.round(report.illustrativeBalance*100))throw Error('Published historical report does not reconcile');
   setDaily({ledger,report});
   const decisionResponse=await fetch(root+'gamble-presession-journal.json',{cache:'no-store'});
   if(decisionResponse.ok){
    const result=await decisionResponse.json() as DecisionRow[];
    setDecisions(Array.isArray(result)?result:[]);
   }else setDecisions([]);
  }catch(e){setDashboardError(e instanceof Error?e.message:'Unable to load dashboard');setDaily(null);}
  finally{setDashboardBusy(false);}
 }
 useEffect(()=>{void refreshDashboard();},[]);
 const [csv,setCsv]=useState('');
 const [report,setReport]=useState<ReturnType<typeof backtestBreakout>|null>(null);
 const [error,setError]=useState('');
 const [loadedSymbol,setLoadedSymbol]=useState('');
 const [portfolio,setPortfolio]=useState<PortfolioReplay|null>(null);
 const [busy,setBusy]=useState(false);
 async function loadSymbol(symbol:string){setError('');setReport(null);try{const response=await fetch(import.meta.env.BASE_URL+'stocks/intraday/'+symbol+'.csv',{cache:'no-store'});if(!response.ok)throw new Error('Historical data not published yet. Check the sync workflow and API secrets.');const data=await response.text();const parsed=parseCandleCsv(data);if(parsed.error)throw new Error(parsed.error);setCsv(data);setLoadedSymbol(symbol);}catch(e){setError(e instanceof Error?e.message:'Unable to load historical candles');}}

 async function runPortfolio(){
  setBusy(true);setError('');setReport(null);setPortfolio(null);
  try{
   const symbols=['SPY','QQQ','NVDA','AMD','TSLA'];
   const files=await Promise.all(symbols.map(async symbol=>{
    const response=await fetch(import.meta.env.BASE_URL+'stocks/intraday/'+symbol+'.csv',{cache:'no-store'});
    if(!response.ok)throw new Error(symbol+' historical data unavailable');
    const parsed=parseCandleCsv(await response.text());
    if(parsed.error)throw new Error(symbol+': '+parsed.error);
    return [symbol,parsed.candles] as const;
   }));
   const result=replayPortfolio(Object.fromEntries(files),1000);
   if(result.status==='invalid')throw new Error(result.error||'Invalid portfolio replay');
   setPortfolio(result);
  }catch(e){setError(e instanceof Error?e.message:'Portfolio replay failed');}
  finally{setBusy(false);}
 }
 function runReplay(){setPortfolio(null);const parsed=parseCandleCsv(csv);if(parsed.error){setError(parsed.error);setReport(null);return;}const result=backtestBreakout(parsed.candles,{dailyTradeTarget:true});if(result.status==='invalid'){setError(result.error||'Invalid backtest');setReport(null);}else{setError('');setReport(result);}}
 return <section className="gamble-lab">
  <div className="gamble-lead"><span className="scout-kicker">EXPERIMENTAL · VIRTUAL FUNDS ONLY</span><h2>Gamble Lab · First experiment</h2><p>Build one auditable $1,000 intraday paper trader that targets a completed trade every market day, including smaller fallback experiments.</p></div>
  <div className="gamble-method" aria-label="Gamble Zone dashboard">
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}><div><span className="scout-kicker">GAMBLE ZONE · HISTORICAL SIMULATION</span><h3>Daily scoreboard</h3></div><button type="button" disabled={dashboardBusy} onClick={()=>void refreshDashboard()}>{dashboardBusy?'Loading…':'Refresh results'}</button></div>
   {dashboardError&&<p role="alert">{dashboardError}</p>}
   {daily&&<><div className="gamble-stats">
    <div><span>Illustrative bankroll</span><strong>{usd(daily.report.illustrativeBalance)}</strong></div>
    <div><span>Historical net P/L</span><strong>{usd(daily.report.cumulativePnl)}</strong></div>
    <div><span>Simulated trades</span><strong>{daily.report.simulatedTrades}</strong></div>
    <div><span>No-trade sessions</span><strong>{daily.report.noTradeSessions}</strong></div>
   </div>
   <p><small>Retrospective, completed-candle simulations from {daily.report.firstSession} through {daily.report.lastSession}. Not prospective fills, broker trades, or evidence of profitability. Starting capital $1,000.</small></p>
   <h4>What happened each day</h4>
   <div style={{display:'grid',gap:10}}>
    {[...daily.ledger].reverse().map(entry=><article key={entry.day} style={{border:'1px solid #496064',borderRadius:10,padding:12}}>
     <div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><strong>{entry.day} · {entry.selectedTicker==='NONE'?'No selection':entry.selectedTicker}</strong><strong>{entry.pnlCents>0?'+':''}{usd(entry.pnlCents/100)}</strong></div>
     <p style={{margin:'6px 0'}}> {entry.trades.length?entry.trades.length+' simulated trade(s)':entry.status.replaceAll('_',' ').toLowerCase()} · Ending cash {usd(entry.endingCashCents/100)}</p>
     {entry.trades.map((trade,i)=><small key={i} style={{display:'block'}}>{trade.shares} share(s) · {trade.strategy} · {trade.reason} · P/L {usd(trade.netPnl)}</small>)}
    </article>)}
   </div>
   <p><small>{daily.report.limitations}</small></p></>}
   <h4>Prospective decisions (no fills)</h4>
   {decisions.length===0?<p>No pre-session Gamble Zone decisions have been published yet.</p>:<div style={{display:'grid',gap:8}}>{[...decisions].reverse().slice(0,8).map((d,i)=><div key={d.targetSession+'-'+d.mode+'-'+i} style={{padding:10,border:'1px solid #496064',borderRadius:8}}><strong>{d.targetSession} · {d.mode}</strong><p>{d.action==='SKIP'?'Skipped':d.action+' '+d.symbol} · {d.reason}</p><small>Recorded {d.recordedAt}. Decision only, not an executed trade.</small></div>)}</div>}
  </div>
  <div className="gamble-warning" role="status"><strong>Not trading yet. No automatic or live trades to report.</strong><p>We have basic closed-candle signal logic, but need verified historical intraday prices to import before running a historical replay.</p></div>
  <div className="gamble-method"><h3>System status</h3><p><strong>Simulator module:</strong> {engineReady?'Available in this build':'Unavailable'}. This confirms the module is bundled, not that it passed tests or made money.</p><p><strong>Tests and deployment:</strong> <a href="https://github.com/tulsa86/smart-money-scout/actions/workflows/pages.yml" target="_blank" rel="noreferrer" style={{textDecoration:'underline'}}>View GitHub Actions results ↗</a>. The deployment workflow runs tests and a production build before publishing.</p><p><strong>Historical intraday data:</strong> GitHub Actions sync configured, pending credentials and successful run; manual CSV import also available. <strong>Backtest results:</strong> Available only after loading valid candles. <strong>Live paper trading:</strong> Not running.</p></div><div className="gamble-stats"><div><span>Strategies being built</span><strong>1</strong></div><div><span>Planned virtual capital</span><strong>$1,000</strong></div><div><span>Completed stock trades</span><strong>{portfolio?.trades??report?.trades.length??0}</strong></div><div><span>Trading status</span><strong>{portfolio||report?'Historical replay':'Not started'}</strong></div></div>
  <div className="gamble-method"><h3>Run a historical replay</h3><p><button type="button" disabled={busy} onClick={()=>void runPortfolio()}>{busy?'Loading five stocks…':'Run all 5 stocks · $1,000 shared bankroll'}</button></p>{portfolio&&<div role="status"><p><strong>Five-stock historical replay:</strong> {portfolio.trades} trades across {portfolio.entries.length} sessions; {portfolio.noTradeDays} no-trade days. Starting $1,000; ending ${portfolio.endingCash.toFixed(2)}; return {portfolio.netReturnPct.toFixed(2)}%. This is a fixed daily rotation, not optimized stock selection or live paper trading.</p><div style={{display:'grid',gap:8}}>{portfolio.entries.map(entry=><div key={entry.day} style={{padding:10,border:'1px solid #496064',borderRadius:8}}><strong>{entry.day} · {entry.symbol}</strong><p>{entry.trades.length} trades · P/L ${entry.pnl.toFixed(2)} · Cash ${entry.endingCash.toFixed(2)}</p><small>{entry.note}</small>{entry.trades.map((t,i)=><p key={i} style={{fontSize:13}}>{t.strategy} · {t.shares} shares · {t.reason} · ${t.netPnl.toFixed(2)}</p>)}</div>)}</div></div>}<p>Load a synced stock below, or paste your own CSV. The stock buttons work once the data-sync workflow succeeds.</p><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{['SPY','QQQ','NVDA','AMD','TSLA'].map(symbol=><button key={symbol} type="button" onClick={()=>void loadSymbol(symbol)}>{symbol}</button>)}</div>{loadedSymbol&&<p>Loaded: {loadedSymbol}. Press Run $1,000 replay.</p>}<p>Paste timestamped 5-minute stock data as CSV with columns <code>time,open,high,low,close,volume</code>. Use ISO timestamps with timezone offsets. Prices must be chronological, and each file should cover one stock. No data is uploaded to a server.</p><textarea aria-label="Historical candle CSV" rows={5} value={csv} onChange={e=>{setCsv(e.target.value);setLoadedSymbol('');setReport(null);}} placeholder={'time,open,high,low,close,volume\\n2026-10-20T13:30:00Z,100,101,99,100,500'} style={{width:'100%',maxWidth:'100%',boxSizing:'border-box'}}/><p><button type="button" onClick={runReplay}>Run $1,000 replay</button></p>{error&&<p role="alert">{error}</p>}{report&&<div role="status"><p><strong>Historical simulation, not live trades:</strong> {report.trades.length} completed trades. Starting $1,000; ending ${report.endingCash.toFixed(2)}; return {report.netReturnPct.toFixed(2)}%; max drawdown {report.maxDrawdownPct.toFixed(2)}%.</p><div style={{overflowX:'auto'}}><table><thead><tr><th>Entry</th><th>Strategy</th><th>Shares</th><th>Exit</th><th>Net P/L</th></tr></thead><tbody>{report.trades.map((t,i)=><tr key={i}><td>{t.entryTime}</td><td>{t.strategy}</td><td>{t.shares}</td><td>{t.reason}</td><td>${t.netPnl.toFixed(2)}</td></tr>)}</tbody></table></div></div>}</div>
  <div className="gamble-grid"><article className="gamble-strategy"><div className="gamble-strategy-top"><div><span className="gamble-index">BASELINE 01</span><h4>Breakout + volume</h4></div><span className="gamble-pending">In development</span></div><p>Primary: a completed 5-minute candle closes above the previous 20 highs with at least 1.5× average volume. Optional daily-trade mode: if no entry occurred, try a smaller fallback position late in the session. Both are experimental and unproven.</p><div className="gamble-capital"><span>Starting cash (planned)</span><strong>$1,000</strong></div><div className="gamble-detail"><p><strong>Already implemented:</strong> Candle validation and an initial entry signal with test cases.</p><p><strong>Already coded:</strong> Preliminary next-bar entries, stop/target/session exits, slippage assumptions, and a separately labeled fallback. <strong>Still required:</strong> Verified intraday data, a full trade report, and live scheduling. A trade is never guaranteed when data or buying power is insufficient.</p></div></article></div>
  <div className="gamble-method"><h3>Finish line for version 1</h3><ol><li>Load reproducible, timestamped historical 5-minute candles.</li><li>Replay completed candles without using future information.</li><li>Simulate entries, stop-losses, profit-taking, and end-of-day exits with realistic costs.</li><li>Report net return, trades, drawdown, and a matching-period passive benchmark.</li><li>Target at least one completed trade per market day, and report no-trade days honestly.</li><li>Only then consider a live 30-day paper-trading season or additional strategies.</li></ol><p>Future ideas are preserved in the repository's <a href="https://github.com/tulsa86/smart-money-scout/blob/main/IDEA_BACKLOG.md" target="_blank" rel="noreferrer" style={{textDecoration:'underline'}}>Idea Backlog</a>. No strategy has demonstrated an edge yet.</p></div>
 </section>;
}
