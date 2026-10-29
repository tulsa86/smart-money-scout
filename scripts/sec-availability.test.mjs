import test from 'node:test';
import assert from 'node:assert/strict';
import {secAvailableAt,canUseSecFilingAt,publiclyActionableAt} from './sec-availability.mjs';

test('EDT acceptance is converted to UTC and cannot be traded before disclosure',()=>{
 assert.equal(secAvailableAt('2026-10-14T17:05:00'),'2026-10-14T21:05:00.000Z');
 assert.equal(canUseSecFilingAt('2026-10-14T17:05:00','2026-10-14T19:55:00Z'),false);
 assert.equal(canUseSecFilingAt('2026-10-14T17:05:00','2026-10-15T13:30:00Z'),true);
});
test('EST acceptance and fractional seconds are preserved',()=>{
 assert.equal(secAvailableAt('2026-12-14T17:05:00.123'),'2026-12-14T22:05:00.123Z');
 assert.equal(canUseSecFilingAt('2026-12-14T17:05:00.123','2026-12-14T22:05:00.122Z'),false);
 assert.equal(canUseSecFilingAt('2026-12-14T17:05:00.123','2026-12-14T22:20:00.123Z'),true);
});
test('nonexistent spring-forward and ambiguous fall-back times fail closed',()=>{
 assert.equal(secAvailableAt('2026-03-08T02:30:00'),null);
 assert.equal(secAvailableAt('2026-11-01T01:30:00'),null);
});
test('missing, invalid and timezone-free decision timestamps never grant eligibility',()=>{
 for(const value of [null,'2026-02-30T17:00:00','2026-10-14T25:00:00','2026-10-14T17:00:00Z'])assert.equal(secAvailableAt(value),null);
 assert.equal(canUseSecFilingAt(null,'2026-10-15T13:30:00Z'),false);
 assert.equal(canUseSecFilingAt('2026-10-14T17:05:00','2026-10-15T09:30:00'),false);
});

test('SEC lag buffer blocks 15:55 ET filing at 16:00 ET decision',()=>{
 assert.equal(publiclyActionableAt('2026-10-28T15:55:00'),'2026-10-28T20:10:00.000Z');
 assert.equal(canUseSecFilingAt('2026-10-28T15:55:00','2026-10-28T20:00:00Z'),false);
 assert.equal(canUseSecFilingAt('2026-10-28T15:55:00','2026-10-28T20:10:00Z'),true);
 assert.equal(publiclyActionableAt('2026-11-01T01:30:00'),null);
});
