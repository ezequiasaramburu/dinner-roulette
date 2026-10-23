import assert from 'node:assert/strict';
import { test } from 'node:test';

import { safeEqual, toSubscriptionUpdate } from './parse.ts';

const USER = '3f2b8c1e-9d4a-4e0b-8a6f-1c2d3e4f5a6b';
const event = (over = {}) => ({
  event: { type: 'INITIAL_PURCHASE', app_user_id: USER, product_id: 'yearly', entitlement_ids: ['dinner_roulette_pro'], event_timestamp_ms: 1_760_000_000_000, expiration_at_ms: 1_762_592_000_000, ...over },
});

test('a purchase gives access until the expiry date', () => {
  assert.deepEqual(toSubscriptionUpdate(event()), {
    userId: USER,
    productId: 'yearly',
    until: new Date(1_762_592_000_000).toISOString(),
    eventAt: new Date(1_760_000_000_000).toISOString(),
  });
});

test('an event with no expiry date is ignored, so nothing unlocks for ever', () => {
  assert.equal(toSubscriptionUpdate(event({ expiration_at_ms: null })), null);
  assert.equal(toSubscriptionUpdate(event({ expiration_at_ms: undefined })), null);
});

test('an expiry or refund in the past is passed on so access ends', () => {
  const u = toSubscriptionUpdate(event({ type: 'EXPIRATION', expiration_at_ms: 1_700_000_000_000 }));
  assert.equal(u?.until, new Date(1_700_000_000_000).toISOString());
});

test('events that change nothing, anonymous customers and other entitlements are ignored', () => {
  assert.equal(toSubscriptionUpdate(event({ type: 'TEST' })), null);
  assert.equal(toSubscriptionUpdate(event({ type: 'TRANSFER' })), null);
  assert.equal(toSubscriptionUpdate(event({ app_user_id: '$RCAnonymousID:abc123' })), null);
  assert.equal(toSubscriptionUpdate(event({ entitlement_ids: ['something_else'] })), null);
  assert.equal(toSubscriptionUpdate(event({ event_timestamp_ms: undefined })), null);
});

test('garbage is ignored, not thrown', () => {
  for (const bad of [null, undefined, 'x', 42, {}, { event: null }, { event: { type: 5 } }]) {
    assert.equal(toSubscriptionUpdate(bad), null);
  }
});

test('secrets match only when identical', () => {
  assert.equal(safeEqual('abc123', 'abc123'), true);
  assert.equal(safeEqual('abc124', 'abc123'), false);
  assert.equal(safeEqual('abc12', 'abc123'), false);
  assert.equal(safeEqual('abc1234', 'abc123'), false);
  assert.equal(safeEqual('', 'abc123'), false);
  assert.equal(safeEqual(null, 'abc123'), false);
});
