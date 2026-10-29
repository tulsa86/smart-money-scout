import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {newSimulatedLedgerFile} from './stock-ledger-persistence.mjs';
import {applyJournalEvidence} from './stock-journal-ledger-bridge.mjs';
const decision={kind:'PROSPECTIVE_STOCK_DECISION',status:'DECISION_ONLY_NO_FILL',action:'BUY',symbol:'SOFI',shares:12,allocationLimitCents:20000,decisionAt:'2026-10-28T23:07:01.403Z'};
const payload={schemaVersion:2,previousDigest:null,decisionAt:decision.decisionAt,decision,executionStatus:'NOT_EXECUTED'};
const digest=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
const journal=JSON.stringify([{...payload,digest}]);
test('original prospective decision remains pending without future market evidence',()=>{
 const r=applyJournalEvidence(newSimulatedLedgerFile(),journal);
 assert.equal(r.outcomes[0].status,'AWAITING_VERIFIED_MARKET_EVIDENCE');
 assert.equal(JSON.parse(r.ledgerJson).fills.length,0);
 assert.equal(JSON.parse(r.ledgerJson).cashCents,100000);
});
test('explicit future evidence produces a simulated entry exactly once',()=>{
 const evidence={[digest]:{journalDigest:digest,source:'ALPACA_1DAY_IEX',symbol:'SOFI',observedAt:'2026-10-29T04:00:00Z',availableAt:'2026-10-29T20:45:00Z',open:16.5}};
 const first=applyJournalEvidence(newSimulatedLedgerFile(),journal,evidence);
 assert.equal(JSON.parse(first.ledgerJson).cashCents,80188);
 const again=applyJournalEvidence(first.ledgerJson,journal,evidence);
 assert.equal(again.outcomes[0].status,'ALREADY_PROCESSED');
 assert.equal(JSON.parse(again.ledgerJson).fills.length,1);
});
test('tampered journal and same-day market evidence fail closed',()=>{
 assert.throws(()=>applyJournalEvidence(newSimulatedLedgerFile(),journal.replace('SOFI','FAKE')),/digest mismatch/);
 const evidence={[digest]:{journalDigest:digest,source:'ALPACA_1DAY_IEX',symbol:'SOFI',observedAt:'2026-10-28T04:00:00Z',availableAt:'2026-10-28T20:45:00Z',open:16.5}};
 assert.throws(()=>applyJournalEvidence(newSimulatedLedgerFile(),journal,evidence),/follow decision/);
});
