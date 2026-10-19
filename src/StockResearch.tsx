import React,{useState} from 'react';
import {normalizeTicker,secSearchUrl,matchSecCompany,type SecCompany} from './stocks/research';
export default function StockResearch(){
 const [input,setInput]=useState(''),[ticker,setTicker]=useState(''),[error,setError]=useState('');const [company,setCompany]=useState<SecCompany|null>(null);const [sourceDate,setSourceDate]=useState('');
 async function submit(e:React.FormEvent){e.preventDefault();setCompany(null);setSourceDate('');try{const symbol=normalizeTicker(input);setTicker(symbol);setError('');const response=await fetch('/smart-money-scout/'+'stocks/sec-companies.json',{cache:'no-store'});if(!response.ok)throw Error('SEC directory not yet loaded. Run the manual SEC company refresh workflow.');const data=await response.json();if(!Array.isArray(data.companies)||typeof data.asOf!=='string')throw Error('Invalid SEC directory snapshot');const matches=matchSecCompany(data.companies,symbol);if(matches.length===1)setCompany(matches[0]);else if(matches.length===0)setError('Ticker not found in current SEC directory. It may be unlisted, renamed, or unavailable.');else setError('Ambiguous ticker in SEC directory; company identity requires manual review.');setSourceDate(data.asOf)}catch(err){setError((err as Error).message)}}
 return <section className="panel" style={{padding:24}}>
 <h2>Stock research · Foundation</h2>
 <p>U.S. equities. Research only. No verified live market data or AI stock ratings are connected yet.</p>
 <form onSubmit={submit} style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'end',margin:'20px 0'}}>
 <label style={{display:'grid',gap:6}}>Stock ticker<input value={input} onChange={e=>setInput(e.target.value)} placeholder="MSFT" aria-label="Stock ticker" style={{padding:10,background:'#17242a',border:'1px solid #42525b',borderRadius:7,color:'inherit'}}/></label>
 <button className="button" type="submit">Research company</button></form>
 {error&&<p role="alert">{error}</p>}
 {ticker&&<div style={{border:'1px solid #34464c',borderRadius:10,padding:16}}>
 <h3>{ticker} · Company research</h3>
 {company?<p><strong>SEC directory match:</strong> {company.name} · CIK {company.cik}. Snapshot: {new Date(sourceDate).toLocaleString()}. Verify listing and corporate history separately.</p>:<p>Company identity: not yet verified. Historical security identifiers and exchange listings will be required.</p>}
 <p>Financial fundamentals: awaiting a point-in-time filings provider.</p>
 <p>Price, volume, catalysts, and insider activity: no data connected.</p>
 <a href={secSearchUrl(ticker)} target="_blank" rel="noopener noreferrer" style={{textDecoration:'underline',color:'#8ae8ba'}}>Open SEC EDGAR search for {ticker} ↗</a>
 <p style={{fontSize:12,opacity:.75}}>SEC search results must be checked against the issuer and filing date. A ticker match alone is not proof of identity.</p>
 </div>}
 <p style={{fontSize:12,opacity:.75}}>Data rule: missing evidence stays missing. No invented prices, scores, or backtest results.</p>
 </section>;
}