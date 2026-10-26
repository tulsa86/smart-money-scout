import test from 'node:test';
import assert from 'node:assert/strict';
import {appendSession,validateLedger,INITIAL_CASH_CENTS} from './ledger-core.mjs';
const row=(day,start=INITIAL_CASH_CENTS,pnl=0,status='QUALIFIED_NO_TRADE',trades=[])=>({day,status,startingCashCents:start,pnlCents:pnl,endingCashCents:start+pnl,trades});
test('empty ledger begins with exactly $1000',()=>assert.equal(validateLedger([]),100000));
test('cash continuity carries profit and loss in whole cents',()=>{
 const rows=appendSession([],row('2026-10-26',100000,125,'TRADE_EXECUTED',[{netPnl:1.25}]));
 const next=appendSession(rows,row('2026-10-27',100125,-75,'TRADE_EXECUTED',[{netPnl:-0.75}]));
 assert.equal(validateLedger(next),100050);
});
test('duplicate sessions and retrospective backfills are rejected',()=>{
 const rows=[row('2026-10-27')];
 assert.throws(()=>appendSession(rows,row('2026-10-27')),/already recorded/);
 assert.throws(()=>appendSession(rows,row('2026-10-26')),/backfill/);
});
test('corrupt balances, decimals, and unsorted dates fail closed',()=>{
 assert.throws(()=>validateLedger([row('2026-10-26',99999)]),/continuity/);
 assert.throws(()=>validateLedger([row('2026-10-26',100000,0.5)]),/integer cents/);
 assert.throws(()=>validateLedger([row('2026-10-27'),row('2026-10-26')]),/duplicate session/);
});
test('outage sessions preserve cash and cannot masquerade as trades',()=>{
 const rows=appendSession([],row('2026-10-26'));
 const outage=appendSession(rows,row('2026-10-27',100000,0,'PIPELINE_OUTAGE'));
 assert.equal(validateLedger(outage),100000);
 assert.throws(()=>validateLedger([row('2026-10-26',100000,1,'PIPELINE_OUTAGE')]),/Nontrade/);
});
