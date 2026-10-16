import assert from 'node:assert/strict';
import { test } from 'node:test';

import { withTimeout } from './fetch-timeout.ts';

// A fetch that only ends when it is aborted, like a connection that went quiet.
const hanging = (_url, init) =>
  new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));

test('a request that hangs fails with a network timeout', async () => {
  const f = withTimeout(hanging, 20);
  await assert.rejects(f('https://x.test/rest/v1/rpc/get_swipe_feed'), /Network request timed out/);
});

test('uploads get the longer limit', async () => {
  const f = withTimeout(hanging, 20, 200);
  const started = Date.now();
  await assert.rejects(f('https://x.test/storage/v1/object/recipe-photos/a.jpg'), /timed out/);
  assert.ok(Date.now() - started >= 150, 'waited for the upload limit, not the normal one');
});

test('a normal answer passes through untouched', async () => {
  const f = withTimeout(async () => new Response('ok'), 20);
  assert.equal(await (await f('https://x.test/a')).text(), 'ok');
});

test('a caller who cancels keeps their own error, and other failures pass through', async () => {
  const f = withTimeout(hanging, 1_000);
  const controller = new AbortController();
  const pending = f('https://x.test/a', { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, /aborted/);
  const broken = withTimeout(async () => { throw new TypeError('Network request failed'); }, 20);
  await assert.rejects(broken('https://x.test/a'), /Network request failed/);
});
