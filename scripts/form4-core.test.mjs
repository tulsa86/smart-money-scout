import test from 'node:test';
import assert from 'node:assert/strict';
import {extractForm4Purchases} from './form4-core.mjs';
const wrap=(code='P',acquired='A',price='12.50')=>`<ownershipDocument><documentType>4</documentType><issuer><issuerCik>0000320193</issuerCik></issuer><reportingOwner><reportingOwnerId><rptOwnerName>Example Officer</rptOwnerName></reportingOwnerId></reportingOwner><nonDerivativeTable><nonDerivativeTransaction><securityTitle><value>Common Stock</value></securityTitle><transactionDate><value>2026-10-26</value></transactionDate><transactionCoding><transactionCode>${code}</transactionCode></transactionCoding><transactionAmounts><transactionShares><value>100</value></transactionShares><transactionPricePerShare><value>${price}</value></transactionPricePerShare><transactionAcquiredDisposedCode><value>${acquired}</value></transactionAcquiredDisposedCode></transactionAmounts><postTransactionAmounts><sharesOwnedFollowingTransaction><value>1200</value></sharesOwnedFollowingTransaction></postTransactionAmounts></nonDerivativeTransaction></nonDerivativeTable></ownershipDocument>`;
const meta={ticker:'AAPL',cik:'0000320193',accession:'0000000000-26-000001',filingUrl:'https://www.sec.gov/example',filedAt:'2026-10-27'};
test('extracts a verified coded purchase and preserves provenance',()=>{const p=extractForm4Purchases(wrap(),meta);assert.equal(p.length,1);assert.equal(p[0].reportedPurchaseValue,1250);assert.equal(p[0].ownerNames[0],'Example Officer');assert.equal(p[0].transactionCode,'P')});
test('rejects sales, grants, dispositions and missing prices',()=>{for(const xml of [wrap('S'),wrap('A'),wrap('P','D'),wrap('P','A','')])assert.equal(extractForm4Purchases(xml,meta).length,0)});
test('rejects mismatched issuer and invalid document',()=>{assert.throws(()=>extractForm4Purchases(wrap(),{...meta,cik:'0000000001'}),/mismatch/);assert.throws(()=>extractForm4Purchases('<notForm/>',meta),/Invalid ownership/);assert.throws(()=>extractForm4Purchases(wrap().replace('<documentType>4</documentType>','<documentType>5</documentType>'),meta),/Not a Form/)});

test('zero transactions',()=>{assert.equal(extractForm4Purchases(wrap().replace(/<nonDerivativeTransaction>[\s\S]*?<\/nonDerivativeTransaction>/,''),meta).length,0)});
test('zero price and dollar-formatted price are rejected',()=>{for(const price of ['0','$14.50'])assert.equal(extractForm4Purchases(wrap('P','A',price),meta).length,0)});
test('multiple transactions stay separate',()=>{const x=wrap();const t=x.match(/<nonDerivativeTransaction>[\s\S]*?<\/nonDerivativeTransaction>/)[0];assert.equal(extractForm4Purchases(x.replace(t,t+t),meta).length,2)});
test('amendments are not assumed reconciled',()=>{const p=extractForm4Purchases(wrap().replace('<documentType>4</documentType>','<documentType>4/A</documentType>'),meta);assert.equal(p[0].amendmentStatus,'requires_reconciliation')});
test('Table II P is ignored',()=>{const x=wrap().replace('nonDerivativeTable','derivativeTable').replace('nonDerivativeTable','derivativeTable').replaceAll('nonDerivativeTransaction','derivativeTransaction');assert.equal(extractForm4Purchases(x,meta).length,0)});

test('XML parser accepts namespaces and CDATA without changing amounts',()=>{const x=wrap().replace('<ownershipDocument>','<sec:ownershipDocument xmlns:sec="urn:sec">').replace('</ownershipDocument>','</sec:ownershipDocument>').replace('<value>12.50</value>','<value><![CDATA[12.50]]></value>');assert.equal(extractForm4Purchases(x,meta)[0].reportedPurchaseValue,1250)});
test('XML parser rejects malformed closing tags and DTD',()=>{assert.throws(()=>extractForm4Purchases(wrap().replace('</issuer>','</wrong>'),meta),/mismatch/);assert.throws(()=>extractForm4Purchases('<!DOCTYPE ownershipDocument>'+wrap(),meta),/forbidden/)});
test('plan footnote prompts review, never automatically marks a scheduled plan',()=>{const x=wrap().replace('</ownershipDocument>','<footnotes><footnote id="F1">Rule 10b5-1 plan referenced</footnote></footnotes></ownershipDocument>');assert.equal(extractForm4Purchases(x,meta)[0].rule10b5_1,'requires_review')});

test('rejects impossible calendar dates',()=>{assert.equal(extractForm4Purchases(wrap().replace('2026-10-26','2026-02-30'),meta).length,0)});

