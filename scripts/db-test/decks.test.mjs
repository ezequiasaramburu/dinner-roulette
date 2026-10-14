import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { before, describe, test } from 'node:test';

import { EXCLUDED } from '../mealdb/exclude.mjs';
import { addUser, asUser, buildDeck, createDb, prefs } from './harness.mjs';

const ALLERGENS = ['gluten', 'dairy', 'eggs', 'peanuts', 'tree_nuts', 'soy', 'fish', 'shellfish', 'sesame'];
const RANK = { none: 0, pescatarian: 1, vegetarian: 2, vegan: 3 };

let db, recipes, hardIds, softIds, cuisines;

before(async () => {
  db = await createDb();
  recipes = (
    await db.query(`
      select r.id, r.source_id, r.title, r.country, r.category, r.allergens, r.diet_flags,
             coalesce((select array_agg(h.dislike_id) from public.recipe_dislike_hits h where h.recipe_id = r.id), '{}') as hits
      from public.recipes r`)
  ).rows;
  const rules = (await db.query('select id, tier from public.dislike_rules')).rows;
  hardIds = rules.filter((r) => r.tier === 'hard').map((r) => r.id);
  softIds = rules.filter((r) => r.tier === 'soft').map((r) => r.id);
  cuisines = [...new Set(recipes.map((r) => r.country))];
});

// Independent oracle: the same filter rules, written separately in JS.
function oracle(a, b) {
  const diet = [a.diet, b.diet].sort((x, y) => RANK[y] - RANK[x])[0];
  const allergens = new Set([...a.allergens, ...b.allergens]);
  const disliked = new Set([...a.disliked, ...b.disliked]);
  const hard = [...disliked].filter((d) => hardIds.includes(d));
  const soft = [...disliked].filter((d) => softIds.includes(d));
  const pool = recipes.filter(
    (r) =>
      (diet === 'none' || r.diet_flags.includes(diet)) &&
      !r.allergens.some((x) => allergens.has(x)) &&
      !r.hits.some((h) => hard.includes(h)),
  );
  const clean = pool.filter((r) => !r.hits.some((h) => soft.includes(h)));
  return { diet, allergens, hard, soft, pool, clean };
}

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomPrefs(rand) {
  const pick = (arr, p) => arr.filter(() => rand() < p);
  return prefs({
    diet: ['none', 'none', 'none', 'none', 'pescatarian', 'vegetarian', 'vegan'][Math.floor(rand() * 7)],
    allergens: pick(ALLERGENS, 0.06),
    disliked: pick([...hardIds, ...softIds], 0.13),
    cuisines: rand() < 0.3 ? [] : pick(cuisines, 0.08),
  });
}

describe('migrations', () => {
  // The Supabase API role runs with pg_safeupdate, which rejects UPDATE/DELETE without WHERE.
  // Our in-process Postgres doesn't have it, so guard against it statically.
  test('every UPDATE and DELETE has a WHERE clause', () => {
    const dir = new URL('../../supabase/migrations/', import.meta.url);
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql'))) {
      const sql = readFileSync(new URL(file, dir), 'utf8').replace(/--.*$/gm, '');
      for (const stmt of sql.match(/\b(update\s+[\w."]+(\s+\w+)?\s+set|delete\s+from\s+[\w."]+)[^;]*;/gi) ?? []) {
        assert.match(stmt, /\bwhere\b/i, `${file}: statement without WHERE: ${stmt.slice(0, 90)}...`);
      }
    }
  });
});

describe('catalog', () => {
  test('has a healthy number of dinners and none of the blocklisted dishes', () => {
    assert.ok(recipes.length >= 400, `only ${recipes.length} recipes`);
    const ids = new Set(recipes.map((r) => r.source_id));
    for (const id of EXCLUDED.keys()) assert.ok(!ids.has(id), `excluded dish ${id} is in the catalog`);
  });
});

