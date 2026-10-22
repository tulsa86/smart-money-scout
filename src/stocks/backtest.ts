import {breakoutSignal,validateCandles,type Candle} from './candles';

export type SimTrade={entryTime:string;exitTime:string;entryPrice:number;exitPrice:number;shares:number;netPnl:number;reason:'stop'|'target'|'session-end'|'end-of-data'};
export type BacktestResult={status:'ok'|'invalid';error?:string;startingCash:number;endingCash:number;netReturnPct:number;maxDrawdownPct:number;trades:SimTrade[]};
export type BacktestConfig={startingCash?:number;lookback?:number;volumeMultiple?:number;stopPct?:number;targetPct?:number;feeBps?:number;slippageBps?:number;maxAllocationPct?:number};
const day=(iso:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));
const round=(n:number)=>Math.round(n*1e6)/1e6;
/** Long-only baseline. A signal on a CLOSED candle enters at the NEXT candle open.
 * Exit stop/target checks begin on the entry candle. If both touch, assume STOP first.
 * No leverage, fractional shares, pyramiding, overnight holding or intrabar prediction.
 */
export function backtestBreakout(candles:readonly Candle[],config:BacktestConfig={}):BacktestResult{
 const startingCash=config.startingCash??1000,lookback=config.lookback??20,volumeMultiple=config.volumeMultiple??1.5;
 const stopPct=config.stopPct??0.02,targetPct=config.targetPct??0.04,feeBps=config.feeBps??0,slippageBps=config.slippageBps??5,maxAllocationPct=config.maxAllocationPct??1;
 const invalid=(error:string):BacktestResult=>({status:'invalid',error,startingCash,endingCash:startingCash,netReturnPct:0,maxDrawdownPct:0,trades:[]});
 if(![startingCash,volumeMultiple,stopPct,targetPct,feeBps,slippageBps,maxAllocationPct].every(Number.isFinite)||startingCash<=0||!Number.isInteger(lookback)||lookback<2||volumeMultiple<=0||stopPct<=0||targetPct<=0||feeBps<0||slippageBps<0||slippageBps>=10000||maxAllocationPct<=0||maxAllocationPct>1)return invalid('Invalid backtest configuration');
 if(candles.length<lookback+2)return invalid('Not enough candles for a signal and next-bar execution');
 const error=validateCandles(candles);if(error)return invalid(error);
 let cash=startingCash,peak=startingCash,maxDrawdown=0;
 const trades:SimTrade[]=[];
 let position:null|{shares:number;entryPrice:number;entryTime:string;cost:number;stop:number;target:number}=null;
 let pending=false;
 const slip=slippageBps/10000,fee=feeBps/10000;
 function exit(c:Candle,raw:number,reason:SimTrade['reason']){
  if(!position)return;
  const fill=raw*(1-slip),proceeds=position.shares*fill*(1-fee);
  cash+=proceeds;
  trades.push({entryTime:position.entryTime,exitTime:c.time,entryPrice:round(position.entryPrice),exitPrice:round(fill),shares:position.shares,netPnl:round(proceeds-position.cost),reason});
  position=null;
 }
 for(let i=lookback;i<candles.length;i++){
  const c=candles[i],previous=candles[i-1];
  if(position&&day(c.time)!==day(previous.time))exit(previous,previous.close,'session-end');
  if(pending){
   pending=false;
   if(!position&&day(c.time)===day(previous.time)){
    const fill=c.open*(1+slip),unitCost=fill*(1+fee);
    const shares=Math.floor(Math.min(cash*maxAllocationPct,cash)/unitCost);
    if(shares>0){const cost=shares*unitCost;cash-=cost;position={shares,entryPrice:fill,entryTime:c.time,cost,stop:fill*(1-stopPct),target:fill*(1+targetPct)};}
   }
  }
  if(position){
   // A gap through the stop fills at the worse opening price, not the stop price.
   if(c.open<=position.stop)exit(c,c.open,'stop');
   else if(c.low<=position.stop)exit(c,position.stop,'stop');
   else if(c.open>=position.target)exit(c,c.open,'target');
   else if(c.high>=position.target)exit(c,position.target,'target');
   else if(i===candles.length-1||day(c.time)!==day(candles[i+1].time))exit(c,c.close,i===candles.length-1?'end-of-data':'session-end');
  }
  const marked=cash+(position?position.shares*c.close*(1-slip)*(1-fee):0);
  peak=Math.max(peak,marked);
  maxDrawdown=Math.max(maxDrawdown,(peak-marked)/peak);
  // Signals cannot execute until the following candle; no signal on the final candle.
  if(!position&&!pending&&i<candles.length-1&&day(c.time)===day(candles[i+1].time)){
   const signal=breakoutSignal(candles.slice(i-lookback,i+1),lookback,volumeMultiple);
   pending=signal.action==='buy';
  }
 }
 return {status:'ok',startingCash,endingCash:round(cash),netReturnPct:round((cash/startingCash-1)*100),maxDrawdownPct:round(maxDrawdown*100),trades};
}
