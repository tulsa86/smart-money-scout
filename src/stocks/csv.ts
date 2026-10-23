import {validateCandles,type Candle} from './candles.ts';
/** Import exported 5-minute OHLCV CSV; never fabricate or silently reorder prices. */
export function parseCandleCsv(csv:string):{candles:Candle[];error?:string}{
 const lines=csv.replace(/^\uFEFF/,'').trim().split(/\r?\n/).filter(x=>x.trim());
 if(lines.length<2)return {candles:[],error:'CSV must contain a header and data rows'};
 const headers=lines[0].split(',').map(x=>x.trim().toLowerCase());
 const idx=(names:string[])=>headers.findIndex(x=>names.includes(x));
 const cols=[idx(['time','timestamp','datetime','date']),idx(['open']),idx(['high']),idx(['low']),idx(['close']),idx(['volume'])];
 if(cols.some(i=>i<0))return {candles:[],error:'Required CSV columns: time,open,high,low,close,volume'};
 const candles:Candle[]=[];
 for(let row=1;row<lines.length;row++){
  const fields=lines[row].split(',').map(x=>x.trim());
  if(fields.length!==headers.length)return {candles:[],error:'Malformed CSV row '+(row+1)};
  const [t,o,h,l,c,v]=cols.map(i=>fields[i]);
  if(!t||[o,h,l,c,v].some(x=>x===''))return {candles:[],error:'Missing value at row '+(row+1)};
  candles.push({time:t,open:Number(o),high:Number(h),low:Number(l),close:Number(c),volume:Number(v)});
 }
 const error=validateCandles(candles);
 return error?{candles:[],error}:{candles};
}
