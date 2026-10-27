// Conservative research assessment. No candidate is an investment recommendation.
// This layer deliberately refuses promotion without independent evidence and verified timing.
export function assessForm4Research(candidate,{amendmentReconciled=false,discoveryComplete=false,publicAvailabilityVerified=false,independentEvidenceVerified=false}={}){
 if(!candidate||candidate.classification!=='reported_purchase_candidate')throw Error('Expected Form 4 purchase candidate');
 const blockers=[];
 if(candidate.formType==='4/A'||candidate.amendmentStatus==='requires_reconciliation'||!amendmentReconciled)blockers.push('amendment_lineage_not_cleared');
 if(!discoveryComplete)blockers.push('filing_discovery_incomplete');
 if(!publicAvailabilityVerified||candidate.publicAvailabilityStatus!=='verified_public_dissemination'||!candidate.publicAvailableAt)blockers.push('public_availability_unverified');
 if(candidate.rule10b5_1!=='no')blockers.push('trading_plan_uncertain');
 if(candidate.ownerAttribution!=='single_reporting_owner')blockers.push('owner_attribution_uncertain');
 if(!independentEvidenceVerified)blockers.push('independent_evidence_missing');
 // Even when gates are cleared, ranking is not implemented. Never claim a signal.
 return {...candidate,researchQuality:'not_assessed',isResearchWorthy:false,investmentSignal:false,researchAssessment:{status:'not_qualified',blockers,rankingImplemented:false}};
}
