import test from 'node:test';
import assert from 'node:assert/strict';
import {indexRecentOwnershipFilings} from './sec-ownership-index.mjs';
const sample={cik:320193,filings:{recent:{accessionNumber:['0000320193-26-000101','0000320193-26-000102','0000320193-26-000103'],form:['10-K','4','4/A'],filingDate:['2026-10-01','2026-10-02','2026-10-03'],primaryDocument:['annual.htm','xslF345X05/ownership.xml','primary_doc.html']}}};
test('indexes only Form 4 and amendments with source provenance',()=>{const s=structuredClone(sample);s.filings.recent.primaryDocument[1]='ownership.xml';const r=indexRecentOwnershipFilings(s);assert.equal(r.length,2);assert.equal(r[0].xmlStatus,'not_fetched');assert.equal(r[1].formType,'4/A');assert.match(r[0].filingIndexUrl,/000032019326000102/);assert.match(r[1].primaryDocumentUrl,/primary_doc.html$/)});
test('rejects mismatched column lengths',()=>{const s=structuredClone(sample);s.filings.recent.form.pop();assert.throws(()=>indexRecentOwnershipFilings(s),/column mismatch/)});
test('rejects unsafe path and does not construct a URL',()=>{assert.throws(()=>indexRecentOwnershipFilings(sample),/Malformed ownership/)});
test('limit applies to ownership filings, not all submissions',()=>{const s=structuredClone(sample);s.filings.recent.primaryDocument[1]='ownership.xml';assert.equal(indexRecentOwnershipFilings(s,{limit:1}).length,1)});
