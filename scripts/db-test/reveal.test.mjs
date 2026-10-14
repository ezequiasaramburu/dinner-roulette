import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';

import { addUser, asUser, createDb, prefs } from './harness.mjs';

let db;
before(async () => {
  db = await createDb();
});

const call = (user, sql, args = []) => asUser(db, user, async () => (await db.query(sql, args)).rows[0]?.r);
const feed = (u) => call(u, 'select public.get_swipe_feed() as r');
const reveal = (u) => call(u, 'select public.get_reveal() as r');
const swipe = (u, deck, recipe, liked) => call(u, 'select public.record_swipe($1, $2, $3) as r', [deck, recipe, liked]);
const seen = (u, deck) => call(u, 'select public.mark_reveal_seen($1) as r', [deck]);

let n = 0;
// reveal '23:59:59' = still ahead today (pending); '00:00' = already passed today (revealed).
async function makeCouple({ reveal = '23:59:59', goal = 2, mode = 'scheduled' } = {}) {
  n++;
  const a = await addUser(db, `ra${n}@test.dev`);
  const b = await addUser(db, `rb${n}@test.dev`);
  const couple = (
    await db.query('insert into couples (owner_id, timezone, reveal_time, match_goal, reveal_mode) values ($1, $2, $3, $4, $5) returning id', [a, 'Pacific/Auckland', reveal, goal, mode])
  ).rows[0].id;
  await db.query("insert into couple_members (couple_id, user_id, role) values ($1, $2, 'owner'), ($1, $3, 'partner')", [couple, a, b]);
  for (const u of [a, b]) {
    const p = prefs();
    await db.query('insert into preferences (user_id, diet, allergens, cuisines, disliked) values ($1, $2, $3, $4, $5)', [u, p.diet, p.allergens, p.cuisines, p.disliked]);
  }
  return { a, b, couple };
}
const openReveal = (couple) => db.query("update couples set reveal_time = '00:00' where id = $1", [couple]);

describe('reveal', () => {
  test('before the reveal time nothing is given away, not even the status of the swipes', async () => {
    const { a, b } = await makeCouple();
    const f = await feed(a);
    await swipe(a, f.deck_id, f.dishes[0].id, true);
    await swipe(b, f.deck_id, f.dishes[0].id, true);
    for (const u of [a, b]) {
      const r = await reveal(u);
      assert.deepEqual(Object.keys(r).sort(), ['reveal_at', 'status']);
      assert.equal(r.status, 'pending');
    }
  });

  test('at the reveal time the shared likes come out with the full recipe, in queue order', async () => {
    const { a, b, couple } = await makeCouple({ goal: 3 });
    const f = await feed(a);
    const [d1, d2, d3, d4] = f.dishes.map((d) => d.id);
    await swipe(a, f.deck_id, d1, true);
    await swipe(b, f.deck_id, d1, true);
    await swipe(a, f.deck_id, d2, true); // only one of us
    await swipe(b, f.deck_id, d2, false);
    await swipe(b, f.deck_id, d4, true);
    await swipe(a, f.deck_id, d4, true);
    await openReveal(couple);

    for (const u of [a, b]) {
      const r = await reveal(u);
      assert.equal(r.status, 'revealed');
      assert.equal(r.kind, 'match');
      assert.deepEqual(r.dishes.map((d) => d.id), [d1, d4]);
      assert.ok(r.dishes[0].ingredients.length > 0 && r.dishes[0].steps.length > 0, 'full recipe');
      assert.ok(!r.dishes.some((d) => d.id === d3));
    }
  });

  test('both partners see the same reveal, and it is frozen: swipes after the reveal belong to tomorrow', async () => {
    const { a, b, couple } = await makeCouple();
    const f = await feed(a);
    await swipe(a, f.deck_id, f.dishes[0].id, true);
    await swipe(b, f.deck_id, f.dishes[0].id, true);
    await openReveal(couple);
    const first = await reveal(a);
    assert.deepEqual((await reveal(b)).dishes, first.dishes);

    const tomorrow = await feed(a);
    assert.equal(tomorrow.for_today, false);
    await swipe(a, tomorrow.deck_id, tomorrow.dishes[0].id, true);
    await swipe(b, tomorrow.deck_id, tomorrow.dishes[0].id, true);
    assert.deepEqual((await reveal(a)).dishes, first.dishes);
    await assert.rejects(swipe(a, f.deck_id, f.dishes[1].id, true), /deck_closed/);
  });

  test('no shared like: the closest dishes (liked by one of you) are offered, up to the match goal', async () => {
    const { a, b, couple } = await makeCouple({ goal: 2 });
    const f = await feed(a);
    const [d1, d2, d3] = f.dishes.map((d) => d.id);
    await swipe(a, f.deck_id, d1, true);
    await swipe(b, f.deck_id, d1, false);
    await swipe(b, f.deck_id, d2, true);
    await swipe(a, f.deck_id, d3, true);
    await openReveal(couple);
    const r = await reveal(a);
    assert.equal(r.kind, 'closest');
    assert.deepEqual(r.dishes.map((d) => d.id), [d1, d2]);
  });

  test('nobody liked anything (or swiped at all): the best fit from the queue is picked', async () => {
    const { a, b, couple } = await makeCouple();
    const f = await feed(a);
    await swipe(a, f.deck_id, f.dishes[0].id, false);
    await openReveal(couple);
    const r = await reveal(b);
    assert.equal(r.kind, 'surprise');
    assert.equal(r.dishes.length, 1);
    const top = (await db.query('select recipe_ids[1] id from daily_decks where id = $1', [f.deck_id])).rows[0].id;
    assert.equal(r.dishes[0].id, top);

    const quiet = await makeCouple({ reveal: '00:00' }); // nobody even opened the app
    const q = await reveal(quiet.a);
    assert.equal(q.status, 'revealed');
    assert.equal(q.kind, 'surprise');
  });

  test('"seen" is per person and only recorded once the reveal has happened', async () => {
    const { a, b, couple } = await makeCouple();
    const f = await feed(a);
    await seen(a, f.deck_id); // too early: ignored
    await openReveal(couple);
    assert.equal((await reveal(a)).seen, false);
    await seen(a, f.deck_id);
    await seen(a, f.deck_id); // idempotent
    assert.equal((await reveal(a)).seen, true);
    assert.equal((await reveal(b)).seen, false);
  });

  test('strangers cannot read a reveal or mark it seen', async () => {
    const { a, couple } = await makeCouple();
    const f = await feed(a);
    await openReveal(couple);
    const outsider = await addUser(db, 'reveal-out@test.dev');
    await assert.rejects(reveal(outsider), /couple_not_ready/);
    await assert.rejects(seen(outsider, f.deck_id), /deck_not_found/);
    const views = await asUser(db, outsider, () => db.query('select * from public.reveal_views'));
    assert.equal(views.rows.length, 0);
  });

  test('the helper functions are not callable through the API', async () => {
    const { a, couple } = await makeCouple();
    await assert.rejects(asUser(db, a, () => db.query('select public.ensure_deck($1, current_date)', [couple])), /permission denied/);
    await assert.rejects(asUser(db, a, () => db.query('select public.recipe_json(array[]::uuid[])')), /permission denied/);
  });
});

