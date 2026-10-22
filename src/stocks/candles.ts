/** Pure candle analysis. Only CLOSED candles may be passed to these functions. */
export type Candle = {time:string;open:number;high:number;low:number;close:number;volume:number};
export type CandleSignal = {action:'buy'|'wait';reason:string;breakoutLevel:number|null;relativeVolume:number|null};
export function validateCandles(candles:readonly Candle[]):string|null {
 let previous=-Infinity;
 for(const c of candles){
  const time=Date.parse(c.time);
  if(!Number.isFinite(time)||time<=previous)return 'Candles must have unique, increasing timestamps';
  previous=time;
  if(![c.open,c.high,c.low,c.close,c.volume].every(Number.isFinite)||c.low<=0||c.volume<0||c.high<Math.max(c.open,c.close,c.low)||c.low>Math.min(c.open,c.close)||c.open<=0||c.close<=0)return 'Invalid OHLCV candle';
 }
 return null;
}
/** A deliberately simple baseline: breakout above 20 prior highs, volume >1.5x prior average.
 * Returns WAIT for missing or invalid data, never a guessed BUY.
 */
export function breakoutSignal(closedCandles:readonly Candle[],lookback=20,volumeMultiple=1.5):CandleSignal {
 const wait=(reason:string):CandleSignal=>({action:'wait',reason,breakoutLevel:null,relativeVolume:null});
 if(!Number.isInteger(lookback)||lookback<2||!Number.isFinite(volumeMultiple)||volumeMultiple<=0)return wait('Invalid strategy parameters');
 if(closedCandles.length<lookback+1)return wait('Not enough completed candles');
 const relevant=closedCandles.slice(-(lookback+1));
 const error=validateCandles(relevant);
 if(error)return wait(error);
 const history=relevant.slice(0,-1),current=relevant[relevant.length-1];
 const breakoutLevel=Math.max(...history.map(c=>c.high));
 const avgVolume=history.reduce((sum,c)=>sum+c.volume,0)/lookback;
 if(avgVolume<=0)return wait('No usable historical volume');
 const relativeVolume=current.volume/avgVolume;
 if(current.close>breakoutLevel&&relativeVolume>=volumeMultiple){
  return {action:'buy',reason:'Closed above prior range on elevated volume',breakoutLevel,relativeVolume};
 }
 return {action:'wait',reason:current.close<=breakoutLevel?'No confirmed breakout':'Volume below threshold',breakoutLevel,relativeVolume};
}
