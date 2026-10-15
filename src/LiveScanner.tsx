import React,{useEffect,useState} from 'react';
type Pair={chainId?:string;dexId?:string;url?:string;pairAddress?:string;baseToken?:{address?:string;name?:string;symbol?:string};priceUsd?:string;priceChange?:Record<string,number>;volume?:Record<string,number>;liquidity?:{usd?:number};marketCap?:number;fdv?:number;pairCreatedAt?:number};
type Profile={chainId?:string;tokenAddress?:string};
type Row={id:string;pair:Pair};
const root='https://api.dexscreener.com';
function number(v:unknown){const n=Number(v);return Number.isFinite(n)&&n>=0?n:null}
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
 const filtered=rows.filter(r=>(number(r.pair.liquidity?.usd)??0)>=minLiquidity&&(number(r.pair.volume?.h24)??0)>=minVolume);
 return <section className="panel scanner"><div className="panel-head"><div><h2>Live Solana market discovery</h2><p>DEX Screener latest token profiles. This is a limited discovery feed, NOT a complete market scan or a trading recommendation.</p></div></div>
 <div style={{padding:'12px 20px',display:'flex',gap:16,flexWrap:'wrap',alignItems:'center'}}>
 <label>Minimum liquidity (USD) <input type="number" min="0" value={minLiquidity} onChange={e=>setMinLiquidity(Math.max(0,Number(e.target.value)||0))} style={{width:110}}/></label>
 <label>Minimum 24h volume (USD) <input type="number" min="0" value={minVolume} onChange={e=>setMinVolume(Math.max(0,Number(e.target.value)||0))} style={{width:110}}/></label>
 <span>{loading?'Loading live data…':updated?'Last fetched: '+new Date(updated).toLocaleTimeString():'Not yet fetched'}</span>
 </div>
 {error&&<div className="error" role="alert">Live feed unavailable: {error}. No mock data substituted.</div>}
 <div className="table-scroll"><table><thead><tr><th>Token</th><th>USD price</th><th>5m</th><th>1h</th><th>24h</th><th>Liquidity</th><th>24h volume</th><th>Market cap / FDV</th><th>Age</th><th>Source</th></tr></thead><tbody>
 {filtered.map(({id,pair:p})=><tr key={id}><td><b>{p.baseToken?.symbol||'Unknown'}</b><small className="block">{p.baseToken?.name||id.slice(0,8)} · {id.slice(0,6)}…</small></td><td>{usd(number(p.priceUsd))}</td>{(['m5','h1','h24'] as const).map(k=><td key={k}>{typeof p.priceChange?.[k]==='number'?p.priceChange[k].toFixed(2)+'%':'N/A'}</td>)}<td>{usd(number(p.liquidity?.usd))}</td><td>{usd(number(p.volume?.h24))}</td><td>{p.marketCap!=null?'Cap '+usd(number(p.marketCap)):p.fdv!=null?'FDV '+usd(number(p.fdv)):'N/A'}</td><td>{p.pairCreatedAt?Math.max(0,Math.floor((Date.now()-p.pairCreatedAt)/86400000))+'d':'N/A'}</td><td>{p.url?.startsWith('https://dexscreener.com/')?<a href={p.url} target="_blank" rel="noopener noreferrer">DEX ↗</a>:'N/A'}</td></tr>)}
 </tbody></table></div>
 {!loading&&!filtered.length&&<p style={{padding:20}}>No discovered tokens match these filters. The latest-profiles feed is limited.</p>}
 <div className="table-footer">LIVE RESEARCH ONLY · No live prices are used to value or execute existing mock positions. Refreshes every 60 seconds while this page is open and visible.</div></section>
}