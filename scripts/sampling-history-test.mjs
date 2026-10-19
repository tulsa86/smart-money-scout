import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {captureResearch} from './research-capture.mjs';
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'sms-sampling-test-'));
const original=process.cwd();
const now=Date.parse('2026-10-19T12:00:00Z');
const mint=n=>String(n).padStart(32,'1');
const pair=n=>({chainId:'solana',baseToken:{address:mint(n),symbol:'T'+n},priceUsd:'1',liquidity:{usd:200000},volume:{h24:400000},priceChange:{h1:8},pairCreatedAt:now-10*86400000});
const pairs=[1,2,3,4,5,6].map(pair);
try{
 process.chdir(tmp);
 await captureResearch({pairs,api:'https://example.invalid',now,positions:[],trades:[]});
 const first=JSON.parse(await fs.readFile('public/research/sampling-history.json','utf8'));
 assert.equal(Object.keys(first).length,4);
 // Clear pending outcomes to mimic completed work; persistent recency must survive.
 await fs.writeFile('public/research/pending.json','[]\n');
 await captureResearch({pairs,api:'https://example.invalid',now:now+60000,positions:[],trades:[]});
 const second=JSON.parse(await fs.readFile('public/research/sampling-history.json','utf8'));
 assert.equal(Object.keys(second).length,6,'previously unseen tokens must be sampled despite cleared queue');
 const firstIds=new Set(Object.keys(first));
 const newlySelected=Object.keys(second).filter(id=>!firstIds.has(id));
 assert.equal(newlySelected.length,2);
 assert.ok(newlySelected.every(id=>second[id]===now+60000));
 console.log('PASS persistent recency sampling across cleared pending queue.');
}finally{process.chdir(original);await fs.rm(tmp,{recursive:true,force:true})}
