import assert from 'node:assert/strict';
import { test } from 'node:test';

const { ingredientLine, mainIngredients, ingredientList } = await import('./main-ingredients.ts');

test('drops pantry basics and puts proteins first', () => {
  const names = ['olive oil', 'onion', 'garlic', 'salt', 'chicken breasts', 'rice', 'tomato', 'cumin'];
  assert.deepEqual(mainIngredients(names), ['chicken breasts', 'rice', 'tomato']);
});

test('an aubergine dish is about the aubergine, not the olive oil', () => {
  const names = ['olive oil', 'onion', 'red chilli', 'ginger', 'ground cumin', 'chickpeas', 'tomato', 'lemon', 'aubergine', 'greek yogurt', 'walnuts', 'coriander'];
  assert.deepEqual(mainIngredients(names), ['chickpeas', 'aubergine', 'red chilli', 'tomato']);
});

test('a dish with only basics left shows nothing rather than "salt, oil"', () => {
  assert.equal(ingredientLine(['salt', 'water', 'olive oil']), null);
});

test('the line is capitalised once and joined with dots', () => {
  assert.equal(ingredientLine(['chorizo', 'crusty bread', 'chimichurri sauce']), 'Chorizo · crusty bread · chimichurri sauce');
});

test('"pepper" the spice is a basic, but red pepper and bell peppers are not', () => {
  assert.deepEqual(mainIngredients(['black pepper', 'pepper', 'red pepper', 'beef']), ['beef', 'red pepper']);
});

test('the full list keeps everything, capitalised, without duplicates', () => {
  assert.deepEqual(ingredientList(['egg', 'salt', 'egg', 'olive oil']), ['Egg', 'Salt', 'Olive oil']);
});
