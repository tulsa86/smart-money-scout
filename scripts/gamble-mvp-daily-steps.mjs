// Keep prospective decision collection independent of previous-session settlement.
export function executeDailyExperiment({pending,decisions,today,run,log=console}){
 let settlementFailure=null,decisionFailure=null;
 if(pending.length===1){
  try{run('scripts/settle-gamble-mvp.mjs',pending[0].targetSession)}
  catch(error){settlementFailure=error;log.error('Prior settlement failed; attempting independent prospective decision:',error.message)}
 }
 if(!decisions.length)log.log('First prospective experiment day; earlier dates will not be backfilled');
 if(!decisions.some(x=>x.targetSession===today)){
  try{run('scripts/record-gamble-presession.mjs',today)}
  catch(error){decisionFailure=error;log.error('Prospective decision failed:',error.message)}
 }else log.log('Already committed today; no duplicate decision');
 return {settlementFailure,decisionFailure};
}
