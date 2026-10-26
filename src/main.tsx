import React,{useState} from 'react';
import{createRoot}from'react-dom/client';
import{Radar,Search,FlaskConical,ChartNoAxesCombined}from'lucide-react';
import StockResearch from './StockResearch';
import ScoutPicks from './ScoutPicks';
import GambleLab from './GambleLab';
import ForwardPerformance from './ForwardPerformance';
import './style.css';

type Page='Scout Picks'|'Stock research'|'Gamble Lab'|'Forward performance';
const pages:[Page,string,typeof Radar][]=[
 ['Scout Picks','Discover',Radar],
 ['Stock research','Research',Search],
 ['Gamble Lab','Gamble Lab',FlaskConical],
 ['Forward performance','Performance',ChartNoAxesCombined]
];
function App(){
 const [page,setPage]=useState<Page>('Scout Picks');
 return <div className="shell scout-focused">
  <aside>
   <div className="brand"><span className="brand-icon"><Radar size={25}/></span><span>smart money<span className="brand-sub">SCOUT</span></span></div>
   <div className="workspace-label">STOCK RESEARCH</div>
   <nav aria-label="Main navigation">{pages.map(([id,label,Icon])=><button type="button" key={id} className={page===id?'selected':''} aria-current={page===id?'page':undefined} onClick={()=>setPage(id)}><Icon size={18}/><span className="nav-label">{label}</span></button>)}</nav>
   <div className="side-bottom"><div className="sandbox"><span className="dot"/> Research workspace<p>Stock analysis and planned simulations. No real trades.</p><div><span>Market</span><b>U.S. stocks</b></div><div><span>Execution</span><b className="amber">Not active</b></div></div><div className="profile"><span className="avatar">S</span><div>Scout workspace<small>Research · development</small></div></div></div>
  </aside>
  <div className="main-wrap"><header><div className="breadcrumb">Smart Money Scout / <span>{page}</span></div><div className="header-right"><span className="paper"><span className="dot"/> RESEARCH ONLY</span><span className="avatar mini">S</span></div></header>
   <main><div className="page-heading"><div><div className="eyebrow">YOUR RESEARCH. YOUR RULES.</div><h1>{page}</h1><p>{page==='Scout Picks'?'Financial screening leads, not buy recommendations.':page==='Stock research'?'Explore SEC filings and compare reported company fundamentals.' :page==='Gamble Lab'?'Historical strategy experiments and simulated results.':'Automated daily decision history and simulated performance.'}</p></div></div>
   {page==='Scout Picks'&&<ScoutPicks onResearch={()=>setPage('Stock research')}/>}
   {page==='Stock research'&&<StockResearch/>}
   {page==='Gamble Lab'&&<GambleLab/>}
   {page==='Forward performance'&&<ForwardPerformance/>}
   </main>
  </div>
 </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
