import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {parseOwnershipXml,val} from './form4-xml.mjs';
import {extractForm4Purchases} from './form4-core.mjs';

const directory=resolve('tests/fixtures/sec');
const manifest=JSON.parse(readFileSync(join(directory,'manifest.json'),'utf8'));
const trustedFixtureHashes=Object.freeze({
 '0000080424-26-000218':'055cf9077856c2d0468bd967da2920b269b051199d4d674d0fe80abde7a408ab',
 '0001140361-26-036978':'afb6af1c277fd5d4747c3427116113f2ec7df120ebcec4e171efb4f2fb798321',
 '0001193125-26-354277':'a303bed5bb0290eb36ace2c6a6e659ee34c12baf89dbcee1a616360d8d4ebb5a'
});
test('SEC fixture manifest schema and genuine-source provenance',()=>{
 assert.equal(manifest.schemaVersion,1);
 assert.ok(Array.isArray(manifest.filings));
 // The three-fixture completeness gate will be enabled after the remaining XML files land.
 const seen=new Set();
 for(const item of manifest.filings){
  assert.match(item.file,/^[A-Za-z0-9_-]+\.xml$/);
  assert.ok(!seen.has(item.file));seen.add(item.file);
  assert.match(item.accession,/^\d{10}-\d{2}-\d{6}$/);
  assert.match(item.sourceUrl,/^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/\d+\/\d+\/[\w./-]+\.xml$/);
  assert.match(item.sha256,/^[a-f0-9]{64}$/);
  assert.equal(item.sha256,trustedFixtureHashes[item.accession],'fixture must match independently pinned checksum');
  assert.match(item.retrievedAt,/^\d{4}-\d{2}-\d{2}T/);
  const xml=readFileSync(join(directory,item.file));
  assert.equal(createHash('sha256').update(xml).digest('hex'),item.sha256);
  const root=parseOwnershipXml(xml.toString('utf8'));
  assert.ok(['4','4/A'].includes(val(root,'documentType')));
  if(item.accession==='0001140361-26-036978'||item.accession==='0001193125-26-354277'){
   const amendment=item.accession==='0001193125-26-354277';
   const ticker=amendment?'GAIA':'XBP',cik=amendment?'1089872':'1839530';
   assert.equal(val(root,'documentType'),amendment?'4/A':'4');
   const purchases=extractForm4Purchases(xml.toString('utf8'),{ticker,cik,accession:item.accession,filingUrl:item.sourceUrl});
   assert.equal(purchases.length,1);
   assert.equal(purchases[0].shares,amendment?70750:72394);
   assert.equal(purchases[0].pricePerShare,amendment?1.2166:2.83);
   assert.equal(purchases[0].transactionCode,'P');
   assert.equal(purchases[0].isResearchWorthy,false);
   assert.equal(purchases[0].investmentSignal,false);
   assert.equal(purchases[0].amendmentStatus,amendment?'requires_reconciliation':'original');
   if(!amendment)assert.equal(purchases[0].ownerAttribution,'multiple_reporting_owners_requires_review');
  }
  if(item.accession==='0000080424-26-000218'){
   assert.equal(val(root,'documentType'),'4');
   assert.equal(val(root.children.find(n=>n.name==='issuer'),'issuerCik'),'0000080424');
   const tx=root.children.find(n=>n.name==='nonDerivativeTable')?.children.find(n=>n.name==='nonDerivativeTransaction');
   assert.equal(val(tx.children.find(n=>n.name==='transactionCoding'),'transactionCode'),'A');
   assert.equal(val(tx.children.find(n=>n.name==='transactionAmounts'),'transactionPricePerShare'),'0');
   assert.deepEqual(extractForm4Purchases(xml.toString('utf8'),{ticker:'PG',cik:'80424',accession:item.accession,filingUrl:item.sourceUrl}),[]);
  }
 }
});
