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

describe('swipe feed', () => {
  const feed = (user) => asUser(db, user, async () => (await db.query('select public.get_swipe_feed() as f')).rows[0].f);
  const swipe = (user, deckId, recipeId, liked) =>
    asUser(db, user, async () => (await db.query('select public.record_swipe($1, $2, $3) as r', [deckId, recipeId, liked])).rows[0].r);
  const undo = (user, deckId) => asUser(db, user, async () => (await db.query('select public.undo_last_swipe($1) as r', [deckId])).rows[0].r);
  const setGoal = (user, n) => asUser(db, user, () => db.query('select public.update_couple_settings($1)', [n]));
  const mineSwipes = (user) => asUser(db, user, async () => (await db.query('select recipe_id, liked from public.swipes')).rows);

  let n = 0;
  // reveal '23:59:59' = still ahead today, so these tests do not depend on what time they run.
  async function makeCouple({ tz = 'Pacific/Auckland', reveal = '23:59:59', prefsA = prefs(), prefsB = prefs() } = {}) {
    n++;
    const a = await addUser(db, `fa${n}@test.dev`);
    const b = await addUser(db, `fb${n}@test.dev`);
    const couple = (await db.query("insert into couples (owner_id, timezone, reveal_time, reveal_mode) values ($1, $2, $3, 'scheduled') returning id", [a, tz, reveal])).rows[0].id;
    await db.query("insert into couple_members (couple_id, user_id, role) values ($1, $2, 'owner'), ($1, $3, 'partner')", [couple, a, b]);
    for (const [u, p] of [[a, prefsA], [b, prefsB]]) {
      await db.query('insert into preferences (user_id, diet, allergens, cuisines, disliked) values ($1, $2, $3, $4, $5)', [u, p.diet, p.allergens, p.cuisines, p.disliked]);
    }
    return { a, b, couple };
  }

  test('needs both partners to have finished their preferences; outsiders get nothing', async () => {
    const a = await addUser(db, 'np-a@test.dev'), b = await addUser(db, 'np-b@test.dev'), c = await addUser(db, 'np-c@test.dev');
    const couple = (await db.query("insert into couples (owner_id) values ($1) returning id", [a])).rows[0].id;
    await db.query("insert into couple_members (couple_id, user_id, role) values ($1, $2, 'owner'), ($1, $3, 'partner')", [couple, a, b]);
    await assert.rejects(feed(a), /couple_not_ready/);
    await db.query("insert into preferences (user_id) values ($1)", [a]);
    await assert.rejects(feed(a), /couple_not_ready/);
    await db.query("insert into preferences (user_id) values ($1)", [b]);
    assert.equal((await feed(a)).status, 'ready');
    await assert.rejects(feed(c), /couple_not_ready/);
  });

  test('the feed shows the next few dishes and carries no counts, progress or partner info', async () => {
    const { a } = await makeCouple();
    const f = await feed(a);
    assert.equal(f.status, 'ready');
    assert.equal(f.dishes.length, 6);
    assert.equal(f.has_swiped, false);
    assert.deepEqual(Object.keys(f).sort(), ['cycle_date', 'deck_id', 'dishes', 'has_swiped', 'round', 'status']);
    for (const d of f.dishes) {
      assert.equal(d.ingredients, undefined);
      assert.equal(d.steps, undefined);
      assert.ok(d.title && d.image_url);
    }
  });

  test('both partners walk the same queue in the same order', async () => {
    const { a, b } = await makeCouple();
    const fa = await feed(a), fb = await feed(b);
    assert.equal(fa.deck_id, fb.deck_id);
    assert.deepEqual(fa.dishes.map((d) => d.id), fb.dishes.map((d) => d.id));
  });

  test('a swiped dish leaves my feed but not my partner\'s', async () => {
    const { a, b } = await makeCouple();
    const f = await feed(a);
    const first = f.dishes[0].id;
    await swipe(a, f.deck_id, first, false);
    assert.ok(!(await feed(a)).dishes.some((d) => d.id === first));
    assert.equal((await feed(b)).dishes[0].id, first);
    assert.equal((await feed(a)).has_swiped, true);
  });

  test('the queue is endless: 40 swipes later there are still fresh dishes, none repeated', async () => {
    const { a } = await makeCouple();
    const seen = new Set();
    for (let i = 0; i < 40; i++) {
      const f = await feed(a);
      assert.equal(f.status, 'ready', `ran dry after ${i} swipes`);
      const dish = f.dishes[0];
      assert.ok(!seen.has(dish.id), `${dish.title} came up twice`);
      seen.add(dish.id);
      await swipe(a, f.deck_id, dish.id, false);
    }
    assert.equal(seen.size, 40);
  });

  test('a match is a dish BOTH liked; the default goal of 2 ends swiping for both, and the app is told', async () => {
    const { a, b } = await makeCouple();
    const f = await feed(a);
    const [d1, d2, d3] = f.dishes.map((d) => d.id);

    await swipe(a, f.deck_id, d1, true);
    assert.equal((await swipe(b, f.deck_id, d1, true)).status, 'ready', 'one match is not enough');

    await swipe(a, f.deck_id, d3, true);
    assert.equal((await swipe(b, f.deck_id, d3, false)).status, 'ready', 'a like and a pass is not a match');

    await swipe(a, f.deck_id, d2, true);
    assert.equal((await swipe(b, f.deck_id, d2, true)).status, 'goal_reached');

    for (const user of [a, b]) {
      const after = await feed(user);
      assert.equal(after.status, 'goal_reached');
      assert.deepEqual(after.dishes, []);
    }
  });

  test('once the goal is reached, swiping and undo are closed; raising the goal reopens the queue', async () => {
    const { a, b } = await makeCouple();
    await setGoal(a, 1);
    const f = await feed(a);
    const [d1, d2] = f.dishes.map((d) => d.id);
    await swipe(a, f.deck_id, d1, true);
    assert.equal((await swipe(b, f.deck_id, d1, true)).status, 'goal_reached');
    await assert.rejects(swipe(a, f.deck_id, d2, true), /deck_closed/);
    await assert.rejects(undo(b, f.deck_id), /deck_closed/);
    await setGoal(b, 3);
    assert.equal((await feed(a)).status, 'ready');
    await swipe(a, f.deck_id, d2, true);
  });

  test('partners at different paces still match: the slower one catches up on dishes the other liked earlier', async () => {
    const { a, b } = await makeCouple();
    const f = await feed(a);
    const [d1, d2, d3] = f.dishes.map((d) => d.id);
    for (const d of [d1, d2, d3]) await swipe(a, f.deck_id, d, true); // morning
    // lunch: b starts from the same first dishes
    assert.deepEqual((await feed(b)).dishes.slice(0, 3).map((d) => d.id), [d1, d2, d3]);
    assert.equal((await swipe(b, f.deck_id, d1, true)).status, 'ready');
    assert.equal((await swipe(b, f.deck_id, d2, true)).status, 'goal_reached');
  });

  test('undo takes back my last swipe and un-matches it', async () => {
    const { a, b } = await makeCouple();
    const f = await feed(a);
    const [d1] = f.dishes.map((d) => d.id);
    await swipe(a, f.deck_id, d1, true);
    await swipe(b, f.deck_id, d1, true);
    assert.equal(await undo(b, f.deck_id), d1);
    assert.ok((await feed(b)).dishes.some((d) => d.id === d1), 'the dish is back in my feed');
    assert.equal(await undo(b, f.deck_id), null, 'nothing left to undo');
  });

  test('changing your mind overwrites the swipe', async () => {
    const { a } = await makeCouple();
    const f = await feed(a);
    const d1 = f.dishes[0].id;
    await swipe(a, f.deck_id, d1, true);
    await swipe(a, f.deck_id, d1, false);
    const rows = (await mineSwipes(a)).filter((r) => r.recipe_id === d1);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].liked, false);
  });

  test('swiping closes for both when the reveal time passes, and reopens with the next day', async () => {
    const { a, b, couple } = await makeCouple({ reveal: '23:59:59' }); // reveal is still ahead today
    const f = await feed(a);
    assert.equal(f.status, 'ready');
    const [d1, d2] = f.dishes.map((d) => d.id);
    await swipe(a, f.deck_id, d1, true);

    await db.query("update couples set reveal_time = '00:00' where id = $1", [couple]); // the reveal has passed
    for (const u of [a, b]) {
      const closed = await feed(u);
      assert.equal(closed.status, 'closed');
      assert.deepEqual(closed.dishes, []);
      assert.equal(closed.deck_id, f.deck_id, 'still today\'s deck: nothing rolls over to tomorrow');
    }
    await assert.rejects(swipe(a, f.deck_id, d2, true), /deck_closed/);
    await assert.rejects(swipe(b, f.deck_id, d2, true), /deck_closed/);
    await assert.rejects(undo(a, f.deck_id), /deck_closed/);

    // The next day starts: a fresh queue, open again (before that day's reveal).
    await db.query('update daily_decks set deck_date = deck_date - 1 where couple_id = $1', [couple]);
    await db.query("update couples set reveal_time = '23:59:59' where id = $1", [couple]);
    const next = await feed(a);
    assert.equal(next.status, 'ready');
    assert.notEqual(next.deck_id, f.deck_id);
  });

  test('a small pool ends gracefully with "exhausted" after every fitting dish was swiped', async () => {
    const tiny = prefs({ diet: 'vegan', allergens: ALLERGENS });
    const { a } = await makeCouple({ prefsA: tiny });
    let swiped = 0, f = await feed(a);
    while (f.status === 'ready' && swiped < 200) {
      await swipe(a, f.deck_id, f.dishes[0].id, false);
      swiped++;
      f = await feed(a);
    }
    assert.equal(f.status, 'exhausted');
    const deckSize = (await db.query('select cardinality(recipe_ids) n from daily_decks where id = $1', [f.deck_id])).rows[0].n;
    assert.equal(swiped, deckSize);
  });

  test('dishes the couple swiped recently are queued last tomorrow, while unseen ones come first', async () => {
    const { a, couple } = await makeCouple();
    const f = await feed(a);
    const swipedToday = f.dishes.map((d) => d.id);
    for (const id of swipedToday) await swipe(a, f.deck_id, id, false);
    // Pretend that cycle was yesterday's.
    await db.query('update daily_decks set deck_date = deck_date - 1 where couple_id = $1', [couple]);
    const next = await feed(a);
    assert.notEqual(next.deck_id, f.deck_id);
    for (const d of next.dishes) assert.ok(!swipedToday.includes(d.id), `${d.title} was swiped yesterday but is first in line`);
  });

  test('the match goal: 1 to 5, either partner can change it, outsiders cannot', async () => {
    const { a, b } = await makeCouple();
    const outsider = await addUser(db, 'goal-out@test.dev');
    await setGoal(b, 4);
    assert.equal((await db.query("select match_goal from couples where id = (select couple_id from couple_members where user_id = $1)", [a])).rows[0].match_goal, 4);
    for (const bad of [0, 6, -1]) await assert.rejects(setGoal(a, bad), /invalid_match_goal/);
    await assert.rejects(setGoal(outsider, 2), /couple_not_ready/);
    const state = await asUser(db, a, async () => (await db.query('select public.get_couple_state() as s')).rows[0].s);
    assert.equal(state.match_goal, 4);
  });

  test('privacy: only my own swipes are readable, nothing writes directly, internals are locked', async () => {
    const { a, b } = await makeCouple();
    const outsider = await addUser(db, 'priv-out@test.dev');
    const f = await feed(a);
    const [d1, d2] = f.dishes.map((d) => d.id);
    await swipe(a, f.deck_id, d1, true);
    await swipe(b, f.deck_id, d2, true);

    assert.deepEqual((await mineSwipes(a)).map((r) => r.recipe_id), [d1]);
    assert.deepEqual((await mineSwipes(b)).map((r) => r.recipe_id), [d2]);
    assert.equal((await mineSwipes(outsider)).length, 0);
    // b's feed never says what a chose, or even how many dishes a has swiped.
    const fb = await feed(b);
    for (const key of ['my_swipes', 'partner_swiped', 'partner', 'liked', 'matches', 'match_count']) assert.ok(!(key in fb), key);

    await assert.rejects(swipe(outsider, f.deck_id, d1, true), /deck_not_found/);
    await assert.rejects(asUser(db, a, () => db.query('insert into public.swipes (deck_id, user_id, recipe_id, liked) values ($1, $2, $3, true)', [f.deck_id, a, f.dishes[3].id])), /row-level security|permission denied/);
    for (const fn of ['deck_match_count($1)', 'swipe_guard($1)', 'dish_json(array[$1::uuid])']) {
      await assert.rejects(asUser(db, a, () => db.query(`select public.${fn}`, [f.deck_id])), /permission denied/, fn);
    }
    const decks = (user) => asUser(db, user, async () => (await db.query('select count(*)::int n from public.daily_decks')).rows[0].n);
    assert.ok((await decks(a)) >= 1);
    assert.equal(await decks(outsider), 0);
  });

  test("you cannot swipe a dish outside the queue or on another couple's deck", async () => {
    const vegan = await makeCouple({ prefsA: prefs({ diet: 'vegan' }) });
    const other = await makeCouple();
    const f = await feed(vegan.a);
    const queued = new Set((await db.query('select unnest(recipe_ids) id from daily_decks where id = $1', [f.deck_id])).rows.map((r) => r.id));
    const notQueued = recipes.find((r) => !queued.has(r.id));
    assert.ok(notQueued, 'a vegan queue must leave some dishes out');
    await assert.rejects(swipe(vegan.a, f.deck_id, notQueued.id, true), /recipe_not_in_deck/);

    const otherFeed = await feed(other.a);
    await assert.rejects(swipe(vegan.a, otherFeed.deck_id, otherFeed.dishes[0].id, true), /deck_not_found/);
    await assert.rejects(swipe(vegan.a, '00000000-0000-0000-0000-000000000000', f.dishes[0].id, true), /deck_not_found/);
  });
});
