import assert from 'node:assert/strict';
import { test } from 'node:test';

import { shoppingList } from './shopping-list.ts';

test('lists each ingredient under the dish name, measure first', () => {
  const text = shoppingList('Paella', [
    { name: 'Rice', measure: '300g' },
    { name: 'Saffron', measure: '' },
  ]);
  assert.equal(text, 'Ingredients for Paella\n- 300g Rice\n- Saffron');
});
