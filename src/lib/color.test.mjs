import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mix } from './color.ts';

test('mix returns the first colour at 0 and the second at 1', () => {
  assert.equal(mix('#B93D26', '#FFFFFF', 0), '#B93D26');
  assert.equal(mix('#B93D26', '#FFFFFF', 1), '#FFFFFF');
});

test('mix blends channel by channel and rounds', () => {
  assert.equal(mix('#000000', '#FFFFFF', 0.5), '#808080');
  assert.equal(mix('#B93D26', '#FFFFFF', 0.06), '#BD4933');
});

test('mix accepts lower case and gives upper case', () => {
  assert.equal(mix('#b93d26', '#ffffff', 0), '#B93D26');
});

test('mix refuses anything that is not a 6-digit hex colour', () => {
  assert.throws(() => mix('red', '#FFFFFF', 0.5), /hex/);
  assert.throws(() => mix('#FFF', '#FFFFFF', 0.5), /hex/);
});
