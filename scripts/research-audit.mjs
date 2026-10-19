import fs from 'node:fs/promises';
const root='public/research';
const summary=JSON.parse(await fs.readFile(root+'/summary.json','utf8'));
const dirs=(await fs.readdir(root,{withFileTypes:true})).filter(x=>x.isDirectory()&&/^\d{4}-\d{2}-\d{2}$/.test(x.name)).map(x=>x.name).sort();
const readLines=async file=>{try{return (await fs.readFile(file,'utf8')).trim().split('\n').filter(Boolean).map(s=>JSON.parse(s))}catch(e){if(e.code==='ENOENT')return [];throw e}};
const observations=[],outcomes=[];
for(const d of dirs){observations.push(...await readLines(root+'/'+d+'/observations.ndjson'));outcomes.push(...await readLines(root+'/'+d+'/outcomes.ndjson'))}
const uniqueTokens=new Set(observations.map(x=>x.id)).size;
const tokenCounts=new Map();for(const o of observations)tokenCounts.set(o.id,(tokenCounts.get(o.id)||0)+1);
const concentration=[...tokenCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id,count])=>({id,count,sharePct:observations.length?Math.round(1000*count/observations.length)/10:0}));
const delays=outcomes.filter(x=>Number.isFinite(x.delayMinutes)).map(x=>x.delayMinutes).sort((a,b)=>a-b);
const percentile=p=>delays.length?delays[Math.min(delays.length-1,Math.floor((delays.length-1)*p))]:null;
const near=outcomes.filter(x=>x.status==='observed'&&Number.isFinite(x.delayMinutes)&&x.delayMinutes<=10).length;
const duplicateObservations=observations.length-new Set(observations.map(x=>x.id+':'+x.time)).size;
const duplicateOutcomes=outcomes.length-new Set(outcomes.map(x=>x.id+':'+x.observedAt+':'+x.horizonMinutes)).size;
const report={generatedAt:Date.now(),totalObservations:observations.length,uniqueTokens,repeatObservationPct:observations.length?Math.round(100*(1-uniqueTokens/observations.length)*10)/10:0,totalOutcomes:outcomes.length,nearTargetOutcomes:near,nearTargetPct:outcomes.length?Math.round(near/outcomes.length*1000)/10:0,delayMinutes:{median:percentile(.5),p90:percentile(.9),max:delays.at(-1)??null},duplicateObservations,duplicateOutcomes,topRepeatedTokens:concentration,summaryMatchesFiles:summary.observations===observations.length&&summary.outcomes===outcomes.length,warning:'These are delayed observations, not guaranteed exact-horizon prices or independent predictions. Sample is biased toward high-liquidity tokens in promotional discovery feeds.'};
await fs.writeFile(root+'/quality.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
