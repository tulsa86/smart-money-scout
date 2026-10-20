// Extract annual figures only. Each observation retains the SEC filing date and accession.
const tags={
 revenue:['RevenueFromContractWithCustomerExcludingAssessedTax','Revenues','SalesRevenueNet'],
 netIncome:['NetIncomeLoss'],
 operatingCashFlow:['NetCashProvidedByUsedInOperatingActivities'],
 longTermDebt:['LongTermDebtCurrent','LongTermDebtNoncurrent']
};
export function annualFacts(document){
 if(!document||typeof document!=='object'||!document.facts?.['us-gaap'])throw Error('Missing US GAAP facts');
 const gaap=document.facts['us-gaap'];
 const result={};
 for(const [metric,candidates] of Object.entries(tags)){
  const series=[];
  for(const tag of candidates){
   const observations=gaap[tag]?.units?.USD;
   if(!Array.isArray(observations))continue;
   for(const f of observations){
    if(f.form!=='10-K'||f.fp!=='FY'||f.fy==null||typeof f.val!=='number'||!Number.isFinite(f.val)||!/^\d{4}-\d{2}-\d{2}$/.test(f.filed??'')||!/^\d{4}-\d{2}-\d{2}$/.test(f.end??'')||!/^\d{10}-\d{2}-\d{6}$/.test(f.accn??''))continue;
    if(metric!=='longTermDebt'){
     if(!f.start||!/^\d{4}-\d{2}-\d{2}$/.test(f.start))continue;
     const duration=(Date.parse(f.end)-Date.parse(f.start))/86400000;
     if(duration<330||duration>380)continue;
    }else if(f.start)continue;
    series.push({value:f.val,periodStart:f.start??null,periodEnd:f.end,filed:f.filed,accession:f.accn,form:f.form,tag});
   }
  }
  // Different tags for the same metric may represent different concepts.
  // Prefer the first supported tag with usable observations rather than summing them.
  const chosen=candidates.find(tag=>series.some(f=>f.tag===tag));
  const selected=series.filter(f=>f.tag===chosen).sort((a,b)=>b.periodEnd.localeCompare(a.periodEnd)||a.filed.localeCompare(b.filed));
  // Earliest filing for each annual period, avoiding later restatements in the initial snapshot.
  const byPeriod=new Map();
  for(const f of selected){const old=byPeriod.get(f.periodEnd);if(!old||f.filed<old.filed)byPeriod.set(f.periodEnd,f)}
  result[metric]=[...byPeriod.values()].sort((a,b)=>b.periodEnd.localeCompare(a.periodEnd)).slice(0,4);
 }
 return result;
}
