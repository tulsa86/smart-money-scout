// Fail-closed metadata checks before SEC Form 4 candidates enter any research feed.
// This is not a live SEC fetcher and does not independently verify source claims.
const accession=/^\d{10}-\d{2}-\d{6}$/;
const cikNumber=v=>typeof v==='string'&&/^\d{1,10}$/.test(v)?String(BigInt(v)):null;
const validTime=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v));
export function validateSecFilingSource({cik,accession:acc,filingUrl,filedAt}={}){
 const id=cikNumber(cik);
 if(!id||!accession.test(acc??''))return {ok:false,reason:'invalid_identity'};
 let url;
 try{url=new URL(filingUrl)}catch{return {ok:false,reason:'invalid_url'}}
 if(url.protocol!=='https:'||url.hostname!=='www.sec.gov'||url.username||url.password||url.port)return {ok:false,reason:'untrusted_source'};
 const prefix='/Archives/edgar/data/'+id+'/'+acc.replaceAll('-')+'/';
 if(!url.pathname.startsWith(prefix)||url.pathname===prefix)return {ok:false,reason:'source_identity_mismatch'};
 if(url.search||url.hash)return {ok:false,reason:'unexpected_url_components'};
 if(!validTime(filedAt))return {ok:false,reason:'missing_public_timestamp'};
 return {ok:true,normalizedCik:id,accession:acc,filingUrl:url.href,filedAt};
}
export function gateForm4Candidates(candidates,source){
 if(!Array.isArray(candidates))throw Error('Expected candidates array');
 const validated=validateSecFilingSource(source);
 if(!validated.ok)return {eligible:[],quarantined:candidates.map(candidate=>({candidate,reason:validated.reason})),sourceStatus:validated.reason};
 const eligible=[],quarantined=[];
 for(const candidate of candidates){
  const matching=candidate&&cikNumber(String(candidate.cik??''))===validated.normalizedCik&&candidate.accession===validated.accession&&candidate.filingUrl===validated.filingUrl&&candidate.filedAt===validated.filedAt;
  const reason=!matching?'metadata_mismatch':candidate.formType==='4/A'||candidate.amendmentStatus!=='original'?'amendment_requires_reconciliation':candidate.ownerAttribution!=='single_reporting_owner'?'owner_requires_review':candidate.rule10b5_1==='yes'||candidate.rule10b5_1==='requires_review'?'plan_requires_review':candidate.classification!=='reported_purchase_candidate'?'invalid_classification':null;
  if(reason)quarantined.push({candidate,reason});else eligible.push({...candidate,sourceStatus:'metadata_validated_not_independently_verified',researchStatus:'reported_activity_only'});
 }
 return {eligible,quarantined,sourceStatus:'metadata_validated_not_independently_verified'};
}
