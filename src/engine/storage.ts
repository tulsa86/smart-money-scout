import {initial,validConfig,type State} from './core.ts';
export const KEY='smart-money-scout.v1';
export interface StorageLike {getItem(key:string):string|null;setItem(key:string,value:string):void}
export function save(storage:StorageLike,state:State){storage.setItem(KEY,JSON.stringify(state))}
const finite=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x);
const date=(x:unknown)=>typeof x==='string'&&Number.isFinite(Date.parse(x));
function position(p:Record<string,unknown>){return typeof p.id==='string'&&typeof p.symbol==='string'&&typeof p.entryReason==='string'&&date(p.openedAt)&&['quantity','cost','entryTrigger','entryFill','stop','take'].every(k=>finite(p[k])&&p[k]>0)&&finite(p.entryFee)&&p.entryFee>=0}
export function load(storage:StorageLike):State {
 const raw=storage.getItem(KEY);if(!raw)return initial();const s=JSON.parse(raw) as State;
 if(!s||s.version!==1||!finite(s.cash)||s.cash<0||!s.config||!validConfig(s.config)||!Array.isArray(s.positions)||s.positions.length>3||!s.positions.every(p=>p&&position(p as unknown as Record<string,unknown>))||!Array.isArray(s.trades)||!s.trades.every(t=>t&&position(t as unknown as Record<string,unknown>)&&finite(t.pnl)&&finite(t.exitTrigger)&&t.exitTrigger>0&&finite(t.exitFill)&&t.exitFill>0&&finite(t.exitFee)&&t.exitFee>=0&&date(t.closedAt)&&typeof t.exitReason==='string')||!Array.isArray(s.history)||!s.history.length||!s.history.every(h=>h&&date(h.time)&&finite(h.value)&&h.value>=0)||!Array.isArray(s.logs)||!s.logs.every(l=>l&&date(l.time)&&typeof l.message==='string'&&typeof l.error==='boolean')||!Number.isInteger(s.tick)||s.tick<0||!Number.isInteger(s.sequence)||s.sequence<0)throw Error('Saved state is invalid. Reset the sandbox to recover.');
 return s;
}
