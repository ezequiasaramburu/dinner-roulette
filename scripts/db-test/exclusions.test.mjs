import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';

import { addUser, asUser, buildDeck, createDb, prefs } from './harness.mjs';

let db, recipes;
before(async () => {
  db = await createDb();
  recipes = (await db.query('select id, title, ingredient_names from public.recipes')).rows;
});

const matches = async (name, term) =>
  (await db.query('select $1 ~* public.term_pattern($2) as m', [name, term])).rows[0].m;

describe('matching a term against ingredient names', () => {
  test('whole words only: "nut" is not nutmeg or butternut', async () => {
    assert.equal(await matches('nutmeg', 'nut'), false);
    assert.equal(await matches('butternut squash', 'nut'), false);
    assert.equal(await matches('doughnut', 'nut'), false);
    assert.equal(await matches('mixed nut butter', 'nut'), true);
  });

  test('plurals work both ways, and multi-word terms match across spacing', async () => {
    assert.equal(await matches('peanut butter', 'peanuts'), true);
    assert.equal(await matches('peanuts', 'peanut'), true);
    assert.equal(await matches('roasted kiwis', 'kiwi'), true);
    assert.equal(await matches('hummus', 'hummus'), true);
    assert.equal(await matches('soy   sauce', 'soy sauce'), true);
    assert.equal(await matches('dijon mustard', 'mustard'), true);
    assert.equal(await matches('mustard seeds', 'Mustard!'), true);
  });

  test('regex characters in what people type cannot break or widen the match', async () => {
    assert.equal(await matches('chicken', '.*'), false);
    assert.equal(await matches('anything', '(a|b'), false);
  });
});

describe('storing exclusions', () => {
  let n = 0;
  async function prefsRow(over) {
    const user = await addUser(db, `ex${++n}@test.dev`);
    await db.query(
      'insert into preferences (user_id, custom_allergens, custom_dislikes) values ($1, $2, $3)',
      [user, over.allergens ?? [], over.dislikes ?? []],
    );
    return user;
  }
  const read = async (u) =>
    (await asUser(db, u, () => db.query('select custom_allergens, custom_dislikes from public.preferences'))).rows[0];

  test('what people type is cleaned: case, punctuation, spaces, duplicates, too short or long', async () => {
    const u = await prefsRow({ allergens: ['  Kiwi!! ', 'KIWI', 'peanut   butter', 'a', '', 'x'.repeat(41), 'mustard; DROP TABLE'] });
    assert.deepEqual((await read(u)).custom_allergens, ['kiwi', 'mustard drop table', 'peanut butter']);
  });

  test('updates are cleaned too, and more than 20 terms are refused', async () => {
    const u = await prefsRow({});
    await asUser(db, u, () => db.query("update public.preferences set custom_dislikes = array['  Celery ', 'celery'] where user_id = $1", [u]));
    assert.deepEqual((await read(u)).custom_dislikes, ['celery']);
    const many = Array.from({ length: 21 }, (_, i) => `food${String.fromCharCode(97 + i)}${String.fromCharCode(97 + i)}`);
    await assert.rejects(asUser(db, u, () => db.query('update public.preferences set custom_allergens = $2 where user_id = $1', [u, many])), /too_many_exclusions/);
  });

  test('your exclusions are private: nobody else can read them', async () => {
    const a = await prefsRow({ allergens: ['kiwi'] });
    const b = await prefsRow({});
    const seen = await asUser(db, b, () => db.query('select * from public.preferences'));
    assert.ok(!seen.rows.some((r) => r.user_id === a));
  });
});

describe('decks respect free-text exclusions', () => {
  const ingredientsMatch = (r, re) => r.ingredient_names.some((n) => re.test(n));

  test('a term removes every recipe whose ingredients name it, for both partners', async () => {
    const base = await buildDeck(db, prefs(), prefs(), {}, 100);
    const cut = await buildDeck(db, prefs({ custom_terms: ['mushroom'] }), prefs(), {}, 100);
    const re = /\bmushrooms?\b/i;
    const expected = recipes.filter((r) => !ingredientsMatch(r, re));
    assert.equal(cut[0].pool_size, expected.length);
    assert.ok(cut[0].pool_size < base[0].pool_size);
    const bad = new Set(recipes.filter((r) => ingredientsMatch(r, re)).map((r) => r.id));
    assert.ok(!cut.some((d) => bad.has(d.id)), 'a mushroom dish got through');
    // Same result when it is the partner who has the exclusion.
    const other = await buildDeck(db, prefs(), prefs({ custom_terms: ['mushroom'] }), {}, 100);
    assert.equal(other[0].pool_size, expected.length);
  });

  test('terms from both partners add up, and an unknown term changes nothing', async () => {
    const both = await buildDeck(db, prefs({ custom_terms: ['mushroom'] }), prefs({ custom_terms: ['olive'] }), {}, 100);
    const expected = recipes.filter((r) => !ingredientsMatch(r, /\bmushrooms?\b/i) && !ingredientsMatch(r, /\bolives?\b/i));
    assert.equal(both[0].pool_size, expected.length);
    const none = await buildDeck(db, prefs({ custom_terms: ['zzzqqq'] }), prefs(), {}, 100);
    assert.equal(none[0].pool_size, recipes.length);
  });

  test('end to end: the queue built for a couple never contains an excluded ingredient', async () => {
    const a = await addUser(db, 'e2e-a@test.dev');
    const b = await addUser(db, 'e2e-b@test.dev');
    const couple = (await db.query("insert into couples (owner_id, timezone) values ($1, 'Europe/Rome') returning id", [a])).rows[0].id;
    await db.query("insert into couple_members (couple_id, user_id, role) values ($1, $2, 'owner'), ($1, $3, 'partner')", [couple, a, b]);
    await db.query("insert into preferences (user_id, custom_allergens) values ($1, array['egg'])", [a]);
    await db.query("insert into preferences (user_id, custom_dislikes) values ($1, array['cilantro'])", [b]);
    await asUser(db, a, () => db.query('select public.get_swipe_feed()'));
    const { rows } = await db.query('select recipe_ids from daily_decks where couple_id = $1', [couple]);
    const ids = new Set(rows[0].recipe_ids);
    assert.ok(ids.size > 50);
    for (const r of recipes.filter((r) => ids.has(r.id))) {
      assert.ok(!ingredientsMatch(r, /\beggs?\b/i), `${r.title} has egg`);
      assert.ok(!ingredientsMatch(r, /\bcilantros?\b/i), `${r.title} has cilantro`);
    }
  });
});