describe('instant reveal', () => {
  const settings = (u, ...args) => call(u, 'select public.update_couple_settings($1, $2, $3) as r', args);

  test('the reveal opens the moment the goal is reached, for both partners, whatever the reveal time says', async () => {
    const { a, b } = await makeCouple({ mode: 'instant', reveal: '00:00' }); // a set time that passed long ago
    const f = await feed(a);
    assert.equal(f.for_today, true, 'swipes count toward today');
    const [d1, d2, d3] = f.dishes.map((d) => d.id);
    await swipe(a, f.deck_id, d1, true);
    await swipe(b, f.deck_id, d1, true);
    assert.deepEqual(await reveal(a), { status: 'pending', reveal_at: null }, 'one match is not enough');
    await swipe(a, f.deck_id, d2, true);
    assert.equal((await swipe(b, f.deck_id, d2, true)).status, 'goal_reached');
    for (const u of [a, b]) {
      const r = await reveal(u);
      assert.equal(r.status, 'revealed');
      assert.equal(r.kind, 'match');
      assert.deepEqual(r.dishes.map((d) => d.id), [d1, d2]);
      assert.ok(r.dishes[0].ingredients.length > 0);
    }
    assert.ok(!(await reveal(a)).dishes.some((d) => d.id === d3));
  });

  test('once revealed it sticks: raising the goal does not take it back or reopen swiping today', async () => {
    const { a, b } = await makeCouple({ mode: 'instant', goal: 1 });
    const f = await feed(a);
    const [d1, d2] = f.dishes.map((d) => d.id);
    await swipe(a, f.deck_id, d1, true);
    await swipe(b, f.deck_id, d1, true);
    await settings(a, 5, null, null);
    assert.equal((await reveal(b)).status, 'revealed');
    assert.equal((await feed(a)).status, 'goal_reached');
    await assert.rejects(swipe(a, f.deck_id, d2, true), /deck_closed/);
    await seen(a, f.deck_id);
    assert.equal((await reveal(a)).seen, true);
  });

  test('lowering the goal below the matches already made reveals right away', async () => {
    const { a, b } = await makeCouple({ mode: 'instant', goal: 3 });
    const f = await feed(a);
    const d1 = f.dishes[0].id;
    await swipe(a, f.deck_id, d1, true);
    await swipe(b, f.deck_id, d1, true);
    assert.equal((await reveal(a)).status, 'pending');
    await settings(b, 1, null, null);
    assert.equal((await reveal(a)).status, 'revealed');
  });

  test('instant mode has no fallback: a partial day gives nothing, and "seen" waits for the reveal', async () => {
    const { a, b } = await makeCouple({ mode: 'instant' });
    const f = await feed(a);
    await swipe(a, f.deck_id, f.dishes[0].id, true);
    assert.equal((await reveal(b)).status, 'pending');
    await seen(b, f.deck_id);
    assert.equal((await db.query('select count(*)::int n from reveal_views where deck_id = $1', [f.deck_id])).rows[0].n, 0);
  });
});

describe('couple settings', () => {
  const settings = (u, ...args) => call(u, 'select public.update_couple_settings($1, $2, $3) as r', args);
  const state = (u) => call(u, 'select public.get_couple_state() as r');

  test('either partner can change the mode, reveal time and goal; omitted settings stay as they were', async () => {
    const { a, b } = await makeCouple();
    assert.equal((await state(a)).reveal_mode, 'scheduled');
    await settings(b, null, 'instant', null);
    let st = await state(a);
    assert.deepEqual([st.reveal_mode, st.reveal_time, st.match_goal], ['instant', '23:59', 2]);
    await settings(a, 4, 'scheduled', '18:30');
    st = await state(b);
    assert.deepEqual([st.reveal_mode, st.reveal_time, st.match_goal], ['scheduled', '18:30', 4]);
  });

  test('bad values and outsiders are refused', async () => {
    const { a } = await makeCouple();
    const outsider = await addUser(db, 'settings-out@test.dev');
    await assert.rejects(settings(a, null, 'whenever', null), /invalid_reveal_mode/);
    await assert.rejects(settings(a, 9, null, null), /invalid_match_goal/);
    await assert.rejects(settings(outsider, 2, null, null), /couple_not_ready/);
  });
});
