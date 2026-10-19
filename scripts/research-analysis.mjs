import fs from 'node:fs/promises';
const root='public/research';
const horizons=[15,60,240,1440];
const read=async p=>{try{return (await fs.readFile(p,'utf8')).split('\n').filter(Boolean).map(JSON.parse)}catch(e){if(e.code==='ENOENT')return [];throw e}};
const dirs=(await fs.readdir(root,{withFileTypes:true})).filter(x=>x.isDirectory()&&/^\d{4}-\d{2}-\d{2}$/.test(x.name)).map(x=>x.name).sort();
const observations=[],outcomes=[];
for(const d of dirs){observations.push(...await read(root+'/'+d+'/observations.ndjson'));outcomes.push(...await read(root+'/'+d+'/outcomes.ndjson'))}
const key=(id,t)=>id+'|'+t;
const obs=new Map(observations.map(x=>[key(x.id,x.time),x]));
const median=arr=>{const s=[...arr].sort((a,b)=>a-b);return s.length?s[Math.floor((s.length-1)/2)]:null};
const features={
 liquidity:[['below $100k',x=>x.liquidityUsd<100000],['$100k or more',x=>x.liquidityUsd>=100000]],
 momentum:[['negative 1h',x=>x.change1hPct<0],['0% to 3%',x=>x.change1hPct>=0&&x.change1hPct<3],['3% or more',x=>x.change1hPct>=3]],
 age:[['under 7 days',x=>x.ageDays<7],['7 days or older',x=>x.ageDays>=7]]
};
const report={generatedAt:Date.now(),status:'EXPLORATORY_ONLY',warning:'Descriptive associations, not forecasts, causal effects, trading signals, or net executable returns. Biased discovery, repeated tokens and delayed observations limit validity.',observations:observations.length,distinctTokens:new Set(observations.map(x=>x.id)).size,horizons:{}};
for(const h of horizons){
 // The first observation per token per horizon is used to reduce overlapping examples.
 // Exact-horizon eligibility is strict; delayed quotes are excluded.
 const eligible=outcomes.filter(x=>x.horizonMinutes===h&&x.status==='observed'&&Number.isFinite(x.returnPct)&&Number.isFinite(x.delayMinutes)&&x.delayMinutes>=0&&x.delayMinutes<=10&&obs.has(key(x.id,x.observedAt))).sort((a,b)=>a.observedAt-b.observedAt);
 const byToken=new Map();
 for(const x of eligible)if(!byToken.has(x.id))byToken.set(x.id,x);
 const rows=[...byToken.values()].map(x=>{const o=obs.get(key(x.id,x.observedAt));return {id:x.id,returnPct:x.returnPct,liquidityUsd:o.liquidityUsd,change1hPct:o.change1hPct,ageDays:Number.isFinite(o.pairCreatedAt)?(o.time-o.pairCreatedAt)/86400000:null}});
 const groups={};
 for(const [feature,buckets] of Object.entries(features)){
  groups[feature]=buckets.map(([label,predicate])=>{const r=rows.filter(x=>Number.isFinite(x[feature==='liquidity'?'liquidityUsd':feature==='momentum'?'change1hPct':'ageDays'])&&predicate(x));return {label,tokens:r.length,medianReturnPct:median(r.map(x=>x.returnPct)),positivePct:r.length?Math.round(1000*r.filter(x=>x.returnPct>0).length/r.length)/10:null}})}
 report.horizons[h]={eligibleOutcomes:eligible.length,independentTokenExamples:rows.length,groups};
}
const counts=Object.values(report.horizons).map(x=>x.independentTokenExamples);
report.readyForHypothesisTesting=counts.some(x=>x>=100);
report.note=report.readyForHypothesisTesting?'At least one horizon has 100 unique-token examples, but this alone does not establish reliability.':'Insufficient unique-token examples for even preliminary hypothesis testing. Collect more data.';
await fs.writeFile(root+'/analysis.json',JSON.stringify(report,null,2)+'\n');
console.log('Research analysis: '+report.note);
