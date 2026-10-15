export type MarketToken={symbol:string;name:string;price:number;change:number;liquidity:number;volume:number;age:number;buys:number;color:string};
export interface MarketDataProvider {readonly mode:'mock'|'external';getMarkets(tick:number):MarketToken[]|Promise<MarketToken[]>}
export interface DexScreenerProvider extends MarketDataProvider {readonly chain:'solana'}
export interface HeliusWalletProvider {getWalletActivity(address:string):Promise<{signature:string;timestamp:string;description:string}[]>}
const tokens:MarketToken[]=[
 {symbol:'SOL',name:'Solana',price:147.82,change:3.42,liquidity:42800000,volume:18200000,age:1800,buys:64,color:'#a996ff'},
 {symbol:'JUP',name:'Jupiter',price:.8426,change:8.76,liquidity:6200000,volume:3400000,age:380,buys:72,color:'#b9ef94'},
 {symbol:'BONK',name:'Bonk',price:.00002341,change:12.34,liquidity:4100000,volume:7800000,age:700,buys:68,color:'#f3ad63'},
 {symbol:'WIF',name:'dogwifhat',price:2.184,change:-2.16,liquidity:2800000,volume:5100000,age:280,buys:43,color:'#d6bb96'},
 {symbol:'RAY',name:'Raydium',price:1.752,change:5.91,liquidity:8400000,volume:2100000,age:1100,buys:61,color:'#82b6fa'},
 {symbol:'POPCAT',name:'Popcat',price:.4612,change:18.52,liquidity:420000,volume:1600000,age:18,buys:79,color:'#e5a8ae'}];
export const mockProvider:MarketDataProvider={mode:'mock',getMarkets:(tick)=>tokens.map((t,i)=>({...t,price:t.price*(1+Math.sin(tick*.75+i)*Math.min(tick,1)*.16+tick*.006),change:t.change+tick*.17}))};
export const markets=(tick:number)=>mockProvider.getMarkets(tick) as MarketToken[];
export const prices=(tick:number)=>Object.fromEntries(markets(tick).map(t=>[t.symbol,t.price]));
