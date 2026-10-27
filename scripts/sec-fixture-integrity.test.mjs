import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {parseOwnershipXml,val} from './form4-xml.mjs';

const directory=resolve('tests/fixtures/sec');
const manifest=JSON.parse(readFileSync(join(directory,'manifest.json'),'utf8'));
test('SEC fixture manifest schema and genuine-source provenance',()=>{
 assert.equal(manifest.schemaVersion,1);
 assert.ok(Array.isArray(manifest.filings));
 const seen=new Set();
 for(const item of manifest.filings){
  assert.match(item.file,/^[A-Za-z0-9_-]+\.xml$/);
  assert.ok(!seen.has(item.file));seen.add(item.file);
  assert.match(item.accession,/^\d{10}-\d{2}-\d{6}$/);
  assert.match(item.sourceUrl,/^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/\d+\/\d+\/[\w./-]+\.xml$/);
  assert.match(item.sha256,/^[a-f0-9]{64}$/);
  assert.match(item.retrievedAt,/^\d{4}-\d{2}-\d{2}T/);
  const xml=readFileSync(join(directory,item.file));
  assert.equal(createHash('sha256').update(xml).digest('hex'),item.sha256);
  const root=parseOwnershipXml(xml.toString('utf8'));
  assert.ok(['4','4/A'].includes(val(root,'documentType')));
 }
});
