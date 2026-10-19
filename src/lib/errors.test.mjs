import assert from 'node:assert/strict';
import { test } from 'node:test';

import { friendlyError, isNetworkError, OFFLINE_MESSAGE } from './errors.ts';

test('known server errors keep their own message', () => {
  assert.equal(friendlyError({ message: 'too_many_attempts' }), 'Too many wrong codes. Please wait a few minutes and try again.');
  assert.equal(friendlyError({ message: 'subscription_required' }), 'Dinner is paused until the subscription is renewed.');
  assert.equal(friendlyError({ message: 'recipes_need_subscription' }), 'Sharing recipes is for subscribers.');
});

test('connection problems say so, whatever form they arrive in', () => {
  for (const message of ['TypeError: Network request failed', 'Network request timed out', 'Failed to fetch', 'The Internet connection appears to be offline.']) {
    assert.equal(isNetworkError({ message }), true, message);
    assert.equal(friendlyError({ message }), OFFLINE_MESSAGE, message);
  }
});

test('anything else stays generic, and odd inputs never throw', () => {
  assert.equal(friendlyError({ message: 'duplicate key value' }), 'Something went wrong. Please try again.');
  for (const odd of [null, undefined, 'x', 42, {}]) assert.equal(friendlyError(odd), 'Something went wrong. Please try again.');
  assert.equal(isNetworkError(null), false);
});
