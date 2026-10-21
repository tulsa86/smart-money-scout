import type {FundamentalScore} from './fundamentals';
export type ScreenerFilters={minRevenueGrowth:number;minNetMargin:number;minScore:number};
export const defaultScreenerFilters:ScreenerFilters={minRevenueGrowth:10,minNetMargin:15,minScore:60};
export function passesScreener(result:FundamentalScore,filters:ScreenerFilters=defaultScreenerFilters):boolean{
 return result.score!==null&&Number.isFinite(result.score)&&
 result.revenueGrowth!==null&&Number.isFinite(result.revenueGrowth)&&
 result.netMargin!==null&&Number.isFinite(result.netMargin)&&
 result.revenueGrowth*100>=filters.minRevenueGrowth&&
 result.netMargin*100>=filters.minNetMargin&&
 result.score>=filters.minScore;
}
