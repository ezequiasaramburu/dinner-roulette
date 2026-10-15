import assert from 'node:assert/strict';
import { test } from 'node:test';

import { haptics } from './haptics.ts';

// Node has no native haptics engine, which is the same situation as a dev build that was not rebuilt yet.
for (const kind of ['tap', 'select', 'success', 'soft']) {
  test(`haptics.${kind} is a safe no-op when the native module is missing`, () => {
    assert.doesNotThrow(() => haptics[kind]());
  });
}

test('haptics return nothing, so callers can never wait on them', () => {
  assert.equal(haptics.tap(), undefined);
});
