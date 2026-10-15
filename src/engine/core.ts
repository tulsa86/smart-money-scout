export type Config = {feeBps:number; slippageBps:number};
export type Position = {id:string; symbol:string; quantity:number; cost:number; entryTrigger:number; entryFill:number; entryFee:number; openedAt:string; entryReason:string; stop:number; take:number};
export type Trade = Position & {exitTrigger:number; exitFill:number; exitFee:number; closedAt:string; exitReason:string; pnl:number};
export type State = {version:1;cash:number;positions:Position[];trades:Trade[];config:Config;tick:number;history:{time:string;value:number}[];logs:{time:string;message:string;error:boolean}[];sequence:number};
export const initial = (now=new Date().toISOString()):State => ({version:1,cash:100,positions:[],trades:[],config:{feeBps:25,slippageBps:50},tick:0,history:[{time:now,value:100}],logs:[{time:now,message:'Sandbox initialized · $100.00 virtual cash',error:false}],sequence:0});
export const validConfig=(c:Config)=> Number.isFinite(c.feeBps)&&Number.isFinite(c.slippageBps)&&c.feeBps>=0&&c.feeBps<=500&&c.slippageBps>=0&&c.slippageBps<=1000;
export function dailyPnl(s:State,now:string){return s.trades.filter(t=>t.closedAt.slice(0,10)===now.slice(0,10)).reduce((a,t)=>a+t.pnl,0)}
export const log=(s:State,message:string,now:string,error=false):State=>({...s,logs:[{time:now,message,error},...s.logs].slice(0,200)});
export function enter(s:State,symbol:string,trigger:number,budget:number,now:string,reason='Manual entry from mock scanner'):State {
 if(!validConfig(s.config)||!Number.isFinite(trigger)||trigger<=0||!Number.isFinite(budget)||budget<=0||budget>10)throw Error('Position must be greater than $0 and at most $10, with a valid price.');
 if(s.positions.length>=3)throw Error('Maximum of 3 simultaneous positions reached.');
 if(s.positions.some(p=>p.symbol===symbol))throw Error('A position in this token is already open.');
 if(dailyPnl(s,now)<=-5)throw Error('Daily realized loss limit reached. New entries disabled until the next UTC day.');
 if(budget>s.cash)throw Error('Insufficient virtual cash.');
 const fill=trigger*(1+s.config.slippageBps/10000),notional=budget/(1+s.config.feeBps/10000),fee=budget-notional;
 const p:Position={id:String(s.sequence+1),symbol,quantity:notional/fill,cost:budget,entryTrigger:trigger,entryFill:fill,entryFee:fee,openedAt:now,entryReason:reason,stop:fill*.9,take:fill*1.2};
 return log({...s,cash:Math.max(0,s.cash-budget),positions:[...s.positions,p],sequence:s.sequence+1},`Opened ${symbol} · $${budget.toFixed(2)} including fee`,now);
}
export function close(s:State,id:string,trigger:number,now:string,reason='Manual exit'):State {
 const p=s.positions.find(p=>p.id===id);if(!p||!Number.isFinite(trigger)||trigger<=0||!validConfig(s.config))throw Error('Invalid exit.');
 const fill=trigger*(1-s.config.slippageBps/10000),gross=p.quantity*fill,fee=gross*s.config.feeBps/10000;
 const trade:Trade={...p,exitTrigger:trigger,exitFill:fill,exitFee:fee,closedAt:now,exitReason:reason,pnl:gross-fee-p.cost};
 return log({...s,cash:s.cash+gross-fee,positions:s.positions.filter(x=>x.id!==id),trades:[trade,...s.trades]},`Closed ${p.symbol} · ${reason} · ${trade.pnl.toFixed(2)} USD`,now);
}
export const equity=(s:State,prices:Record<string,number>)=>s.cash+s.positions.reduce((a,p)=>a+p.quantity*(prices[p.symbol]??p.entryFill),0);
export function mark(s:State,prices:Record<string,number>,now:string):State{
 let next=s;for(const p of s.positions){const price=prices[p.symbol];if(price<=p.stop)next=close(next,p.id,price,now,'Stop loss');else if(price>=p.take)next=close(next,p.id,price,now,'Take profit');}
 return {...next,history:[...next.history,{time:now,value:equity(next,prices)}]};
}
