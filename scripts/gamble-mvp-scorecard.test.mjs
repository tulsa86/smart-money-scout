import test from 'node:test';
import assert from 'node:assert/strict';
import {newMvpLedger} from './gamble-mvp-ledger.mjs';
import {summarizeGambleMvp} from './gamble-mvp-scorecard.mjs';
test('missing decisions count against the fixed 30-session denominator',()=>{
 const days=Array.from({length:30},(_,i)=>'2026-11-'+String(i+1).padStart(2,'0'));
 const ledger=newMvpLedger();
 ledger.sessions=days.slice(0,29).map(targetSession=>({targetSession,status:'SKIP',pnlCents:0}));
 const result=summarizeGambleMvp({ledger,eligibleSessions:days});
 assert.equal(result.operationalGate,'PASS');
 assert.equal(result.validSessions,29);
 assert.equal(result.rows.at(-1).status,'MISSING_DECISION');
 ledger.sessions.pop();
 assert.equal(summarizeGambleMvp({ledger,eligibleSessions:days}).operationalGate,'FAIL');
});
test('coverage gate stays pending until all 30 slots are defined',()=>{
 const result=summarizeGambleMvp({ledger:newMvpLedger(),eligibleSessions:['2026-11-05']});
 assert.equal(result.operationalGate,'PENDING');
 assert.equal(result.coverage,0);
});