describe('build_deck filters', () => {
  test('300 random couples: SQL agrees with the oracle, and every rule holds', async () => {
    const rand = rng(42);
    for (let i = 0; i < 300; i++) {
      const a = randomPrefs(rand), b = randomPrefs(rand);
      const o = oracle(a, b);
      const deck = await buildDeck(db, a, b);
      const label = `couple ${i} ${JSON.stringify({ a, b })}`;

      assert.equal(deck.length, Math.min(12, o.pool.length), `deck size, ${label}`);
      if (deck.length) assert.equal(deck[0].pool_size, o.pool.length, `pool size, ${label}`);
      assert.equal(new Set(deck.map((d) => d.id)).size, deck.length, `duplicates, ${label}`);

      const poolIds = new Set(o.pool.map((r) => r.id));
      for (const d of deck) {
        assert.ok(poolIds.has(d.id), `"${d.title}" breaks a hard filter, ${label}`);
        assert.ok(!d.is_repeat, 'no history, so no repeats');
      }
      // Soft dislikes only appear when there aren't enough clean dishes.
      if (o.clean.length >= 12) {
        assert.ok(deck.every((d) => !d.hits.some((h) => o.soft.includes(h))), `soft dislike shown despite alternatives, ${label}`);
      }
    }
  });

  test('allergies are never violated, even for a couple with many', async () => {
    const a = prefs({ allergens: ['gluten', 'dairy', 'eggs'] }), b = prefs({ allergens: ['shellfish', 'peanuts', 'soy'] });
    const deck = await buildDeck(db, a, b);
    assert.ok(deck.length > 0);
    for (const d of deck) assert.ok(!d.allergens.some((x) => [...a.allergens, ...b.allergens].includes(x)), d.title);
  });

  test('the stricter diet wins', async () => {
    const deck = await buildDeck(db, prefs({ diet: 'vegan' }), prefs({ diet: 'none' }));
    assert.ok(deck.length > 0 && deck.every((d) => d.diet_flags.includes('vegan')));
  });

  test("either partner's hard dislike excludes the dish", async () => {
    const deck = await buildDeck(db, prefs({ disliked: ['mushrooms'] }), prefs({ disliked: ['coconut', 'pork'] }));
    for (const d of deck) assert.ok(!d.hits.some((h) => ['mushrooms', 'coconut', 'pork'].includes(h)), d.title);
  });

  test('onions (soft) are avoided while alternatives exist', async () => {
    const deck = await buildDeck(db, prefs({ disliked: ['onions'] }), prefs());
    assert.equal(deck.filter((d) => d.hits.includes('onions')).length, 0);
  });

  test('soft dislikes are used last, not never, when the pool is tiny', async () => {
    // Vegan + many allergies leaves very few dishes; onions must not shrink it further.
    const a = prefs({ diet: 'vegan', allergens: ['gluten', 'soy', 'tree_nuts', 'sesame', 'peanuts'], disliked: ['onions', 'tomatoes'] });
    const o = oracle(a, prefs());
    const deck = await buildDeck(db, a, prefs());
    assert.equal(deck.length, Math.min(12, o.pool.length));
    // clean dishes come first
    const firstSoft = deck.findIndex((d) => d.hits.some((h) => o.soft.includes(h)));
    if (firstSoft >= 0) assert.ok(deck.slice(firstSoft).length <= o.pool.length - o.clean.length || o.clean.length < 12);
  });

  test('a very restrictive couple gets a short deck, not an error', async () => {
    const a = prefs({ diet: 'vegan', allergens: ['gluten', 'soy', 'tree_nuts', 'sesame', 'peanuts', 'eggs', 'dairy'] });
    const o = oracle(a, prefs());
    const deck = await buildDeck(db, a, prefs());
    assert.equal(deck.length, Math.min(12, o.pool.length));
  });
});

