export function normalizeTicker(raw:string):string {
 const ticker=raw.trim().toUpperCase();
 if(!/^[A-Z]{1,5}(?:[.-][A-Z])?$/.test(ticker)) throw Error('Invalid US ticker symbol');
 return ticker;
}
export function secSearchUrl(raw:string):string {
 return 'https://www.sec.gov/edgar/search/#/q='+encodeURIComponent(normalizeTicker(raw));
}
