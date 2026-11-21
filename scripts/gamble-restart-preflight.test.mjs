import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('restart preflight is read-only and reports paused schedule',()=>{
 const result=spawnSync(process.execPath,['scripts/gamble-restart-preflight.mjs'],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/"scheduledRunsEnabled": false/);
 assert.match(result.stdout,/does not verify live Alpaca coverage/);
});