test('10b5-1 flag within transactionCoding is honored',()=>{const x=wrap().replace('<transactionCode>P</transactionCode>','<transactionCode>P</transactionCode><aff10b5One>1</aff10b5One>');assert.equal(extractForm4Purchases(x,meta)[0].rule10b5_1,'yes')});

test('joint reporting owners are flagged rather than assigned a single buyer',()=>{const x=wrap().replace('</reportingOwner>','</reportingOwner><reportingOwner><reportingOwnerId><rptOwnerName>Second Owner</rptOwnerName></reportingOwnerId></reportingOwner>');const r=extractForm4Purchases(x,meta);assert.equal(r[0].ownerAttribution,'multiple_reporting_owners_requires_review');assert.equal(r[0].ownerNames.length,2)});

test('XML rejects unknown entities instead of silently preserving corrupted values',()=>{assert.throws(()=>extractForm4Purchases(wrap().replace('Common Stock','Common &bogus; Stock'),meta),/entity/)});
test('XML rejects stray text outside ownership document',()=>{assert.throws(()=>extractForm4Purchases('unexpected'+wrap(),meta),/outside ownership/)});

test('XML accepts standard escaped ampersands in reporting owner names',()=>{const x=wrap().replace('Example Officer','Smith &amp; Jones');assert.equal(extractForm4Purchases(x,meta)[0].ownerNames[0],'Smith & Jones')});

test('XML rejects forbidden numeric control characters',()=>{assert.throws(()=>extractForm4Purchases(wrap().replace('Example Officer','Example &#0; Officer'),meta),/Invalid XML character/)});
test('XML accepts numeric newline references',()=>{assert.equal(extractForm4Purchases(wrap().replace('Example Officer','Example&#10;Officer'),meta)[0].ownerNames[0],'Example\nOfficer')});
test('XML rejects malformed double-hyphen comments',()=>{assert.throws(()=>extractForm4Purchases(wrap().replace('<issuer>','<!--bad--comment--><issuer>'),meta),/Malformed XML comment/)});

test('XML rejects CDATA outside the ownership root',()=>{assert.throws(()=>extractForm4Purchases('<![CDATA[unexpected]]>'+wrap(),meta),/CDATA outside/)});
test('XML rejects multiple ownership roots',()=>{assert.throws(()=>extractForm4Purchases(wrap()+wrap(),meta),/Multiple XML roots/)});

test('XML rejects malformed entity references in attributes',()=>{assert.throws(()=>extractForm4Purchases(wrap().replace('<issuer>','<issuer bad="&bogus;">'),meta),/entity/)});

test('XML rejects unquoted attributes',()=>{assert.throws(()=>extractForm4Purchases(wrap().replace('<issuer>','<issuer id=bad>'),meta),/Malformed XML attributes/)});
test('XML rejects unterminated attribute quotes',()=>{assert.throws(()=>extractForm4Purchases(wrap().replace('<issuer>','<issuer id="bad>'),meta),/Malformed XML attributes/)});
test('XML rejects duplicate attribute names',()=>{assert.throws(()=>extractForm4Purchases(wrap().replace('<issuer>','<issuer id="a" id="b">'),meta),/Duplicate XML attribute/)});
test('XML accepts quoted attributes on issuer elements',()=>{assert.equal(extractForm4Purchases(wrap().replace('<issuer>','<issuer id="ok">'),meta).length,1)});

test('XML rejects declarations after ownership root',()=>{assert.throws(()=>extractForm4Purchases(wrap()+'<?xml version="1.0"?>',meta),/Malformed XML declaration/)});
test('XML rejects mismatched qualified namespace closing tags',()=>{const x=wrap().replace('<ownershipDocument>','<a:ownershipDocument>').replace('</ownershipDocument>','</b:ownershipDocument>');assert.throws(()=>extractForm4Purchases(x,meta),/closing tag mismatch/)});

test('XML accepts a literal greater-than character inside quoted attributes',()=>{const x=wrap().replace('<issuer>','<issuer note="a>b">');assert.equal(extractForm4Purchases(x,meta).length,1)});
test('XML rejects an unterminated attribute containing greater-than',()=>{const x=wrap().replace('<issuer>','<issuer note="a>b>');assert.throws(()=>extractForm4Purchases(x,meta),/Malformed XML/)});

test('raw purchases never become investment signals from metadata',()=>{const p=extractForm4Purchases(wrap(),meta)[0];assert.equal(p.isResearchWorthy,false);assert.equal(p.investmentSignal,false);assert.equal(p.researchQuality,'not_assessed');assert.equal(p.publicAvailabilityStatus,'unknown')});

test('XML rejects literal less-than inside quoted attributes',()=>{assert.throws(()=>extractForm4Purchases(wrap().replace('<issuer>','<issuer note="a<b">'),meta),/Malformed XML attributes/)});
test('XML accepts escaped less-than inside quoted attributes',()=>{assert.equal(extractForm4Purchases(wrap().replace('<issuer>','<issuer note="a&lt;b">'),meta).length,1)});
