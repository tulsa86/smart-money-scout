export type AnnualFigure={value:number;periodStart:string;periodEnd:string;filed:string;accession:string};
export type AnnualCompany={facts:{revenue:AnnualFigure[];netIncome:AnnualFigure[]}};
export type FundamentalScore={ticker:string;score:number|null;revenueGrowth:number|null;earningsGrowth:number|null;netMargin:number|null;reasons:string[]};
const pct=(current:number,prior:number):number|null=>prior>0?(current-prior)/prior:null;
export function scoreFundamentals(ticker:string,company:AnnualCompany):FundamentalScore{
 const r=company.facts.revenue??[],n=company.facts.netIncome??[];
 const reasons:string[]=[];
 if(!r[0]||!n[0]||r[0].periodStart!==n[0].periodStart||r[0].periodEnd!==n[0].periodEnd||r[0].value<=0){
  return {ticker,score:null,revenueGrowth:null,earningsGrowth:null,netMargin:null,reasons:['Missing or mismatched annual financial data']};
 }
 const revenueGrowth=r[1]?pct(r[0].value,r[1].value):null;
 const earningsGrowth=n[1]?pct(n[0].value,n[1].value):null;
 const netMargin=n[0].value/r[0].value;
 // Missing history is not scored as zero growth: withhold the composite.
 if(revenueGrowth===null||earningsGrowth===null){
  return {ticker,score:null,revenueGrowth,earningsGrowth,netMargin,reasons:['Insufficient comparable annual history']};
 }
 // A bounded, transparent 0-100 quality/momentum score, NOT a valuation.
 const clamp=(x:number)=>Math.max(0,Math.min(1,x));
 const score=Math.round(100*(0.4*clamp((revenueGrowth+0.1)/0.4)+0.3*clamp((earningsGrowth+0.2)/0.6)+0.3*clamp(netMargin/0.3)));
 reasons.push('Revenue growth '+(revenueGrowth*100).toFixed(1)+'%');
 reasons.push('Net income growth '+(earningsGrowth*100).toFixed(1)+'%');
 reasons.push('Net profit margin '+(netMargin*100).toFixed(1)+'%');
 reasons.push('Fundamental score only; valuation and market price not included');
 return {ticker,score,revenueGrowth,earningsGrowth,netMargin,reasons};
}
