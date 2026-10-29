import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {newSimulatedLedgerFile} from './stock-ledger-persistence.mjs';
import {applyJournalEvidence} from './stock-journal-ledger-bridge.mjs';
const decision={kind:'PROSPECTIVE_STOCK_DECISION',status:'DECISION_ONLY_NO_FILL',action:'BUY',symbol:'SOFI',shares:12,allocationLimitCents:20000,decisionAt:'2026-10-30T23:07:01.403Z'};
const payload={schemaVersion:2,previousDigest:null,decisionAt:decision.decisionAt,decision,executionStatus:'NOT_EXECUTED'};
const digest=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
const journal=JSON.stringify([{...payload,digest}]);
test('future prospective decision remains pending without future market evidence',()=>{
 const r=applyJournalEvidence(newSimulatedLedgerFile(),journal);
 assert.equal(r.outcomes[0].status,'PENDING_MARKET_EVIDENCE');
 assert.equal(JSON.parse(r.ledgerJson).fills.length,0);
 assert.equal(JSON.parse(r.ledgerJson).cashCents,100000);
});
test('explicit future evidence produces a simulated entry exactly once',()=>{
 const evidence={[digest]:{journalDigest:digest,source:'ALPACA_1DAY_IEX',symbol:'SOFI',observedAt:'2026-11-02T05:00:00Z',availableAt:'2026-11-02T21:45:00Z',open:16.5}};
 const first=applyJournalEvidence(newSimulatedLedgerFile(),journal,evidence,{activationAt:'2026-10-28T22:00:00Z',evaluatedAt:'2026-11-02T22:00:00Z'});
 assert.equal(JSON.parse(first.ledgerJson).cashCents,80188);
 const again=applyJournalEvidence(first.ledgerJson,journal,evidence,{activationAt:'2026-10-28T22:00:00Z',evaluatedAt:'2026-11-02T22:00:00Z'});
 assert.equal(again.outcomes[0].status,'ALREADY_PROCESSED');
 assert.equal(JSON.parse(again.ledgerJson).fills.length,1);
});
test('tampered journal and same-day market evidence fail closed',()=>{
 assert.throws(()=>applyJournalEvidence(newSimulatedLedgerFile(),journal.replace('SOFI','FAKE')),/digest mismatch/);
 const evidence={[digest]:{journalDigest:digest,source:'ALPACA_1DAY_IEX',symbol:'SOFI',observedAt:'2026-10-30T04:00:00Z',availableAt:'2026-10-30T20:45:00Z',open:16.5}};
 assert.throws(()=>applyJournalEvidence(newSimulatedLedgerFile(),journal,evidence,{activationAt:'2026-10-28T22:00:00Z',evaluatedAt:'2026-11-02T22:00:00Z'}),/follow decision/);
});

test('activation boundary permanently excludes historical decisions even with supplied evidence',()=>{
 const evidence={[digest]:{journalDigest:digest,source:'ALPACA_1DAY_IEX',symbol:'SOFI',observedAt:'2026-11-02T05:00:00Z',availableAt:'2026-11-02T21:45:00Z',open:16.5}};
 const r=applyJournalEvidence(newSimulatedLedgerFile(),journal,evidence,{activationAt:'2026-11-03T00:00:00Z',evaluatedAt:'2026-11-02T22:00:00Z'});
 assert.equal(r.outcomes[0].status,'HISTORICAL_DECISION_ONLY');
 assert.equal(JSON.parse(r.ledgerJson).fills.length,0);
});
test('missing evidence creates durable no-fill event without spending cash',()=>{
 const r=applyJournalEvidence(newSimulatedLedgerFile(),journal,{}, {activationAt:'2026-10-28T22:00:00Z'});
 const ledger=JSON.parse(r.ledgerJson);
 assert.equal(r.outcomes[0].status,'PENDING_MARKET_EVIDENCE');
 assert.equal(ledger.executionOutcomes.length,0);
 assert.equal(ledger.cashCents,100000);
});
test('cash rejection persists and prevents duplicate entry',()=>{
 const evidence={[digest]:{journalDigest:digest,source:'ALPACA_1DAY_IEX',symbol:'SOFI',observedAt:'2026-11-02T05:00:00Z',availableAt:'2026-11-02T21:45:00Z',open:100}};
 const r=applyJournalEvidence(newSimulatedLedgerFile(),journal,evidence,{activationAt:'2026-10-28T22:00:00Z',evaluatedAt:'2026-11-02T22:00:00Z'});
 assert.equal(r.outcomes[0].status,'REJECTED_INSUFFICIENT_CASH_AFTER_SLIPPAGE');
 assert.equal(JSON.parse(r.ledgerJson).fills.length,0);
 assert.equal(JSON.parse(r.ledgerJson).processedDecisions.length,1);
});

