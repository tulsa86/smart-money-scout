import React,{useEffect,useState} from 'react';
type Position={id:string;symbol:string;units:number;entry:number;spent:number;opened:number;last:number;lastQuoteAt?:number;reason:string};
type Trade={id:string;symbol:string;pnl:number;spent:number;received:number;opened:number;closed:number;reason:string};
type Event={time:number;message:string};
type State={version:number;cash:number;positions:Position[];trades:Trade[];events:Event[];lastCheck:number|null;checked:number;qualified:number;status:string;rejections?:Record<string,number>;discovery?:{sources:string[];uniqueMints:number;requested:number;quoteBatches:number;totalBatches:number}};
const usd=(n:number)=>n.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
const date=(t:number)=>new Date(t).toLocaleString();
const reasonLabels:Record<string,string>={invalidPrice:'Invalid price',lowLiquidity:'Liquidity below $100k',lowVolume:'Volume below liquidity',momentum:'1h momentum outside +3–25%',tooNew:'Pair younger than 7 days',alreadyHeld:'Already held',cooldown:'Recently sold'};
export default function AutoPaper(){
 const [research,setResearch]=useState<{observations:number;outcomes:number;complete:number;missing:number;pending?:number;days:number;lastCapture:number|null}|null>(null);const [data,setData]=useState<State|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;const ctrl=new AbortController();
 const load=async()=>{try{const response=await fetch('https://raw.githubusercontent.com/tulsa86/smart-money-scout/main/public/paper-state.json?t='+Date.now(),{cache:'no-store',signal:ctrl.signal});if(response.status===404){if(active){setData(null);setError('Saved background account not found in GitHub.')}return}if(!response.ok)throw Error('HTTP '+response.status);const state:State=await response.json();if(state.version!==1||!Array.isArray(state.positions)||!Array.isArray(state.trades)||!Array.isArray(state.events))throw Error('Invalid account data');if(active){setData(state);setError('')}}catch(e){if(active)setError('Could not load background account: '+String(e))}finally{if(active)setLoading(false)}};
 const loadResearch=async()=>{try{const res=await fetch('https://raw.githubusercontent.com/tulsa86/smart-money-scout/main/public/research/summary.json?t='+Date.now(),{cache:'no-store'});if(res.ok){const value=await res.json();if(active)setResearch(value)}}catch{}};void load();void loadResearch();const timer=setInterval(()=>{if(document.visibilityState==='visible'){void load();void loadResearch()}},60000);return()=>{active=false;ctrl.abort();clearInterval(timer)}},[]);
 const holdings=data?.positions.reduce((n,p)=>n+p.units*p.last*.99,0)??0;
 return <section className="panel" style={{padding:20}}>
 <h2>Unattended auto paper trader · live quotes, fake money</h2>
 <p>GitHub Actions is scheduled to check every 15 minutes, but actual runs can be delayed even when your phone is off. The account is saved in the GitHub repository, not your browser. No real funds or wallets are involved.</p>
 {loading&&<p>Loading saved background account…</p>}
 {error&&<p role="alert" style={{color:'#f4ad7d'}}>{error}</p>}
 {data&&<>
 <div style={{display:'flex',gap:12,flexWrap:'wrap',margin:'16px 0'}}><strong>Estimated account: {usd(data.cash+holdings)}</strong><span>Cash: {usd(data.cash)}</span><span>Open: {data.positions.length}/3</span><span>Closed: {data.trades.length}</span></div>
 <div style={{border:'1px solid #34464c',borderRadius:10,padding:12,marginBottom:16}}>
 <strong>Last scan: {data.lastCheck?date(data.lastCheck):'Not yet run'}</strong>
 <p>{data.checked} tokens checked · {data.qualified} qualified · {data.positions.length} open positions</p>
 <p>Status: {data.status}</p>
 {data.discovery&&<p style={{fontSize:13}}>Discovery: {data.discovery.uniqueMints} unique Solana tokens across three feeds · {data.discovery.requested} requested · {data.discovery.quoteBatches}/{data.discovery.totalBatches} quote batches succeeded.</p>}
 {data.rejections&&<div style={{marginTop:12}}><strong>Why tokens did not qualify</strong><p style={{fontSize:12,opacity:.8}}>Each token can fail more than one rule, so counts overlap.</p><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:8}}>{Object.entries(data.rejections).map(([key,count])=><div key={key} style={{border:'1px solid #34464c',borderRadius:8,padding:9}}><strong>{count}</strong><div style={{fontSize:12}}>{reasonLabels[key]||key}</div></div>)}</div></div>}<p style={{fontSize:12,opacity:.8}}>Account data fetched directly from GitHub. Refreshes every minute while this page is visible.</p>
 {data.lastCheck&&Date.now()-data.lastCheck>45*60000&&<p style={{color:'#f4ad7d'}}>Warning: last check is over 45 minutes old. Scheduled runs may be delayed or stopped.</p>}
 </div>
 <h3>Market research memory</h3>
 {research?<div style={{border:'1px solid #34464c',borderRadius:10,padding:12,marginBottom:16}}><strong>{research.observations.toLocaleString()} observations collected</strong><p>{research.outcomes.toLocaleString()} future outcomes checked · {research.complete.toLocaleString()} priced · {research.missing.toLocaleString()} missing quotes · {(research.pending??0).toLocaleString()} awaiting outcomes</p><p style={{fontSize:12,opacity:.8}}>Sample: four liquid tokens per scan. Tracks prices at approximately 15 minutes, 1 hour, 4 hours and 24 hours. Scheduled runs can be delayed; missing data is not counted as a gain or loss. {research.lastCapture?'Last capture: '+date(research.lastCapture):''}</p></div>:<p style={{fontSize:13,opacity:.8}}>Research collection awaits its first successful scheduled run.</p>}
 <h3>Open positions</h3>
 {data.positions.length?data.positions.map(p=><div key={p.id} style={{padding:12,border:'1px solid #34464c',borderRadius:8,marginBottom:8}}><strong>{p.symbol}</strong> · Estimated {usd(p.units*p.last*.99)} · Entry {usd(p.spent)}<p style={{fontSize:12}}>{p.reason} · Opened {date(p.opened)} · Quote {p.lastQuoteAt?date(p.lastQuoteAt):'entry only'}</p></div>):<p>No qualifying purchases yet.</p>}
 <h3>Closed paper trades</h3>
 {data.trades.length?data.trades.slice(0,30).map((t,i)=><div key={i} style={{padding:'6px 0'}}>{t.symbol} · {t.pnl>=0?'+':''}{usd(t.pnl)} · {t.reason} · {date(t.closed)}</div>):<p>No closed trades yet.</p>}
 <h3>Decision log</h3>
 {data.events.slice(0,30).map((e,i)=><div key={i} style={{fontSize:13,padding:'5px 0'}}>{date(e.time)} · {e.message}</div>)}
 </>}
 <p style={{fontSize:12,opacity:.8,marginTop:16}}>Rules: $10 entries, 3 positions max, liquidity ≥ $100k, 24h volume ≥ liquidity, 1h gain +3–25%, pair age ≥ 7 days. Sell at approximately -10%, +20%, or 24 hours. Assumed 1% adverse execution cost per side. Scheduled quotes can miss intraperiod moves; these are indicative results, not real executable fills.</p>
 <p style={{fontSize:12,opacity:.8}}>The previous phone-local paper account is separate and is not imported. The scheduled engine is controlled by its GitHub workflow, not a Start button on this page.</p>
 </section>;
}
