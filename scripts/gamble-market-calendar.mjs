// Conservative regular-session NYSE calendar. Exclude early closes from this 78-bar MVP.
const day=d=>d.toISOString().slice(0,10),date=(y,m,d)=>new Date(Date.UTC(y,m-1,d)),plus=(d,n)=>new Date(d.getTime()+n*86400000);
const nth=(y,m,w,n)=>{const d=date(y,m,1);return plus(d,(w-d.getUTCDay()+7)%7+7*(n-1))};
const last=(y,m,w)=>{const d=date(y,m+1,0);return plus(d,-(d.getUTCDay()-w+7)%7)};
const observed=d=>plus(d,d.getUTCDay()===6?-1:d.getUTCDay()===0?1:0);
function easter(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k+7)%7,m=Math.floor((a+11*h+22*l)/451),v=h+l-7*m+114;return date(y,Math.floor(v/31),v%31+1)}
function holidays(y){const s=new Set();for(const yy of [y-1,y,y+1]){for(const d of [date(yy,1,1),date(yy,6,19),date(yy,7,4),date(yy,12,25)])s.add(day(observed(d)));for(const d of [nth(yy,1,1,3),nth(yy,2,1,3),plus(easter(yy),-2),last(yy,5,1),nth(yy,9,1,1),nth(yy,11,4,4)])s.add(day(d))}return s}
export function isRegularMarketDay(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))throw Error('Invalid market date');const d=date(...s.split('-').map(Number));if(day(d)!==s)throw Error('Invalid calendar date');if([0,6].includes(d.getUTCDay())||holidays(d.getUTCFullYear()).has(s))return false;const y=d.getUTCFullYear();return ![plus(nth(y,11,4,4),1),date(y,12,24),date(y,7,3)].some(x=>day(x)===s)}
export function priorRegularMarketDay(s){let d=date(...s.split('-').map(Number));for(let i=0;i<14;i++){d=plus(d,-1);if(isRegularMarketDay(day(d)))return day(d)}throw Error('No preceding regular session')}
export function nyToday(d=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}
