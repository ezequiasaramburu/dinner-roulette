import assert from 'node:assert/strict';
import { test } from 'node:test';

// The "device" clock for these tests. Set before any Date is formatted.
process.env.TZ = 'UTC';
const { timeInZoneToLocal, timePassedToday } = await import('./zoned-time.ts');

const at = (iso) => new Date(iso);

test('same zone: nothing changes', () => {
  assert.deepEqual(timeInZoneToLocal('17:00', 'UTC', at('2026-10-14T08:00:00Z')), { hour: 17, minute: 0 });
});

test('Rome is two hours ahead of UTC in summer and one in winter', () => {
  assert.deepEqual(timeInZoneToLocal('17:00', 'Europe/Rome', at('2026-07-01T08:00:00Z')), { hour: 15, minute: 0 });
  assert.deepEqual(timeInZoneToLocal('17:00', 'Europe/Rome', at('2026-12-01T08:00:00Z')), { hour: 16, minute: 0 });
});

test('half-hour zones and zones across the date line', () => {
  assert.deepEqual(timeInZoneToLocal('17:30', 'Asia/Kolkata', at('2026-10-14T08:00:00Z')), { hour: 12, minute: 0 });
  assert.deepEqual(timeInZoneToLocal('09:00', 'Pacific/Auckland', at('2026-12-01T08:00:00Z')), { hour: 20, minute: 0 });
});

test('the day in the couple\'s zone is the one that counts, not the device\'s', () => {
  // 23:30 UTC on 13 Oct is already 14 Oct in Rome; 17:00 there is 15:00 UTC.
  assert.deepEqual(timeInZoneToLocal('17:00', 'Europe/Rome', at('2026-10-13T23:30:00Z')), { hour: 15, minute: 0 });
});

test('daylight saving: the instant is found on the day of the change too', () => {
  // Rome clocks go back on 25 Oct 2026 (03:00 CEST -> 02:00 CET): 17:00 that day is already winter time.
  assert.deepEqual(timeInZoneToLocal('17:00', 'Europe/Rome', at('2026-10-25T08:00:00Z')), { hour: 16, minute: 0 });
  assert.deepEqual(timeInZoneToLocal('17:00', 'Europe/Rome', at('2026-10-24T08:00:00Z')), { hour: 15, minute: 0 });
});

test('a device in another zone sees the reveal on its own clock', () => {
  process.env.TZ = 'America/Argentina/Buenos_Aires'; // UTC-3 all year
  assert.deepEqual(timeInZoneToLocal('17:00', 'Europe/Rome', at('2026-07-01T08:00:00Z')), { hour: 12, minute: 0 });
  assert.deepEqual(timeInZoneToLocal('17:00', 'Europe/Rome', at('2026-12-01T08:00:00Z')), { hour: 13, minute: 0 });
  process.env.TZ = 'UTC';
});

test('timePassedToday compares with the wall clock of the couple, not the phone', () => {
  // 15:30 UTC is 16:30 in Rome (winter time) and 12:30 in Buenos Aires.
  const now = at('2026-01-15T15:30:00Z');
  assert.equal(timePassedToday('16:00', 'Europe/Rome', now), true);
  assert.equal(timePassedToday('16:30', 'Europe/Rome', now), true, 'the same minute counts as passed');
  assert.equal(timePassedToday('17:00', 'Europe/Rome', now), false);
  assert.equal(timePassedToday('12:00', 'America/Argentina/Buenos_Aires', now), true);
  assert.equal(timePassedToday('17:00', 'America/Argentina/Buenos_Aires', now), false, 'it is 17:00 in Rome but only 12:30 there');
  assert.equal(timePassedToday('12:31', 'America/Argentina/Buenos_Aires', now), false);
});
