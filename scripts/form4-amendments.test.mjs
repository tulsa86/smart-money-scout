import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileForm4Filings} from './form4-amendments.mjs';
const original={accession:'0000000001-26-000001',formType:'4',issuerCik:'1089872',transactions:[{shares:100},{shares:200}]};
const amendment={accession:'0000000001-26-000002',formType:'4/A',issuerCik:'1089872',transactions:[{shares:150}]};
test('unlinked amendments require review and never double-count',()=>{
 const result=reconcileForm4Filings([original,amendment]);
 assert.deepEqual(result.records.map(x=>x.status),['ACTIVE','REQUIRES_REVIEW']);
 assert.equal(result.countableTransactions.reduce((n,t)=>n+t.shares,0),300);
 assert.equal(result.review[0].reason,'amendment_link_unverified');
});
test('verified accession link supersedes original as a filing unit',()=>{
 const result=reconcileForm4Filings([original,amendment],{verifiedLinks:{[amendment.accession]:original.accession}});
 assert.deepEqual(result.records.map(x=>x.status),['SUPERSEDED_BY_AMENDMENT','ACTIVE_AMENDED']);
 assert.equal(result.countableTransactions.reduce((n,t)=>n+t.shares,0),150);
 assert.equal(result.records[0].supersededBy,amendment.accession);
});
test('a wrong issuer or missing original fails closed',()=>{
 const link={verifiedLinks:{[amendment.accession]:original.accession}};
 const mismatch=reconcileForm4Filings([original,{...amendment,issuerCik:'123'}],link);
 assert.deepEqual(mismatch.records.map(x=>x.status),['ACTIVE','REQUIRES_REVIEW']);
 const missing=reconcileForm4Filings([amendment],link);
 assert.equal(missing.countableTransactions.length,0);
});
test('same-day similar transactions are not deduplicated by fuzzy fingerprint',()=>{
 const result=reconcileForm4Filings([original]);
 assert.equal(result.countableTransactions.length,2);
});
test('duplicate accessions are rejected',()=>{
 assert.throws(()=>reconcileForm4Filings([original,original]),/Duplicate SEC accession/);
});
test('competing amendments cannot both replace the same original',()=>{
 const second={...amendment,accession:'0000000001-26-000003'};
 const result=reconcileForm4Filings([original,amendment,second],{verifiedLinks:{[amendment.accession]:original.accession,[second.accession]:original.accession}});
 assert.deepEqual(result.records.map(x=>x.status),['SUPERSEDED_BY_AMENDMENT','ACTIVE_AMENDED','REQUIRES_REVIEW']);
 assert.equal(result.review[0].reason,'conflicting_amendment_links');
});
