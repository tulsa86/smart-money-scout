import React,{useState} from 'react';
import {normalizeTicker,secSearchUrl} from './stocks/research';
export default function StockResearch(){
 const [input,setInput]=useState(''),[ticker,setTicker]=useState(''),[error,setError]=useState('');
 function submit(e:React.FormEvent){e.preventDefault();try{setTicker(normalizeTicker(input));setError('')}catch(err){setError((err as Error).message);setTicker('')}}
 return <section className="panel" style={{padding:24}}>
 <h2>Stock research · Foundation</h2>
 <p>U.S. equities. Research only. No verified live market data or AI stock ratings are connected yet.</p>
 <form onSubmit={submit} style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'end',margin:'20px 0'}}>
 <label style={{display:'grid',gap:6}}>Stock ticker<input value={input} onChange={e=>setInput(e.target.value)} placeholder="MSFT" aria-label="Stock ticker" style={{padding:10,background:'#17242a',border:'1px solid #42525b',borderRadius:7,color:'inherit'}}/></label>
 <button className="button" type="submit">Research company</button></form>
 {error&&<p role="alert">{error}</p>}
 {ticker&&<div style={{border:'1px solid #34464c',borderRadius:10,padding:16}}>
 <h3>{ticker} · Unverified research request</h3>
 <p>Company identity: not yet verified. Historical security identifiers and exchange listings will be required.</p>
 <p>Financial fundamentals: awaiting a point-in-time filings provider.</p>
 <p>Price, volume, catalysts, and insider activity: no data connected.</p>
 <a href={secSearchUrl(ticker)} target="_blank" rel="noopener noreferrer" style={{textDecoration:'underline',color:'#8ae8ba'}}>Open SEC EDGAR search for {ticker} ↗</a>
 <p style={{fontSize:12,opacity:.75}}>SEC search results must be checked against the issuer and filing date. A ticker match alone is not proof of identity.</p>
 </div>}
 <p style={{fontSize:12,opacity:.75}}>Data rule: missing evidence stays missing. No invented prices, scores, or backtest results.</p>
 </section>;
}