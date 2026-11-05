// Allow a decision on the target date only before the 09:30 New York market open.
export const isBeforeTargetOpen=(timestamp,targetSession)=>{
 const d=new Date(timestamp);
 if(!Number.isFinite(d.getTime()))return false;
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
 const time=new Intl.DateTimeFormat('en-GB',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(d);
 return date<targetSession||(date===targetSession&&time<'09:30');
};
