import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulatedLedger,simulateNextSessionEntry} from './stock-simulated-execution.mjs';
import {parseSimulatedLedger,serializeSimulatedLedger,newSimulatedLedgerFile} from './stock-ledger-persistence.mjs';
const decision={kind:'PROSPECTIVE_STOCK_DECISION',status:'DECISION_ONLY_NO_FILL',action:'BUY',symbol:'SOFI',shares:12,allocationLimitCents:20000,decisionAt:'2026-10-28T23:07:01.403Z'};
const bar={symbol:'SOFI',observedAt:'2026-10-29T04:00:00Z',availableAt:'2026-10-29T20:45:00Z',open:16.50};
test('persisted ledger survives JSON round trip and preserves cash and position',()=>{
 const ledger=simulateNextSessionEntry(parseSimulatedLedger(newSimulatedLedgerFile()),decision,bar);
 const loaded=parseSimulatedLedger(serializeSimulatedLedger(ledger));
 assert.equal(loaded.cashCents,80188);
 assert.equal(loaded.positions.SOFI.shares,12);
 assert.equal(loaded.fills.length,1);
 assert.throws(()=>simulateNextSessionEntry(loaded,decision,bar),/already processed/);
});
test('rejects tampered cash, position, and fill accounting',()=>{
 const x=simulateNextSessionEntry(createSimulatedLedger(),decision,bar);
 assert.throws(()=>parseSimulatedLedger(JSON.stringify({...x,cashCents:99999})),/mismatch/);
 assert.throws(()=>parseSimulatedLedger(JSON.stringify({...x,positions:{}})),/mismatch/);
 assert.throws(()=>parseSimulatedLedger(JSON.stringify({...x,fills:[{...x.fills[0],costCents:1}]})),/Invalid simulated fill/);
});

test('duplicate fill and conflicting outcome records fail ledger reconciliation',()=>{
 const ledger=JSON.parse(newSimulatedLedgerFile());
 ledger.processedDecisions=['2026-11-02T20:00:00Z'];
 ledger.fills=[{kind:'SIMULATED_ENTRY',simulationOnly:true,symbol:'SOFI',shares:1,priceCents:500,costCents:500,decisionAt:ledger.processedDecisions[0]}];
 ledger.positions={SOFI:{shares:1,costBasisCents:500}};
 ledger.cashCents=99500;
 const duplicated={...ledger,fills:[...ledger.fills,...ledger.fills],positions:{SOFI:{shares:2,costBasisCents:1000}},cashCents:99000};
 assert.throws(()=>parseSimulatedLedger(JSON.stringify(duplicated)),/Duplicate fill/);
 const digest='a'.repeat(64);
 const contradicted={...ledger,executionOutcomes:[{journalDigest:digest,decisionAt:ledger.processedDecisions[0],status:'REJECTED_INSUFFICIENT_CASH_AFTER_SLIPPAGE'}]};
 assert.throws(()=>parseSimulatedLedger(JSON.stringify(contradicted)),/Rejected decision has fill/);
});
