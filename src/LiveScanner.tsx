import React,{useEffect,useState} from 'react';
type Pair={chainId?:string;dexId?:string;url?:string;pairAddress?:string;baseToken?:{address?:string;name?:string;symbol?:string};priceUsd?:string;priceChange?:Record<string,number>;volume?:Record<string,number>;liquidity?:{usd?:number};marketCap?:number;fdv?:number;pairCreatedAt?:number};
type Profile={chainId?:string;tokenAddress?:string};
type Row={id:string;pair:Pair};
const root='https://api.dexscreener.com';
function number(v:unknown){if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)&&n>=0?n:null}
function score(p:Pair){const liq=number(p.liquidity?.usd),vol=number(p.volume?.h24),change=p.priceChange?.h1;const notes:string[]=[];if(liq===null||vol===null)return {value:0,notes:['Insufficient liquidity/volume data']};let value=0;if(liq>=100000){value+=30;notes.push('Liquidity $100k+')}else if(liq>=25000){value+=15;notes.push('Liquidity $25k+')}else notes.push('Thin liquidity');if(vol>=liq*2){value+=25;notes.push('24h volume ≥ 2× liquidity')}else if(vol>=liq){value+=15;notes.push('24h volume ≥ liquidity')}if(typeof change==='number'&&change>=3&&change<=25){value+=25;notes.push('1h momentum +3% to +25%')}else if(typeof change==='number'&&change>50)notes.push('Extreme 1h move; high risk');if(p.pairCreatedAt){const age=(Date.now()-p.pairCreatedAt)/86400000;if(age>=7){value+=20;notes.push('Pair age ≥ 7 days')}else if(age<1)notes.push('New pair; high risk')}return {value,notes}}
export async function getLivePairs(signal?:AbortSignal):Promise<Row[]>{
 const response=await fetch(root+'/token-profiles/latest/v1',{signal});
 if(!response.ok)throw Error('Token discovery HTTP '+response.status);
 const profiles:unknown=await response.json();
 if(!Array.isArray(profiles))throw Error('Invalid discovery response');
 const addresses=[...new Set((profiles as Profile[]).filter(p=>p.chainId==='solana'&&typeof p.tokenAddress==='string'&&/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(p.tokenAddress)).map(p=>p.tokenAddress!))].slice(0,20);
 if(!addresses.length)return [];
 const market=await fetch(root+'/tokens/v1/solana/'+addresses.join(','),{signal});
 if(!market.ok)throw Error('Market data HTTP '+market.status);
 const raw:unknown=await market.json();
 if(!Array.isArray(raw))throw Error('Invalid market response');
 const byToken=new Map<string,Pair>();
 for(const p of raw as Pair[]){
  if(p?.chainId!=='solana'||!p.baseToken?.address||number(p.priceUsd)===null)continue;
  const id=p.baseToken.address;
  if(!addresses.includes(id))continue;
  const previous=byToken.get(id);
  if(!previous||(number(p.liquidity?.usd)??0)>(number(previous.liquidity?.usd)??0))byToken.set(id,p);
 }
 return [...byToken.entries()].map(([id,pair])=>({id,pair})).sort((a,b)=>(number(b.pair.volume?.h24)??0)-(number(a.pair.volume?.h24)??0));
}
const usd=(n:number|null)=>n===null?'N/A':n<0.01?'$'+n.toPrecision(4):n.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
export default function LiveScanner(){
 const [rows,setRows]=useState<Row[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[updated,setUpdated]=useState<number|null>(null);
 const [minLiquidity,setMinLiquidity]=useState(10000),[minVolume,setMinVolume]=useState(10000);
 useEffect(()=>{let active=true;const controller=new AbortController();async function refresh(){try{const result=await getLivePairs(controller.signal);if(!active)return;setRows(result);setUpdated(Date.now());setError('')}catch(e){if(active)setError(e instanceof Error?e.message:'Unknown market error')}finally{if(active)setLoading(false)}}
 refresh();const timer=setInterval(()=>{if(document.visibilityState==='visible')refresh()},60000);
 return()=>{active=false;controller.abort();clearInterval(timer)}},[]);
 const filtered=rows.filter(r=>(number(r.pair.liquidity?.usd)??0)>=minLiquidity&&(number(r.pair.volume?.h24)??0)>=minVolume).sort((a,b)=>score(b.pair).value-score(a.pair).value);
 return <section className="panel scanner"><div className="panel-head"><div><h2>Live Solana market discovery</h2><p>DEX Screener latest token profiles. This is a limited discovery feed, NOT a complete market scan or a trading recommendation.</p></div></div>
 <div style={{padding:'12px 20px',display:'flex',gap:16,flexWrap:'wrap',alignItems:'center'}}>
 <label>Minimum liquidity (USD) <input type="number" min="0" value={minLiquidity} onChange={e=>setMinLiquidity(Math.max(0,Number(e.target.value)||0))} style={{width:110}}/></label>
 <label>Minimum 24h volume (USD) <input type="number" min="0" value={minVolume} onChange={e=>setMinVolume(Math.max(0,Number(e.target.value)||0))} style={{width:110}}/></label>
 <span>{loading?'Loading live data…':updated?'Last fetched: '+new Date(updated).toLocaleTimeString():'Not yet fetched'}</span>
 </div>
 {error&&<div className="error" role="alert">Live feed unavailable: {error}. No mock data substituted.</div>}
 <div style={{padding:'0 20px 12px',fontSize:13,opacity:.8}}>Research score (0–100) ranks only discovered pairs using liquidity, 24h volume relative to liquidity, 1h momentum, and pair age. It is NOT a predicted return, scam check, wallet signal, or buy recommendation. No historical spike detection yet.</div>
 <div className="scanner-cards" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,260px),1fr))',gap:12,padding:'8px 16px'}}>
 {filtered.map(({id,pair:p})=>{const s=score(p);return <article key={id} style={{border:'1px solid #34464c',borderRadius:12,padding:16,background:'#101b20',minWidth:0}}>
 <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'start'}}><div style={{minWidth:0}}><strong>{p.baseToken?.symbol||'Unknown'}</strong><div style={{fontSize:12,opacity:.7,overflowWrap:'anywhere'}}>{p.baseToken?.name||id.slice(0,8)}</div></div><strong title="Heuristic research score, not predicted profit">{s.value}/100</strong></div>
 <div style={{fontSize:22,fontWeight:700,margin:'12px 0'}}>{usd(number(p.priceUsd))}</div>
 <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,fontSize:13}}>
 <span>5m: {typeof p.priceChange?.m5==='number'?p.priceChange.m5.toFixed(2)+'%':'N/A'}</span><span>1h: {typeof p.priceChange?.h1==='number'?p.priceChange.h1.toFixed(2)+'%':'N/A'}</span>
 <span>24h: {typeof p.priceChange?.h24==='number'?p.priceChange.h24.toFixed(2)+'%':'N/A'}</span><span>Age: {p.pairCreatedAt?Math.max(0,Math.floor((Date.now()-p.pairCreatedAt)/86400000))+'d':'N/A'}</span>
 <span>Liquidity: {usd(number(p.liquidity?.usd))}</span><span>24h volume: {usd(number(p.volume?.h24))}</span>
 </div><div style={{fontSize:12,opacity:.75,marginTop:12}}>{s.notes.join(' · ')||'No positive signals'}</div>
 <div style={{fontSize:11,opacity:.6,marginTop:8,overflowWrap:'anywhere'}}>Mint: {id}</div>
 {p.url?.startsWith('https://dexscreener.com/')&&<a href={p.url} target="_blank" rel="noopener noreferrer" style={{display:'inline-block',marginTop:12}}>View on DEX Screener ↗</a>}
 </article>})}</div>
 <div className="table-scroll" style={{display:"none"}}><table><thead><tr><th>Token</th><th>USD price</th><th>5m</th><th>1h</th><th>24h</th><th>Liquidity</th><th>24h volume</th><th>Market cap / FDV</th><th>Age</th><th>Source</th></tr></thead><tbody>
 {filtered.map(({id,pair:p})=><tr key={id}><td><b>{p.baseToken?.symbol||'Unknown'}</b><small className="block">{p.baseToken?.name||id.slice(0,8)} · {id.slice(0,6)}…</small></td><td>{usd(number(p.priceUsd))}</td>{(['m5','h1','h24'] as const).map(k=><td key={k}>{typeof p.priceChange?.[k]==='number'?p.priceChange[k].toFixed(2)+'%':'N/A'}</td>)}<td>{usd(number(p.liquidity?.usd))}</td><td>{usd(number(p.volume?.h24))}</td><td>{p.marketCap!=null?'Cap '+usd(number(p.marketCap)):p.fdv!=null?'FDV '+usd(number(p.fdv)):'N/A'}</td><td>{p.pairCreatedAt?Math.max(0,Math.floor((Date.now()-p.pairCreatedAt)/86400000))+'d':'N/A'}</td><td>{p.url?.startsWith('https://dexscreener.com/')?<a href={p.url} target="_blank" rel="noopener noreferrer">DEX ↗</a>:'N/A'}</td></tr>)}
 </tbody></table></div>
 {!loading&&!filtered.length&&<p style={{padding:20}}>No discovered tokens match these filters. The latest-profiles feed is limited.</p>}
 <div className="table-footer">LIVE RESEARCH ONLY · No live prices are used to value or execute existing mock positions. Refreshes every 60 seconds while this page is open and visible.</div></section>
}