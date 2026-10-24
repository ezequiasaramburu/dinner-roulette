import assert from 'node:assert/strict';
import { test } from 'node:test';

import { handle } from './handle.ts';

const USER = '3f2b8c1e-9d4a-4e0b-8a6f-1c2d3e4f5a6b';
const env = { secret: 's3cret', url: 'https://x.supabase.co', key: 'service-key' };
const body = { event: { type: 'RENEWAL', app_user_id: USER, product_id: 'monthly', entitlement_ids: ['dinner_roulette_pro'], event_timestamp_ms: 1_760_000_000_000, expiration_at_ms: 1_762_592_000_000 } };
const req = (over = {}) =>
  new Request('https://f.test/', { method: 'POST', headers: { Authorization: 's3cret' }, body: JSON.stringify(body), ...over });
const recorder = (ok = true) => {
  const calls = [];
  const send = async (url, init) => (calls.push({ url, init }), { ok });
  return { calls, send };
};

test('no secret set, or a wrong or missing header, is refused and nothing is written', async () => {
  const { calls, send } = recorder();
  assert.equal((await handle(req(), { ...env, secret: undefined }, send)).status, 401);
  assert.equal((await handle(req(), { ...env, secret: '' }, send)).status, 401);
  assert.equal((await handle(req({ headers: { Authorization: 'nope' } }), env, send)).status, 401);
  assert.equal((await handle(req({ headers: {} }), env, send)).status, 401);
  assert.equal(calls.length, 0);
});

test('only POST is accepted', async () => {
  const { calls, send } = recorder();
  assert.equal((await handle(req({ method: 'GET', body: undefined }), env, send)).status, 405);
  assert.equal(calls.length, 0);
});

test('a bad body is a 400, and an event that changes nothing is ignored without a write', async () => {
  const { calls, send } = recorder();
  assert.equal((await handle(req({ body: 'not json' }), env, send)).status, 400);
  assert.equal((await handle(req({ body: JSON.stringify({ event: { type: 'TEST' } }) }), env, send)).status, 200);
  assert.equal(calls.length, 0);
});

test('a good event is passed to the database with the service key', async () => {
  const { calls, send } = recorder();
  const res = await handle(req(), env, send);
  assert.equal(res.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://x.supabase.co/rest/v1/rpc/apply_subscription_event');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer service-key');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    p_user: USER,
    p_product: 'monthly',
    p_until: new Date(1_762_592_000_000).toISOString(),
    p_event_at: new Date(1_760_000_000_000).toISOString(),
  });
});

test('a database failure answers 500 so RevenueCat retries; a missing service key is a 500 too', async () => {
  assert.equal((await handle(req(), env, recorder(false).send)).status, 500);
  assert.equal((await handle(req(), { ...env, key: undefined }, recorder().send)).status, 500);
});

test('the database call has a time limit, and a timeout or network error answers 500 so RevenueCat retries', async () => {
  const { calls, send } = recorder();
  await handle(req(), env, send);
  assert.ok(calls[0].init.signal instanceof AbortSignal, 'the call can be cut off');

  // What fetch throws when the signal's time runs out.
  const timedOut = async () => {
    throw new DOMException('The operation timed out.', 'TimeoutError');
  };
  assert.equal((await handle(req(), env, timedOut)).status, 500);

  const broken = async () => {
    throw new TypeError('fetch failed');
  };
  assert.equal((await handle(req(), env, broken)).status, 500);
});
