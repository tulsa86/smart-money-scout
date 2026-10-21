import fs from 'node:fs/promises';
import {annualFacts,validateLatestAnnualPeriods} from './annual-facts.mjs';
const agent=process.env.SEC_USER_AGENT?.trim();
if(!agent||!agent.includes('@'))throw Error('SEC_USER_AGENT is required');
// Broad initial universe across technology, finance, health, consumer, energy, industrials and telecom.
const symbols=['AAPL','MSFT','NVDA','GOOGL','AMZN','META','ORCL','JPM','BAC','WFC','GS','UNH','JNJ','PFE','ABBV','WMT','COST','HD','MCD','KO','XOM','CVX','CAT','DE','VZ'];
const directory=JSON.parse(await fs.readFile('public/stocks/sec-companies.json','utf8'));
const output={source:'https://data.sec.gov/api/xbrl/companyfacts/',asOf:new Date().toISOString(),status:'ANNUAL_10K_FACTS_WITH_FILING_DATES_NOT_INVESTMENT_SIGNALS',companies:{},skipped:{}};
for(const symbol of symbols){
 try{
 const matches=directory.companies.filter(c=>c.ticker===symbol);
 if(matches.length!==1)throw Error('Cannot uniquely resolve '+symbol);
 const company=matches[0];
 const url=output.source+'CIK'+company.cik+'.json';
 const response=await fetch(url,{headers:{'User-Agent':agent,'Accept':'application/json'},signal:AbortSignal.timeout(25000)});
 if(!response.ok)throw Error('SEC Company Facts '+symbol+' HTTP '+response.status);
 const document=await response.json();
 if(String(document.cik).padStart(10,'0')!==company.cik)throw Error('SEC CIK mismatch '+symbol);
 const facts=annualFacts(document);
 validateLatestAnnualPeriods(facts,symbol);
 output.companies[symbol]={name:company.name,cik:company.cik,source:url,facts};
 console.log(symbol+' annual revenue observations '+facts.revenue.length);
 }catch(error){output.skipped[symbol]=String(error?.message??error);console.warn('Skipping '+symbol+': '+output.skipped[symbol]);}
 await new Promise(resolve=>setTimeout(resolve,400));
}
if(Object.keys(output.companies).length<3)throw Error('Too few valid SEC annual company records; refusing to overwrite snapshot');
await fs.mkdir('public/stocks',{recursive:true});
await fs.writeFile('public/stocks/annual-facts.json',JSON.stringify(output)+'\n');
