import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dietFlags, normalizeMeal, parseSteps, tagAllergens } from './normalize.mjs';

const allergens = (...names) => tagAllergens(names.map((n) => n.toLowerCase()));

test('detects the common allergens', () => {
  assert.deepEqual(allergens('Spaghetti', 'Parmesan', 'Egg Yolks'), ['dairy', 'eggs', 'gluten']);
  assert.deepEqual(allergens('King Prawns', 'Fish Sauce', 'Sesame Seed Oil'), ['fish', 'sesame', 'shellfish']);
  assert.deepEqual(allergens('Peanut Butter'), ['peanuts']);
  assert.deepEqual(allergens('Soy Sauce'), ['gluten', 'soy']);
  assert.deepEqual(allergens('Walnuts', 'Almonds'), ['tree_nuts']);
});

test('catches less common fish and mixed seafood', () => {
  assert.deepEqual(allergens('Barramundi', 'Lemon'), ['fish']);
  assert.deepEqual(allergens('Frozen Seafood Mix'), ['fish', 'shellfish']);
  assert.deepEqual(allergens('Conchs'), ['shellfish']);
});

test('avoids well-known false positives', () => {
  assert.deepEqual(allergens('Coconut Milk', 'Aubergine', 'Eggplant', 'Butternut Squash', 'Butter Beans'), []);
  assert.deepEqual(allergens('Rice Noodles', 'Corn Flour', 'Cream of Tartar', 'Water Chestnuts'), []);
  assert.deepEqual(allergens('Kidney Beans', 'Nutmeg', 'Cocoa Butter'), []);
});

test('diet flags follow the ingredients, not just the category', () => {
  const flags = (category, ...names) => {
    const lower = names.map((n) => n.toLowerCase());
    return dietFlags({ category, names: lower, allergens: tagAllergens(lower) });
  };
  assert.deepEqual(flags('Vegetarian', 'Tomato', 'Basil', 'Mozzarella'), ['pescatarian', 'vegetarian']);
  assert.deepEqual(flags('Vegan', 'Tomato', 'Basil', 'Chickpeas'), ['pescatarian', 'vegan', 'vegetarian']);
  assert.deepEqual(flags('Vegetarian', 'Rice', 'Chicken Stock'), []);
  assert.deepEqual(flags('Seafood', 'Salmon', 'Lemon'), ['pescatarian']);
  assert.deepEqual(flags('Beef', 'Brisket', 'Onion'), []);
  assert.deepEqual(flags('Vegetarian', 'Kidney Beans', 'Honey'), ['pescatarian', 'vegetarian']);
});

test('parses numbered and single-paragraph instructions', () => {
  assert.deepEqual(parseSteps('STEP 1\r\nChop onions.\r\nSTEP 2\r\nFry them.'), ['Chop onions.', 'Fry them.']);
  assert.deepEqual(parseSteps('1. Chop onions.\n2) Fry them.\n\n3 - Serve.'), ['Chop onions.', 'Fry them.', 'Serve.']);
  assert.deepEqual(parseSteps('2 tablespoons of oil go in the pan.\nStir.'), ['2 tablespoons of oil go in the pan.', 'Stir.']);
  const long = 'Heat the oil in a large pan over medium heat. '.repeat(4) + 'Add the onions and cook until soft and golden. ' + 'Serve hot with rice and a squeeze of lemon on top. '.repeat(3);
  assert.ok(parseSteps(long).length > 3);
});

test('skips non-dinner and unusable meals', () => {
  const base = { idMeal: '1', strMeal: 'X', strCountry: 'Italy', strMealThumb: 'u', strInstructions: 'Cook it.', strIngredient1: 'a', strIngredient2: 'b', strIngredient3: 'c' };
  assert.equal(normalizeMeal({ ...base, strCategory: 'Dessert' }), null);
  assert.equal(normalizeMeal({ ...base, strCategory: 'Pasta', strCountry: null }), null);
  assert.equal(normalizeMeal({ ...base, strCategory: 'Pasta', strIngredient3: '' }), null);
  assert.equal(normalizeMeal({ ...base, strCategory: 'Pasta' }).country, 'Italy');
  // Unknown seafood ingredients still get flagged for fish and shellfish allergies.
  assert.deepEqual(normalizeMeal({ ...base, strCategory: 'Seafood', strIngredient1: 'mystery' }).allergens, ['fish', 'shellfish']);
});