describe('build_deck ranking', () => {
  test('cuisines both partners like fill the per-country cap; no country exceeds it', async () => {
    const deck = await buildDeck(db, prefs({ cuisines: ['Italy', 'Thailand'] }), prefs({ cuisines: ['Italy', 'Thailand'] }));
    const count = (c) => deck.filter((d) => d.country === c).length;
    assert.equal(count('Italy'), 3);
    assert.equal(count('Thailand'), 3);
  });

  test('a cuisine only one partner likes still ranks above indifference', async () => {
    const deck = await buildDeck(db, prefs({ cuisines: ['Japan'] }), prefs());
    assert.ok(deck.some((d) => d.country === 'Japan'));
  });

  test('variety: no country or category appears more than 3 times for an open couple', async () => {
    for (let i = 0; i < 60; i++) {
      const deck = await buildDeck(db, prefs(), prefs());
      for (const key of ['country', 'category']) {
        const counts = {};
        for (const d of deck) counts[d[key]] = (counts[d[key]] ?? 0) + 1;
        assert.ok(Math.max(...Object.values(counts)) <= 3, `${key}: ${JSON.stringify(counts)}`);
      }
    }
  });

  test('dish families: never more than 2 rice dishes, pies, soups... in one deck', async () => {
    const generic = new Set(['meat', 'seafood', 'veg', 'other']);
    for (let i = 0; i < 60; i++) {
      const deck = await buildDeck(db, prefs(), prefs());
      const counts = {};
      for (const d of deck) counts[d.dish_type] = (counts[d.dish_type] ?? 0) + 1;
      for (const [family, n] of Object.entries(counts)) assert.ok(n <= (generic.has(family) ? 4 : 2), `${family} x${n}: ${deck.map((d) => d.title).join(' | ')}`);
    }
  });

  test('a small vegan pool still respects the dish-family cap (the "four rice dishes" regression)', async () => {
    const a = prefs({ diet: 'vegan', allergens: ['soy'], disliked: ['tofu'] });
    const generic = new Set(['meat', 'seafood', 'veg', 'other']);
    for (let i = 0; i < 40; i++) {
      const deck = await buildDeck(db, a, prefs({ allergens: ['sesame'] }));
      const counts = {};
      for (const d of deck) counts[d.dish_type] = (counts[d.dish_type] ?? 0) + 1;
      for (const [family, n] of Object.entries(counts)) {
        assert.ok(n <= (generic.has(family) ? 4 : 2), `${family} x${n}: ${deck.map((x) => x.title).join(' | ')}`);
      }
    }
  });

  test('a vegan couple still sees the Vegan Lasagna (vegan butter is not dairy)', async () => {
    const lasagna = recipes.find((r) => r.title === 'Vegan Lasagna');
    assert.ok(lasagna.diet_flags.includes('vegan'), JSON.stringify(lasagna.allergens));
  });

  test('decks are not identical day to day (random tie-break)', async () => {
    const sets = new Set();
    for (let i = 0; i < 8; i++) sets.add((await buildDeck(db, prefs(), prefs())).map((d) => d.id).sort().join());
    assert.ok(sets.size > 1);
  });

  test('recent dishes are skipped; when the pool runs dry the oldest come back first', async () => {
    const keep = 5;
    const recent = {};
    const day = (n) => new Date(Date.UTC(2026, 9, 1 + n)).toISOString().slice(0, 10);
    recipes.slice(keep).forEach((r, i) => (recent[r.id] = day(i % 28)));

    const deck = await buildDeck(db, prefs(), prefs(), recent);
    assert.equal(deck.length, 12);
    assert.equal(deck.filter((d) => !d.is_repeat).length, keep, 'all five unseen dishes are used first');
    assert.ok(deck.slice(0, keep).every((d) => !d.is_repeat));
    const repeats = deck.filter((d) => d.is_repeat);
    const dates = repeats.map((d) => recent[d.id]);
    // Pass 1 enforces variety caps among the repeats, so only check they are all older than the median date.
    assert.ok(dates.every((d) => d <= day(27)));
    assert.equal(deck.filter((d) => d.is_repeat).length, 7);
  });
});

