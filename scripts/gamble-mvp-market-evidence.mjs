// Pure adapter from completed Alpaca IEX 5-minute bars to MVP ledger evidence.
// Fetching and persistence are deliberately separate. Never submits orders.
const nyDay=x=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(x));
const nyClock=x=>new Intl.DateTimeFormat('en-GB',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(x));
export function completedMvpEvidence({symbol,targetSession,bars,availableAt,expectedBars=78,expectedClose='15:55'}){
 if(!/^[A-Z]{1,5}$/.test(symbol)||!/^\d{4}-\d{2}-\d{2}$/.test(targetSession)||!Array.isArray(bars)||!Number.isInteger(expectedBars)||expectedBars<2||!Number.isFinite(Date.parse(availableAt)))throw Error('Invalid market evidence request');
 if(bars.length!==expectedBars)throw Error('Incomplete session bars');
 const sorted=[...bars].sort((a,b)=>Date.parse(a.t)-Date.parse(b.t));
 if(new Set(sorted.map(b=>b.t)).size!==expectedBars)throw Error('Duplicate market bar');
 for(const b of sorted){
  if(!b||!Number.isFinite(Date.parse(b.t))||nyDay(b.t)!==targetSession||!Number.isFinite(b.o)||!Number.isFinite(b.c)||b.o<=0||b.c<=0||Date.parse(b.t)>Date.parse(availableAt))throw Error('Invalid or future market bar');
 }
 if(nyClock(sorted[0].t)!=='09:30'||nyClock(sorted.at(-1).t)!==expectedClose)throw Error('Missing opening or closing bar');
 for(let i=1;i<sorted.length;i++)if(Date.parse(sorted[i].t)-Date.parse(sorted[i-1].t)!==300000)throw Error('Missing interval in market bars');
 if(Date.parse(availableAt)<Date.parse(sorted.at(-1).t)+300000)throw Error('Final bar not yet complete');
 return {symbol,targetSession,openObservedAt:sorted[0].t,closeObservedAt:sorted.at(-1).t,availableAt,open:sorted[0].o,close:sorted.at(-1).c};
}