test('original SOFI decision is permanently historical even with backdated caller activation',()=>{
 const oldDecision={...decision,decisionAt:'2026-10-28T23:07:01.403Z'};
 const oldPayload={...payload,decisionAt:oldDecision.decisionAt,decision:oldDecision};
 const oldDigest=createHash('sha256').update(JSON.stringify(oldPayload)).digest('hex');
 const oldJournal=JSON.stringify([{...oldPayload,digest:oldDigest}]);
 const evidence={[oldDigest]:{journalDigest:oldDigest,source:'ALPACA_1DAY_IEX',symbol:'SOFI',observedAt:'2026-10-29T04:00:00Z',availableAt:'2026-10-29T20:45:00Z',open:16.5}};
 const result=applyJournalEvidence(newSimulatedLedgerFile(),oldJournal,evidence,{activationAt:'2026-10-01T00:00:00Z',evaluatedAt:'2026-11-02T22:00:00Z'});
 assert.equal(result.outcomes[0].status,'HISTORICAL_DECISION_ONLY');
 assert.equal(JSON.parse(result.ledgerJson).fills.length,0);
});

test('verified halt attestation produces terminal no-fill with zero cash movement',()=>{
 const attestation={kind:'VERIFIED_NO_FILL',journalDigest:digest,symbol:'SOFI',source:'MARKET_STATUS_ATTESTATION',reason:'HALT_OR_LULD',sourceRecordId:'exchange-halt-20261102-SOFI',sessionAt:'2026-11-02T14:30:00Z',availableAt:'2026-11-02T14:35:00Z'};
 const first=applyJournalEvidence(newSimulatedLedgerFile(),journal,{[digest]:attestation},{evaluatedAt:'2026-11-02T15:00:00Z'});
 const ledger=JSON.parse(first.ledgerJson);
 assert.equal(first.outcomes[0].status,'NO_FILL_VERIFIED');
 assert.equal(ledger.cashCents,100000);
 assert.equal(ledger.fills.length,0);
 assert.equal(ledger.executionOutcomes[0].detail.sourceRecordId,attestation.sourceRecordId);
 const second=applyJournalEvidence(first.ledgerJson,journal,{[digest]:{journalDigest:digest,source:'ALPACA_1DAY_IEX',symbol:'SOFI',observedAt:'2026-11-02T05:00:00Z',availableAt:'2026-11-02T21:45:00Z',open:16.5}},{evaluatedAt:'2026-11-02T22:00:00Z'});
 assert.equal(second.outcomes[0].status,'ALREADY_PROCESSED');
 assert.equal(JSON.parse(second.ledgerJson).fills.length,0);
});
test('unverified halt, API outage and premature attestation cannot close a decision',()=>{
 const base={kind:'VERIFIED_NO_FILL',journalDigest:digest,symbol:'SOFI',source:'MARKET_STATUS_ATTESTATION',reason:'HALT_OR_LULD',sourceRecordId:'exchange-halt-20261102-SOFI',sessionAt:'2026-11-02T14:30:00Z',availableAt:'2026-11-02T14:35:00Z'};
 for(const evidence of [{...base,source:'ALPACA_1DAY_IEX'},{...base,sourceRecordId:''},{...base,reason:'API_TIMEOUT'}]){
  assert.throws(()=>applyJournalEvidence(newSimulatedLedgerFile(),journal,{[digest]:evidence},{evaluatedAt:'2026-11-02T15:00:00Z'}),/Invalid verified no-fill attestation/);
 }
 assert.throws(()=>applyJournalEvidence(newSimulatedLedgerFile(),journal,{[digest]:base},{evaluatedAt:'2026-11-02T14:34:00Z'}),/Evidence not available/);
 const pending=applyJournalEvidence(newSimulatedLedgerFile(),journal);
 assert.equal(pending.outcomes[0].status,'PENDING_MARKET_EVIDENCE');
});
