import test from 'node:test';
import assert from 'node:assert/strict';
import {assessForm4Research} from './form4-research-assessment.mjs';
const candidate={classification:'reported_purchase_candidate',formType:'4',amendmentStatus:'original',rule10b5_1:'unknown',ownerAttribution:'single_reporting_owner',publicAvailabilityStatus:'unknown'};
test('raw purchase is never a research lead or investment signal',()=>{
 const result=assessForm4Research(candidate);
 assert.equal(result.isResearchWorthy,false);
 assert.equal(result.investmentSignal,false);
 assert.equal(result.researchQuality,'not_assessed');
 assert.ok(result.researchAssessment.blockers.includes('public_availability_unverified'));
});
test('even hypothetical fully cleared gates cannot bypass unimplemented ranking',()=>{
 const result=assessForm4Research({...candidate,rule10b5_1:'no',publicAvailabilityStatus:'verified_public_dissemination',publicAvailableAt:'2026-10-27T21:00:00Z'},{amendmentReconciled:true,discoveryComplete:true,publicAvailabilityVerified:true,independentEvidenceVerified:true});
 assert.equal(result.researchAssessment.blockers.length,0);
 assert.equal(result.isResearchWorthy,false);
 assert.equal(result.investmentSignal,false);
 assert.equal(result.researchAssessment.rankingImplemented,false);
});
test('amendments and multi-owner filings remain blocked',()=>{
 const result=assessForm4Research({...candidate,formType:'4/A',amendmentStatus:'requires_reconciliation',ownerAttribution:'multiple_reporting_owners_requires_review'});
 assert.ok(result.researchAssessment.blockers.includes('amendment_lineage_not_cleared'));
 assert.ok(result.researchAssessment.blockers.includes('owner_attribution_uncertain'));
});
test('rejects unrelated records',()=>assert.throws(()=>assessForm4Research({classification:'other'}),/Expected Form 4/));