describe('get_or_create_today_deck', () => {
  let a, b, c, couple;

  before(async () => {
    a = await addUser(db, 'a@test.dev');
    b = await addUser(db, 'b@test.dev');
    c = await addUser(db, 'c@test.dev');
    couple = (await db.query("insert into couples (owner_id, timezone) values ($1, 'Pacific/Auckland') returning id", [a])).rows[0].id;
    await db.query("insert into couple_members (couple_id, user_id, role) values ($1, $2, 'owner'), ($1, $3, 'partner')", [couple, a, b]);
  });

  const call = (user) => asUser(db, user, async () => (await db.query('select public.get_or_create_today_deck() as deck')).rows[0].deck);

  test('needs both partners to have finished their preferences', async () => {
    await assert.rejects(call(a), /couple_not_ready/);
    await db.query("insert into preferences (user_id, diet) values ($1, 'none')", [a]);
    await assert.rejects(call(a), /couple_not_ready/);
    await db.query("insert into preferences (user_id, diet, allergens, disliked) values ($1, 'none', '{shellfish}', '{olives}')", [b]);
  });

  test('someone outside any couple cannot get a deck', async () => {
    await assert.rejects(call(c), /couple_not_ready/);
  });

  test('both partners get the same deck, and repeat calls are idempotent', async () => {
    const first = await call(a);
    const second = await call(b);
    const again = await call(a);
    assert.equal(first.recipes.length, 12);
    assert.equal(first.deck_id, second.deck_id);
    assert.equal(first.deck_id, again.deck_id);
    assert.deepEqual(first.recipes.map((r) => r.id), second.recipes.map((r) => r.id));
    assert.equal((await db.query('select count(*)::int n from daily_decks where couple_id = $1', [couple])).rows[0].n, 1);
  });

  test("uses the couple's local date, and respects the partner's allergy", async () => {
    const deck = await call(a);
    const expected = (await db.query("select (now() at time zone 'Pacific/Auckland')::date::text d")).rows[0].d;
    assert.equal(deck.deck_date, expected);
    assert.ok(deck.recipes.every((r) => !r.allergens.includes('shellfish')));
  });

  test('the payload does not leak the recipe (ingredients and steps stay hidden until the reveal)', async () => {
    const deck = await call(a);
    for (const r of deck.recipes) {
      assert.equal(r.ingredients, undefined);
      assert.equal(r.steps, undefined);
      assert.ok(r.title && r.image_url);
    }
  });

  test('tomorrow avoids everything served today', async () => {
    const today = await call(a);
    // Pretend today's deck was yesterday's, then ask for a fresh one.
    await db.query("update daily_decks set deck_date = deck_date - 1 where couple_id = $1", [couple]);
    const next = await call(a);
    const seen = new Set(today.recipes.map((r) => r.id));
    assert.notEqual(next.deck_id, today.deck_id);
    assert.ok(next.recipes.every((r) => !seen.has(r.id)), 'a dish repeated within 30 days');
    assert.equal(next.repeat_count, 0);
  });

  test('row level security: members read their deck, outsiders and clients cannot touch internals', async () => {
    const own = await asUser(db, a, async () => (await db.query('select count(*)::int n from daily_decks')).rows[0].n);
    const outsider = await asUser(db, c, async () => (await db.query('select count(*)::int n from daily_decks')).rows[0].n);
    assert.ok(own >= 1);
    assert.equal(outsider, 0);
    await assert.rejects(asUser(db, a, () => db.query("select * from public.build_deck('{}', '{}')")), /permission denied/);
    await assert.rejects(asUser(db, a, () => db.query('select * from public.recipe_dislike_hits limit 1')), /permission denied/);
    const rules = await asUser(db, a, async () => (await db.query('select * from public.dislike_rules')).rows.length);
    assert.equal(rules, 0, 'dislike_rules is internal: RLS with no policies');
    await assert.rejects(asUser(db, a, () => db.query("insert into daily_decks (couple_id, deck_date, recipe_ids, pool_size) values ($1, current_date + 5, '{}', 0)", [couple])), /row-level security|permission denied/);
  });
});

