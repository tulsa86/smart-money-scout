export function normalizeTicker(raw:string):string {
 const ticker=raw.trim().toUpperCase();
 if(!/^[A-Z]{1,5}(?:[.-][A-Z])?$/.test(ticker)) throw Error('Invalid US ticker symbol');
 return ticker;
}
export function secSearchUrl(raw:string):string {
 return 'https://www.sec.gov/edgar/search/#/q='+encodeURIComponent(normalizeTicker(raw));
}

export type SecCompany={ticker:string;name:string;cik:string};
export function parseSecTickerMap(input:unknown):SecCompany[]{
 if(!input||typeof input!=='object')throw Error('Invalid SEC ticker directory');
 const values=Object.values(input);
 const result:SecCompany[]=[];
 for(const row of values){
  if(!row||typeof row!=='object')continue;
  const x=row as Record<string,unknown>;
  if(typeof x.ticker!=='string'||typeof x.title!=='string'||!Number.isSafeInteger(x.cik_str)||Number(x.cik_str)<=0)continue;
  try{result.push({ticker:normalizeTicker(x.ticker),name:x.title,cik:String(x.cik_str).padStart(10,'0')})}catch{}
 }
 return result;
}
export function matchSecCompany(input:SecCompany[],raw:string):SecCompany[]{
 const ticker=normalizeTicker(raw);
 return input.filter(x=>x.ticker===ticker);
}
