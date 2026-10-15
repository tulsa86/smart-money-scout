import React,{useEffect,useRef,useState} from 'react';
import {getLivePairs} from './LiveScanner';
type Position={id:string;symbol:string;units:number;entry:number;spent:number;opened:number;last:number;reason:string};
type Trade={symbol:string;entry:number;exit:number;spent:number;received:number;pnl:number;opened:number;closed:number;reason:string};
type Event={time:number;message:string};
type Account={cash:number;positions:Position[];trades:Trade[];events:Event[];lastCheck:number|null;enabled:boolean};
const KEY='sms-live-paper-v1';
const fresh=():Account=>({cash:100,positions:[],trades:[],events:[],lastCheck:null,enabled:false});
const money=(v:number)=>v.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
const fmt=(v:number)=>v<0.01?'$'+v.toPrecision(4):money(v);
const FEE=.01; // assumed 1% per side, including adverse execution and fees
const ageHours=(t:number)=> (Date.now()-t)/3600000;
function read():Account{try{const raw=localStorage.getItem(KEY);if(!raw)return fresh();const a=JSON.parse(raw);if(!a||typeof a.cash!=='number'||!Array.isArray(a.positions)||!Array.isArray(a.trades)||!Array.isArray(a.events)||typeof a.enabled!=='boolean')throw Error('Invalid saved account');return a}catch{return {...fresh(),enabled:false,events:[{time:Date.now(),message:'Saved account unreadable; automation paused. Review storage before continuing.'}]}}}
export default function AutoPaper(){
 const [account,setAccount]=useState<Account>(read);
 const [status,setStatus]=useState('Waiting for first live quote');
 const busy=useRef(false);
 const current=useRef(account);
 const persist=(next:Account)=>{try{localStorage.setItem(KEY,JSON.stringify(next));current.current=next;setAccount(next)}catch{current.current={...next,enabled:false};setAccount(current.current);setStatus('Browser storage failed; automation stopped')}};
 const tick=async()=>{if(busy.current||!current.current.enabled)return;busy.current=true;
 try{const pairs=await getLivePairs();const now=Date.now();let a=current.current;let cash=a.cash;const events=[...a.events];const trades=[...a.trades];const positions:Position[]=[];
 const quotes=new Map(pairs.map(r=>[r.id,r.pair]));
 const log=(message:string)=>events.unshift({time:now,message});
 for(const p of a.positions){
 const quote=quotes.get(p.id);const live=Number(quote?.priceUsd);
 if(!quote||!Number.isFinite(live)||live<=0){positions.push(p);continue}
 const net=p.units*live*(1-FEE),pct=(net-p.spent)/p.spent;
 const reason=pct<=-.1?'Stop loss (-10%)':pct>=.2?'Take profit (+20%)':now-p.opened>=24*3600000?'24-hour exit':'';
 if(reason){cash+=net;trades.unshift({symbol:p.symbol,entry:p.entry,exit:live,spent:p.spent,received:net,pnl:net-p.spent,opened:p.opened,closed:now,reason});log('SELL '+p.symbol+' · '+reason+' · '+money(net-p.spent));}
 else positions.push({...p,last:live});
 }
 const candidates=pairs.filter(r=>{const p=r.pair,price=Number(p.priceUsd),liq=p.liquidity?.usd??0,vol=p.volume?.h24??0,h1=p.priceChange?.h1,created=p.pairCreatedAt;return price>0&&liq>=100000&&vol>=liq&&typeof h1==='number'&&h1>=3&&h1<=25&&!!created&&ageHours(created)>=168&&!positions.some(pos=>pos.id===r.id)&&!trades.some(t=>t.symbol===p.baseToken?.symbol&&now-t.closed<24*3600000)}).sort((x,y)=>(y.pair.liquidity?.usd??0)-(x.pair.liquidity?.usd??0));
 for(const r of candidates){if(positions.length>=3||cash<10)break;const p=r.pair,price=Number(p.priceUsd);if(!Number.isFinite(price)||price<=0)continue;
 const spent=10,units=spent*(1-FEE)/price;
 positions.push({id:r.id,symbol:p.baseToken?.symbol||r.id.slice(0,6),units,entry:price,spent,opened:now,last:price,reason:'Liquidity ≥ $100k, volume ≥ liquidity, 1h +3–25%, pair age ≥ 7 days'});
 cash-=spent;log('BUY '+(p.baseToken?.symbol||r.id.slice(0,6))+' · $10 paper · rule matched');
 }
 const next={...a,cash,positions,trades:trades.slice(0,300),events:events.slice(0,100),lastCheck:now};persist(next);setStatus('Checked live quotes at '+new Date(now).toLocaleTimeString()+(pairs.length?'':' · No tokens discovered'));
 }catch(e){setStatus('Live quote check failed: '+String(e)+'. No simulated orders placed.')}finally{busy.current=false}};
 useEffect(()=>{if(!account.enabled)return;void tick();const timer=setInterval(()=>{if(document.visibilityState==='visible')void tick()},60000);return()=>clearInterval(timer)},[account.enabled]);
 const holdings=account.positions.reduce((sum,p)=>sum+p.units*p.last*(1-FEE),0);
 const value=account.cash+holdings;
 return <section className="panel" style={{padding:20}}>
 <h2>Autonomous paper trader · LIVE quotes, FAKE money</h2>
 <p>This is a separate $100 test account. The original mock portfolio is unchanged. Runs only while this page is open and visible. Quotes come from a limited DEX Screener discovery feed; missing quotes do not trigger sales.</p>
 <div style={{display:'flex',gap:12,flexWrap:'wrap',margin:'16px 0'}}>
 <strong>Account: {money(value)}</strong><span>Cash: {money(account.cash)}</span><span>Open: {account.positions.length}/3</span><span>Closed: {account.trades.length}</span>
 </div>
 <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:12}}>
 <button className="button primary" onClick={()=>persist({...account,enabled:!account.enabled,events:[{time:Date.now(),message:account.enabled?'Automation paused by user':'Automation enabled by user'},...account.events].slice(0,100)})}>{account.enabled?'Pause auto paper trading':'Start auto paper trading'}</button>
 <button className="button" onClick={()=>{if(window.confirm('Reset this separate LIVE-quote paper account and delete its trades?'))persist(fresh())}}>Reset paper account</button>
 </div>
 <p role="status">{account.enabled?'● Auto paper trading ON (while tab open)':'○ Auto paper trading PAUSED'} · {status}</p>
 <p style={{fontSize:13,opacity:.8}}>Entry: $10, max 3 positions, minimum $100k liquidity, 24h volume at least liquidity, 1h gain 3–25%, pair at least 7 days old. Exit: -10%, +20%, or 24 hours. Assumed 1% adverse cost on each side. Checks once per minute while visible. No orders execute when closed. Prices between checks may be missed; this is not a realistic execution simulator.</p>
 <h3>Open paper positions</h3>
 {account.positions.length?<div style={{display:'grid',gap:8}}>{account.positions.map(p=><div key={p.id} style={{padding:12,border:'1px solid #34464c',borderRadius:8}}><strong>{p.symbol}</strong> · {money(p.units*p.last*(1-FEE))} estimated exit value · entry {fmt(p.entry)}<div style={{fontSize:12,opacity:.8}}>{p.reason} · {new Date(p.opened).toLocaleString()}</div></div>)}</div>:<p>No positions yet. Rules may find no qualifying tokens, which is preferable to inventing trades.</p>}
 <h3>Closed paper trades</h3>
 {account.trades.length?<div style={{display:'grid',gap:8}}>{account.trades.slice(0,30).map((t,i)=><div key={i}>{t.symbol} · {t.pnl>=0?'+':''}{money(t.pnl)} · {t.reason} · {new Date(t.closed).toLocaleString()}</div>)}</div>:<p>No completed trades yet.</p>}
 <h3>Decision log</h3>
 {account.events.length?<div style={{display:'grid',gap:6}}>{account.events.slice(0,25).map((e,i)=><div key={i} style={{fontSize:13}}>{new Date(e.time).toLocaleString()} · {e.message}</div>)}</div>:<p>No decisions recorded.</p>}
 <p style={{fontSize:12,marginTop:16}}>Stored only in this browser. Clearing site data or using another device will not transfer results. Never connects to a wallet or spends real funds.</p>
 </section>;
}