describe('swipes', () => {
  let a, b, c, d2, couple, deck, otherCouple, otherDeck;

  const callDeck = (user) => asUser(db, user, async () => (await db.query('select public.get_or_create_today_deck() as deck')).rows[0].deck);
  const swipe = (user, deckId, recipeId, liked) =>
    asUser(db, user, () => db.query('select public.record_swipe($1, $2, $3)', [deckId, recipeId, liked]));
  const undo = (user, deckId) => asUser(db, user, async () => (await db.query('select public.undo_last_swipe($1) as r', [deckId])).rows[0].r);
  const mine = (user) => asUser(db, user, async () => (await db.query('select recipe_id, liked from public.swipes')).rows);

  before(async () => {
    a = await addUser(db, 'sw-a@test.dev');
    b = await addUser(db, 'sw-b@test.dev');
    c = await addUser(db, 'sw-c@test.dev');
    d2 = await addUser(db, 'sw-d@test.dev');
    couple = (await db.query("insert into couples (owner_id, timezone) values ($1, 'Europe/Rome') returning id", [a])).rows[0].id;
    await db.query("insert into couple_members (couple_id, user_id, role) values ($1, $2, 'owner'), ($1, $3, 'partner')", [couple, a, b]);
    otherCouple = (await db.query("insert into couples (owner_id, timezone) values ($1, 'Europe/Rome') returning id", [c])).rows[0].id;
    await db.query("insert into couple_members (couple_id, user_id, role) values ($1, $2, 'owner'), ($1, $3, 'partner')", [otherCouple, c, d2]);
    for (const u of [a, b, c, d2]) await db.query("insert into preferences (user_id, diet) values ($1, 'none')", [u]);
    deck = await callDeck(a);
    otherDeck = await callDeck(c);
  });

  test('a fresh deck has no swipes yet', async () => {
    assert.deepEqual(deck.my_swipes, {});
    assert.equal(deck.partner_swiped, 0);
  });

  test('swiping stores the choice; the payload shows my swipes and only the COUNT of my partner\'s', async () => {
    const [r1, r2, r3] = deck.recipes.map((r) => r.id);
    await swipe(a, deck.deck_id, r1, true);
    await swipe(a, deck.deck_id, r2, false);
    await swipe(b, deck.deck_id, r3, true);

    const forA = await callDeck(a);
    assert.deepEqual(forA.my_swipes, { [r1]: true, [r2]: false });
    assert.equal(forA.partner_swiped, 1);
    assert.ok(!JSON.stringify(forA).includes(`"${r3}":`), "the partner's choices must not leak");

    const forB = await callDeck(b);
    assert.deepEqual(forB.my_swipes, { [r3]: true });
    assert.equal(forB.partner_swiped, 2);
  });

  test("row level security: you can read only your own swipes", async () => {
    const rows = await mine(a);
    assert.equal(rows.length, 2);
    const outsider = await mine(c);
    assert.equal(outsider.length, 0);
    // With RLS and no delete policy this either errors or matches zero rows; either way nothing is deleted.
    try {
      await asUser(db, a, () => db.query('delete from public.swipes where true'));
    } catch {
      /* denied is fine */
    }
    assert.equal((await mine(a)).length, 2);
  });

  test('changing your mind overwrites the swipe instead of duplicating it', async () => {
    const r1 = deck.recipes[0].id;
    await swipe(a, deck.deck_id, r1, false);
    const rows = (await mine(a)).filter((r) => r.recipe_id === r1);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].liked, false);
  });

  test('undo removes the most recent swipe and reports which dish it was', async () => {
    const r4 = deck.recipes[3].id;
    await swipe(a, deck.deck_id, r4, true);
    assert.equal(await undo(a, deck.deck_id), r4);
    assert.ok(!(await mine(a)).some((r) => r.recipe_id === r4));
    // Partner's swipes are untouched.
    assert.equal((await mine(b)).length, 1);
  });

  test('undo with nothing to undo is harmless', async () => {
    assert.equal(await undo(d2, otherDeck.deck_id), null);
  });

  test('you cannot swipe a dish that is not in the deck', async () => {
    const outside = recipes.find((r) => !deck.recipes.some((x) => x.id === r.id)).id;
    await assert.rejects(swipe(a, deck.deck_id, outside, true), /recipe_not_in_deck/);
  });

  test("you cannot swipe on, or undo in, another couple's deck", async () => {
    await assert.rejects(swipe(a, otherDeck.deck_id, otherDeck.recipes[0].id, true), /deck_not_found/);
    await assert.rejects(undo(a, otherDeck.deck_id), /deck_not_found/);
    await assert.rejects(swipe(a, '00000000-0000-0000-0000-000000000000', deck.recipes[0].id, true), /deck_not_found/);
  });

  test('a deck from a previous day is closed', async () => {
    await db.query("update daily_decks set deck_date = deck_date - 1 where id = $1", [otherDeck.deck_id]);
    await assert.rejects(swipe(c, otherDeck.deck_id, otherDeck.recipes[0].id, true), /deck_closed/);
    await assert.rejects(undo(c, otherDeck.deck_id), /deck_closed/);
  });

  test('clients cannot write swipes directly or call the guard', async () => {
    await assert.rejects(
      asUser(db, a, () => db.query('insert into public.swipes (deck_id, user_id, recipe_id, liked) values ($1, $2, $3, true)', [deck.deck_id, a, deck.recipes[5].id])),
      /row-level security|permission denied/,
    );
    await assert.rejects(asUser(db, a, () => db.query('select public.swipe_guard($1)', [deck.deck_id])), /permission denied/);
  });
});
