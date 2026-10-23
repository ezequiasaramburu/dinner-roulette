import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dayLabel, todayIn } from './day-label.ts';

test('today and yesterday are named, older days show the weekday and date', () => {
  assert.equal(dayLabel('2026-10-23', '2026-10-23'), 'Today');
  assert.equal(dayLabel('2026-10-22', '2026-10-23'), 'Yesterday');
  assert.equal(dayLabel('2026-10-12', '2026-10-23'), 'Mon, Oct 12');
  assert.equal(dayLabel('2026-09-30', '2026-10-01'), 'Yesterday', 'across a month end');
});

test("today is the couple's calendar day, not the phone's", () => {
  const instant = new Date('2026-10-23T23:30:00Z');
  assert.equal(todayIn('Pacific/Auckland', instant), '2026-10-24');
  assert.equal(todayIn('America/Los_Angeles', instant), '2026-10-23');
});
