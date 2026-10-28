// SEC acceptanceDateTime is an Eastern wall-clock timestamp without an offset.
// Reject missing, nonexistent and ambiguous local times rather than guessing.
const validLocal = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value);
const localParts = instant => {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(instant));
 const part=k=>parts.find(p=>p.type===k)?.value;
 return part('year')+'-'+part('month')+'-'+part('day')+'T'+part('hour')+':'+part('minute')+':'+part('second');
};
export function secAvailableAt(acceptanceTime){
 if(!validLocal(acceptanceTime))return null;
 const [base,fraction='']=acceptanceTime.split('.');
 const baseUtc=Date.parse(base+'Z');
 if(!Number.isFinite(baseUtc))return null;
 const matches=[4,5].map(hours=>baseUtc+hours*3600000).filter(ms=>localParts(ms)===base);
 if(matches.length!==1)return null;
 const milliseconds=Number((fraction+'000').slice(0,3));
 return new Date(matches[0]+milliseconds).toISOString();
}
export function canUseSecFilingAt(acceptanceTime,decisionAt){
 const availableAt=secAvailableAt(acceptanceTime);
 if(!availableAt||typeof decisionAt!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(decisionAt)||!/(Z|[+-]\d{2}:\d{2})$/.test(decisionAt))return false;
 const decisionMs=Date.parse(decisionAt);
 return Number.isFinite(decisionMs)&&decisionMs>=Date.parse(availableAt);
}
