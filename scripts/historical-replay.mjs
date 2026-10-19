import fs from 'node:fs/promises';
const FEE=0.01,DAY=86400000;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export function replay(observations,{startingCash=100,positionSize=10,maxPositions=3}={}){
 if(!Array.isArray(observations))throw Error('Expected observations array');
 const sorted=[...observations].sort((a,b)=>a.time-b.time||String(a.id).localeCompare(String(b.id)));
 const state={cash:startingCash,positions:[],trades:[],entries:0,missingQuotes:0,skipped:0};
 const times=[...new Set(sorted.filter(o=>finite(o.time)).map(o=>o.time))];
 let cursor=0;
 for(const time of times){
  const batch=[];
  while(cursor<sorted.length&&sorted[cursor].time===time)batch.push(sorted[cursor++]);
  const quotes=new Map();
  for(const o of batch)if(typeof o.id==='string'&&finite(o.price)&&o.price>0){
   const previous=quotes.get(o.id);
   if(!previous||(finite(o.liquidityUsd)?o.liquidityUsd:0)>(finite(previous.liquidityUsd)?previous.liquidityUsd:0))quotes.set(o.id,o);
  }
  const remaining=[];
  for(const p of state.positions){
   const q=quotes.get(p.id);
   if(!q){state.missingQuotes++;remaining.push(p);continue}
   const received=p.units*q.price*(1-FEE),pnl=received-p.spent,ret=pnl/p.spent;
   const reason=ret<=-0.1?'Stop loss':ret>=0.2?'Take profit':time-p.opened>=DAY?'24-hour time exit':null;
   if(reason){state.cash+=received;state.trades.push({id:p.id,opened:p.opened,closed:time,entry:p.entry,exit:q.price,spent:p.spent,received,pnl,reason})}
   else remaining.push(p);
  }
  state.positions=remaining;
  const eligible=[...quotes.values()].filter(o=>{
   const age=finite(o.pairCreatedAt)?(time-o.pairCreatedAt)/DAY:null;
   return finite(o.liquidityUsd)&&o.liquidityUsd>=100000&&finite(o.volume24hUsd)&&o.volume24hUsd>=o.liquidityUsd&&finite(o.change1hPct)&&o.change1hPct>=3&&o.change1hPct<=25&&age!==null&&age>=7&&!state.positions.some(p=>p.id===o.id)&&!state.trades.some(t=>t.id===o.id&&time-t.closed<DAY);
  }).sort((a,b)=>b.liquidityUsd-a.liquidityUsd||a.id.localeCompare(b.id));
  for(const o of eligible){
   if(state.positions.length>=maxPositions||state.cash<positionSize)break;
   state.cash-=positionSize;
   state.positions.push({id:o.id,opened:time,entry:o.price,units:positionSize*(1-FEE)/o.price,spent:positionSize,last:o.price});
   state.entries++;
  }
 }
 const lastTime=times.at(-1)??null;
 const lastQuotes=new Map(sorted.filter(o=>finite(o.price)&&o.price>0).map(o=>[o.id,o.price]));
 const markedValue=state.positions.reduce((sum,p)=>sum+p.units*(lastQuotes.get(p.id)??p.last)*(1-FEE),0);
 return {status:'EXPLORATORY_REPLAY_ONLY',warning:'Sparse snapshots, promotion-feed selection bias, absent quotes, and unmodeled liquidity/slippage make this unsuitable as a profitability estimate. Unseen prices are never interpolated. Open positions are marked using last observed prices and may be stale.',snapshots:times.length,observations:sorted.length,uniqueTokens:new Set(sorted.map(o=>o.id)).size,firstTime:times[0]??null,lastTime,entries:state.entries,closedTrades:state.trades.length,missingQuotes:state.missingQuotes,cash:state.cash,markedValue,markedEquity:state.cash+markedValue,positions:state.positions,trades:state.trades};
}
export async function readHistory(root='public/research'){
 const dirs=(await fs.readdir(root,{withFileTypes:true})).filter(d=>d.isDirectory()&&/^\d{4}-\d{2}-\d{2}$/.test(d.name)).map(d=>d.name).sort();
 const observations=[];
 for(const d of dirs){
  try{const raw=await fs.readFile(root+'/'+d+'/observations.ndjson','utf8');for(const line of raw.split('\n'))if(line.trim())observations.push(JSON.parse(line))}
  catch(e){if(e.code!=='ENOENT')throw e}
 }
 return observations;
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 const observations=await readHistory();
 const report=replay(observations);
 await fs.writeFile('public/research/replay.json',JSON.stringify(report,null,2)+'\n');
 console.log('Replay complete: '+report.snapshots+' timestamps, '+report.closedTrades+' closed trades. Exploratory only.');
}
