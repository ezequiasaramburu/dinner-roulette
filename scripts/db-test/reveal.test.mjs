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

// Passes on enough dishes for this person to have swiped half of the ones they can swipe in this round: the point
// where "Reveal with what we have" is offered (when the partner is there too).
async function half(user, deck) {
  const { rows } = await db.query(
    `select
       (select count(*) from swipes s join daily_decks d on d.id = s.deck_id
        where d.id = $1 and s.user_id = $2 and s.swiped_at >= coalesce(d.round_started_at, '-infinity'))::int as done,
       (select count(*) from daily_decks d, unnest(d.recipe_ids) rid
        where d.id = $1 and rid <> all (d.first_reveal_ids)
          and not exists (select 1 from swipes s where s.deck_id = d.id and s.user_id = $2 and s.recipe_id = rid))::int as waiting`,
    [deck, user],
  );
  const k = Math.max(1, Math.ceil((rows[0].waiting - rows[0].done) / 2));
  await db.query(
    `insert into swipes (deck_id, user_id, recipe_id, liked)
     select d.id, $2, t.rid, false from daily_decks d, unnest(d.recipe_ids) with ordinality t(rid, ord)
     where d.id = $1 and t.rid <> all (d.first_reveal_ids)
       and not exists (select 1 from swipes s where s.deck_id = d.id and s.user_id = $2 and s.recipe_id = t.rid)
     order by t.ord limit $3`,
    [deck, user, k],
  );
}

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

  test('both partners see the same reveal, and it is frozen: swiping is closed once it has happened', async () => {
    const { a, b, couple } = await makeCouple();
    const f = await feed(a);
    await swipe(a, f.deck_id, f.dishes[0].id, true);
    await swipe(b, f.deck_id, f.dishes[0].id, true);
    await openReveal(couple);
    const first = await reveal(a);
    assert.deepEqual((await reveal(b)).dishes, first.dishes);

    for (const u of [a, b]) {
      const after = await feed(u);
      assert.equal(after.status, 'closed');
      assert.equal(after.deck_id, f.deck_id);
      await assert.rejects(swipe(u, f.deck_id, f.dishes[1].id, true), /deck_closed/);
    }
    assert.deepEqual((await reveal(a)).dishes, first.dishes);
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

  const revealNow = (u) => call(u, 'select public.reveal_now() as r');
  const swipeEverything = (user, deck, liked = false) =>
    db.query(
      'insert into swipes (deck_id, user_id, recipe_id, liked) select $1, $2, rid, $3 from daily_decks d, unnest(d.recipe_ids) rid where d.id = $1 on conflict do nothing',
      [deck, user, liked],
    );

  test('a partial day stays pending, and "seen" waits for the reveal', async () => {
    const { a, b } = await makeCouple({ mode: 'instant' });
    const f = await feed(a);
    await swipe(a, f.deck_id, f.dishes[0].id, true);
    assert.equal((await reveal(b)).status, 'pending');
    await seen(b, f.deck_id);
    assert.equal((await db.query('select count(*)::int n from reveal_views where deck_id = $1', [f.deck_id])).rows[0].n, 0);
  });

  test('"Reveal with what we have" opens it for both, with the closest dishes', async () => {
    const { a, b } = await makeCouple({ mode: 'instant' });
    const f = await feed(a);
    const [d1, d2] = f.dishes.map((d) => d.id);
    await swipe(a, f.deck_id, d1, true);
    await swipe(b, f.deck_id, d2, false);
    await half(a, f.deck_id);
    await half(b, f.deck_id);
    await revealNow(b);
    for (const u of [a, b]) {
      const r = await reveal(u);
      assert.equal(r.status, 'revealed');
      assert.equal(r.kind, 'closest');
      assert.deepEqual(r.dishes.map((d) => d.id), [d1]);
    }
    assert.equal((await feed(a)).status, 'goal_reached');
  });

  test('with nothing liked it picks the best fit from the queue', async () => {
    const { a, b } = await makeCouple({ mode: 'instant' });
    const f = await feed(a);
    await swipe(a, f.deck_id, f.dishes[0].id, false);
    await half(a, f.deck_id);
    await half(b, f.deck_id);
    await revealNow(a);
    const r = await reveal(b);
    assert.equal(r.kind, 'surprise');
    assert.equal(r.dishes.length, 1);
  });

  test('it needs at least one swipe, instant mode, and does nothing twice', async () => {
    const { a, b } = await makeCouple({ mode: 'instant' });
    await assert.rejects(revealNow(a), /nothing_swiped/);
    const f = await feed(a);
    await swipe(a, f.deck_id, f.dishes[0].id, true);
    await half(a, f.deck_id);
    await half(b, f.deck_id);
    await revealNow(a);
    const first = (await reveal(a)).reveal_at;
    await revealNow(b).catch(() => {});
    assert.equal((await reveal(a)).reveal_at, first);
    const sched = await makeCouple();
    await assert.rejects(revealNow(sched.a), /not_instant/);
  });

  test('the early reveal is offered only when BOTH have swiped half of what they can swipe', async () => {
    const { a, b } = await makeCouple({ mode: 'instant' });
    const f = await feed(a);
    await swipe(a, f.deck_id, f.dishes[0].id, true);
    assert.equal((await feed(a)).can_reveal_now, false, 'one swipe is nowhere near half');
    await assert.rejects(revealNow(a), /swipe_more/);

    await half(a, f.deck_id);
    for (const u of [a, b]) assert.equal((await feed(u)).can_reveal_now, false, 'one of us at half is not enough');
    await assert.rejects(revealNow(a), /swipe_more/);

    await swipe(b, f.deck_id, f.dishes[1].id, true);
    await half(b, f.deck_id);
    for (const u of [a, b]) assert.equal((await feed(u)).can_reveal_now, true);
    await revealNow(a);
    assert.equal((await reveal(b)).status, 'revealed');
  });

  test('a tiny deck is not stuck: half of what exists is what counts', async () => {
    const { a, b } = await makeCouple({ mode: 'instant' });
    const f = await feed(a);
    await db.query('update daily_decks set recipe_ids = recipe_ids[1:3] where id = $1', [f.deck_id]);
    await swipe(a, f.deck_id, f.dishes[0].id, true);
    await swipe(a, f.deck_id, f.dishes[1].id, false);
    await swipe(b, f.deck_id, f.dishes[2].id, true);
    await swipe(b, f.deck_id, f.dishes[0].id, false);
    for (const u of [a, b]) assert.equal((await feed(u)).can_reveal_now, true);
  });

  test('a match before half never needs the offer', async () => {
    const { a, b } = await makeCouple({ mode: 'instant', goal: 1 });
    const f = await feed(a);
    await swipe(a, f.deck_id, f.dishes[0].id, true);
    assert.equal((await swipe(b, f.deck_id, f.dishes[0].id, true)).status, 'goal_reached');
    assert.equal((await reveal(a)).kind, 'match');
  });

  test('when both have been through every dish, the reveal opens by itself', async () => {
    const { a, b } = await makeCouple({ mode: 'instant', goal: 5 });
    const f = await feed(a);
    await swipeEverything(a, f.deck_id, false);
    assert.equal((await reveal(b)).status, 'pending', 'one of us finishing is not enough');
    await db.query('update swipes set liked = true where deck_id = $1 and user_id = $2 and recipe_id = $3', [f.deck_id, a, f.dishes[0].id]);
    await swipeEverything(b, f.deck_id, false);
    const r = await reveal(a);
    assert.equal(r.status, 'revealed');
    assert.equal(r.kind, 'closest');
  });
});

describe('swipe again', () => {
  const revealNow = (u) => call(u, 'select public.reveal_now() as r');
  const again = (u) => call(u, 'select public.swipe_again() as r');

  // Nobody matches: a likes d1, b passes d2, then the dinner is revealed with the closest dish.
  async function noMatch(opts = {}) {
    const c = await makeCouple({ mode: 'instant', goal: 1, ...opts });
    const f = await feed(c.a);
    const [d1, d2] = f.dishes.map((d) => d.id);
    await swipe(c.a, f.deck_id, d1, true);
    await swipe(c.b, f.deck_id, d2, false);
    if (opts.mode === 'scheduled') await openReveal(c.couple);
    else {
      await half(c.a, f.deck_id);
      await half(c.b, f.deck_id);
      await revealNow(c.b);
    }
    return { ...c, deck: f.deck_id, d1, d2 };
  }

  test('after a reveal where nobody matched, a new set from the rest of the queue is offered, once', async () => {
    const { a, b, deck, d1 } = await noMatch();
    const first = await reveal(a);
    assert.deepEqual([first.kind, first.round, first.can_swipe_again], ['closest', 1, true]);

    await again(b);
    for (const u of [a, b]) {
      assert.equal((await reveal(u)).status, 'pending', 'the first result is gone for both');
      const f = await feed(u);
      assert.equal(f.status, 'ready');
      assert.equal(f.round, 2);
      assert.ok(!f.dishes.some((d) => d.id === d1), 'what was just shown is not offered again');
    }

    const f = await feed(a);
    assert.equal(f.has_swiped, false, 'round one swipes do not count in round two');
    await assert.rejects(revealNow(a), /nothing_swiped/);
    const d3 = f.dishes[0].id;
    await swipe(a, deck, d3, true);
    assert.equal((await feed(a)).has_swiped, true);
    assert.equal((await swipe(b, deck, d3, true)).status, 'goal_reached');
    const second = await reveal(a);
    assert.deepEqual([second.kind, second.round, second.can_swipe_again], ['match', 2, false]);
    assert.deepEqual(second.dishes.map((d) => d.id), [d3]);
    assert.equal(second.seen, false, 'the animation plays again');

    await assert.rejects(again(a), /swipe_again_used|already_matched/);
  });

  test('starting a second round leaves a notice for the partner only', async () => {
    const { a, b } = await noMatch();
    const notices = (u) => asUser(db, u, async () => (await db.query('select kind, from_name from public.notices')).rows);
    await db.query("update public.profiles set display_name = 'Quinn' where id = $1", [b]);
    await again(b);
    assert.deepEqual(await notices(b), []);
    assert.deepEqual(await notices(a), [{ kind: 'swipe_again_started', from_name: 'Quinn' }]);
  });

  test('in the second round the offer is half of the leftover dishes, not half of the first deck', async () => {
    const { a, b, deck } = await noMatch();
    await again(a);
    for (const u of [a, b]) assert.equal((await feed(u)).can_reveal_now, false, 'round two starts with nothing swiped');
    await half(a, deck);
    await half(b, deck);
    for (const u of [a, b]) assert.equal((await feed(u)).can_reveal_now, true);
    const swiped = (await db.query('select count(*)::int n from swipes where deck_id = $1 and user_id = $2 and swiped_at >= (select round_started_at from daily_decks where id = $1)', [deck, a])).rows[0].n;
    const total = (await db.query('select array_length(recipe_ids, 1) n from daily_decks where id = $1', [deck])).rows[0].n;
    assert.ok(swiped < total / 2, 'it asked for half of what was left, not half of the whole deck');
  });

  test('leftover notices are cleared: the one starting never sees one, the partner sees exactly one', async () => {
    const { a, b } = await noMatch();
    const notices = (u) => asUser(db, u, async () => (await db.query('select from_name from public.notices where kind = $1', ['swipe_again_started'])).rows);
    await db.query("insert into public.notices (recipient_id, kind, from_name) values ($1, 'swipe_again_started', 'Old'), ($2, 'swipe_again_started', 'Older')", [a, b]);
    await db.query("update public.profiles set display_name = 'Quinn' where id = $1", [b]);
    await again(b);
    assert.deepEqual(await notices(b), []);
    assert.deepEqual(await notices(a), [{ from_name: 'Quinn' }]);
  });

  test('a second round that still has no match gets the fallback ladder, not another round', async () => {
    const { a, b } = await noMatch();
    const first = await reveal(a);
    await again(a);
    const f = await feed(b);
    await swipe(b, f.deck_id, f.dishes[0].id, true);
    await assert.rejects(revealNow(a), /nothing_swiped/, 'a has not swiped in this round');
    await half(a, f.deck_id);
    await half(b, f.deck_id);
    await revealNow(b);
    const second = await reveal(b);
    assert.equal(second.kind, 'closest');
    assert.notDeepEqual(second.dishes.map((d) => d.id), first.dishes.map((d) => d.id));
    assert.equal(second.can_swipe_again, false);
    await assert.rejects(again(b), /swipe_again_used/);
  });

  test('it is refused when there is a match, before the reveal, and outside a couple', async () => {
    const m = await makeCouple({ mode: 'instant', goal: 1 });
    const f = await feed(m.a);
    await assert.rejects(again(m.a), /not_revealed/);
    await swipe(m.a, f.deck_id, f.dishes[0].id, true);
    await swipe(m.b, f.deck_id, f.dishes[0].id, true);
    assert.equal((await reveal(m.a)).can_swipe_again, false);
    await assert.rejects(again(m.a), /already_matched/);
    const outsider = await addUser(db, 'again-out@test.dev');
    await assert.rejects(again(outsider), /couple_not_ready/);
  });

  test('in scheduled mode swiping reopens after the reveal time, and the second round reveals as soon as they match', async () => {
    const { a, b, deck } = await noMatch({ mode: 'scheduled', goal: 1 });
    assert.equal((await feed(a)).status, 'closed');
    assert.equal((await reveal(a)).can_swipe_again, true);
    await again(a);
    const f = await feed(a);
    assert.equal(f.status, 'ready');
    assert.equal((await reveal(b)).status, 'pending');
    await swipe(a, deck, f.dishes[0].id, true);
    await swipe(b, deck, f.dishes[0].id, true);
    const r = await reveal(b);
    assert.deepEqual([r.status, r.kind, r.round], ['revealed', 'match', 2]);
    assert.equal((await feed(a)).status, 'goal_reached');
  });

  test('swiping again is only possible with something left to swipe', async () => {
    const { a, b, deck } = await noMatch();
    await db.query(
      'insert into swipes (deck_id, user_id, recipe_id, liked) select $1, u, rid, false from daily_decks d, unnest(d.recipe_ids) rid, unnest($2::uuid[]) u where d.id = $1 on conflict do nothing',
      [deck, [a, b]],
    );
    assert.equal((await reveal(a)).can_swipe_again, false);
    await assert.rejects(again(a), /nothing_left/);
  });

  // The whole queue swiped N days ago, then today's queue is built: how many of those dishes are back?
  async function overlapAfter(days, liked = false) {
    const { a, deck } = await makeCouple({ mode: 'instant' }).then(async (c) => ({ ...c, deck: (await feed(c.a)).deck_id }));
    await db.query(
      'insert into swipes (deck_id, user_id, recipe_id, liked) select $1, $2, rid, $3 from daily_decks d, unnest(d.recipe_ids) rid where d.id = $1',
      [deck, a, liked],
    );
    await db.query('update daily_decks set deck_date = deck_date - $2::int where id = $1', [deck, days]);
    const old = (await db.query('select recipe_ids from daily_decks where id = $1', [deck])).rows[0].recipe_ids;
    const today = (await feed(a)).deck_id;
    const fresh = (await db.query('select recipe_ids from daily_decks where id = $1', [today])).rows[0].recipe_ids;
    return fresh.filter((id) => old.includes(id)).length;
  }

  test('a dish passed on comes back after 3 days, not before', async () => {
    assert.equal(await overlapAfter(2), 0, 'a dish passed on 2 days ago is still held back');
    assert.ok((await overlapAfter(3)) > 0, 'a dish passed on 3 days ago can be served again');
  });

  test('a dish someone liked stays out for 7 days', async () => {
    assert.equal(await overlapAfter(6, true), 0, 'a dish liked 6 days ago is held back');
    assert.ok((await overlapAfter(7, true)) > 0, 'a dish liked 7 days ago can be served again');
  });
});

describe('access (trial and paid period)', () => {
  const state = (u) => call(u, 'select public.get_couple_state() as r');
  const expire = (couple, trial = "now() - interval '1 day'", paid = 'null') =>
    db.query(`update couples set trial_ends_at = ${trial}, paid_until = ${paid} where id = $1`, [couple]);

  test('the trial starts when the partner joins, not before, and a later partner does not restart it', async () => {
    const owner = await addUser(db, 'trial-owner@test.dev');
    const partner = await addUser(db, 'trial-partner@test.dev');
    const rpc = (u, sql, params) => asUser(db, u, () => db.query(sql, params));
    await rpc(owner, 'select public.create_couple($1)', ['UTC']);
    let st = await state(owner);
    assert.deepEqual([st.has_access, st.trial_ends_at, st.trial_days_left], [true, null, null], 'waiting for a partner: no clock yet');

    const { rows } = await rpc(owner, 'select public.create_invite() as code');
    await rpc(partner, 'select public.join_couple($1)', [rows[0].code]);
    st = await state(owner);
    const days = (new Date(st.trial_ends_at) - Date.now()) / 86_400_000;
    assert.ok(days > 6.9 && days <= 7, `about 7 days left, got ${days}`);
    assert.equal(st.trial_days_left, 7);
    assert.equal((await state(partner)).trial_days_left, 7);

    // The partner leaves and someone new joins: same end date.
    const first = st.trial_ends_at;
    await db.query('delete from couple_members where user_id = $1', [partner]);
    const third = await addUser(db, 'trial-third@test.dev');
    const again = await rpc(owner, 'select public.create_invite() as code');
    await rpc(third, 'select public.join_couple($1)', [again.rows[0].code]);
    assert.equal(new Date((await state(owner)).trial_ends_at).getTime(), new Date(first).getTime());
  });

  test('days left count down, and disappear once paid or over', async () => {
    const { a, couple } = await makeCouple({ mode: 'instant' });
    await db.query("update couples set trial_ends_at = now() + interval '36 hours' where id = $1", [couple]);
    assert.equal((await state(a)).trial_days_left, 2);
    await db.query("update couples set trial_ends_at = now() + interval '2 hours' where id = $1", [couple]);
    assert.equal((await state(a)).trial_days_left, 1);
    await db.query("update couples set paid_until = now() + interval '30 days' where id = $1", [couple]);
    assert.equal((await state(a)).trial_days_left, null, 'paying ends the trial banner');
    await db.query("update couples set paid_until = null, trial_ends_at = now() - interval '1 hour' where id = $1", [couple]);
    assert.equal((await state(a)).trial_days_left, null, 'nothing left to count');
  });

  test('when the trial is over, swiping and reveals are refused for both partners; nothing is deleted', async () => {
    const { a, b, couple } = await makeCouple({ mode: 'instant' });
    const f = await feed(a);
    await swipe(a, f.deck_id, f.dishes[0].id, true);
    await expire(couple);
    for (const u of [a, b]) {
      assert.equal((await state(u)).has_access, false);
      await assert.rejects(feed(u), /subscription_required/);
      await assert.rejects(call(u, 'select public.reveal_now() as r'), /subscription_required/);
    }
    assert.equal((await db.query('select count(*)::int n from swipes where deck_id = $1', [f.deck_id])).rows[0].n, 1, 'the swipe is kept');
    assert.equal((await db.query('select count(*)::int n from preferences where user_id in ($1, $2)', [a, b])).rows[0].n, 2, 'preferences are kept');
  });

  test('a paid period restores access, and an expired one does not', async () => {
    const { a, couple } = await makeCouple({ mode: 'instant' });
    await expire(couple, "now() - interval '1 day'", "now() + interval '30 days'");
    assert.equal((await state(a)).has_access, true);
    assert.equal((await feed(a)).status, 'ready');
    await expire(couple, "now() - interval '1 day'", "now() - interval '1 hour'");
    assert.equal((await state(a)).has_access, false);
  });

  test('a subscription event unlocks the couple, only newer events win, and only the server may send them', async () => {
    const { a, b, couple } = await makeCouple({ mode: 'instant' });
    await expire(couple);
    const apply = (until, at, product = 'yearly') =>
      db.query('select public.apply_subscription_event($1, $2, $3, $4)', [a, product, until, at]);
    await apply("2099-01-01T00:00:00Z", "2026-10-01T00:00:00Z");
    for (const u of [a, b]) assert.equal((await state(u)).has_access, true, 'the partner is covered too');

    await apply("2020-01-01T00:00:00Z", "2026-09-01T00:00:00Z");
    assert.equal((await state(a)).has_access, true, 'an older event for the same product is ignored');
    await apply("2020-01-01T00:00:00Z", "2026-11-01T00:00:00Z");
    assert.equal((await state(a)).has_access, false, 'a newer expiry locks it again');
    await apply('infinity', "2026-12-01T00:00:00Z");
    assert.equal((await state(a)).has_access, true, 'a purchase without an end never ends');

    const stranger = await addUser(db, 'stranger-pay@test.dev');
    await db.query('select public.apply_subscription_event($1, $2, $3, $4)', [stranger, 'yearly', 'infinity', "2027-01-01T00:00:00Z"]);
    await assert.rejects(asUser(db, a, () => db.query('select public.apply_subscription_event($1, $2, $3, $4)', [a, 'yearly', 'infinity', "2027-01-01T00:00:00Z"])), /permission denied/);
  });

  test('two products side by side: access lasts until the latest expiry, and one ending leaves the other', async () => {
    const { a, couple } = await makeCouple({ mode: 'instant' });
    await expire(couple);
    const apply = (product, until, at) => db.query('select public.apply_subscription_event($1, $2, $3, $4)', [a, product, until, at]);
    const paidUntil = async () => (await db.query('select paid_until from couples where id = $1', [couple])).rows[0].paid_until;

    await apply('yearly', '2099-06-01T00:00:00Z', '2026-10-01T10:00:00Z');
    // A monthly renewal arrives AFTER the yearly purchase: it must not shorten the access.
    await apply('monthly', '2099-01-01T00:00:00Z', '2026-10-01T10:05:00Z');
    assert.equal(new Date(await paidUntil()).toISOString(), '2099-06-01T00:00:00.000Z');
    assert.equal((await state(a)).has_access, true);

    // The yearly is refunded: the monthly still counts.
    await apply('yearly', '2020-01-01T00:00:00Z', '2026-10-02T10:00:00Z');
    assert.equal(new Date(await paidUntil()).toISOString(), '2099-01-01T00:00:00.000Z');
    // The monthly ends too: locked.
    await apply('monthly', '2020-02-01T00:00:00Z', '2026-10-03T10:00:00Z');
    assert.equal((await state(a)).has_access, false);
  });

  test('the app cannot extend its own access', async () => {
    const { a, couple } = await makeCouple({ mode: 'instant' });
    await expire(couple);
    await asUser(db, a, () => db.query("update public.couples set paid_until = now() + interval '1 year', trial_ends_at = now() + interval '1 year'").catch(() => {}));
    assert.equal((await state(a)).has_access, false);
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

describe('notices', () => {
  const settings = (u, ...args) => call(u, 'select public.update_couple_settings($1, $2, $3) as r', args);
  const mine = (u) => asUser(db, u, async () => (await db.query('select id, kind, from_value, to_value from public.notices')).rows);
  const dismiss = (u, id) => call(u, 'select public.dismiss_notice($1) as r', [id]);

  test('changing the match goal leaves a notice for the partner only', async () => {
    const { a, b } = await makeCouple({ goal: 2 });
    await settings(a, 3, null, null);
    assert.deepEqual(await mine(a), []);
    const [n] = await mine(b);
    assert.deepEqual([n.kind, n.from_value, n.to_value], ['match_goal_changed', 2, 3]);
  });

  test('several changes collapse into one notice, and changing it back leaves none', async () => {
    const { a, b } = await makeCouple({ goal: 2 });
    await settings(a, 3, null, null);
    await settings(a, 5, null, null);
    let notices = await mine(b);
    assert.equal(notices.length, 1);
    assert.deepEqual([notices[0].from_value, notices[0].to_value], [2, 5]);
    await settings(a, 2, null, null);
    assert.deepEqual(await mine(b), []);
  });

  test('other settings and unchanged values make no notice', async () => {
    const { a, b } = await makeCouple({ goal: 2 });
    await settings(a, 2, 'instant', '18:00');
    await settings(a, null, 'scheduled', null);
    assert.deepEqual(await mine(b), []);
  });

  test('acting on the goal yourself clears the notice you were holding, and the partner gets a fresh one', async () => {
    const { a, b } = await makeCouple({ goal: 2 });
    await settings(a, 3, null, null);
    await settings(b, 4, null, null);
    assert.deepEqual(await mine(b), []);
    const [n] = await mine(a);
    assert.deepEqual([n.from_value, n.to_value], [3, 4]);
  });

  test('dismissing removes it; only the recipient can dismiss, nobody can read or write notices directly', async () => {
    const { a, b } = await makeCouple({ goal: 2 });
    await settings(a, 3, null, null);
    const [n] = await mine(b);
    await dismiss(a, n.id); // the sender's attempt does nothing
    assert.equal((await mine(b)).length, 1);
    await dismiss(b, n.id);
    assert.deepEqual(await mine(b), []);
    await assert.rejects(asUser(db, b, () => db.query("insert into public.notices (recipient_id, kind) values ($1, 'match_goal_changed')", [b])), /row-level security|permission denied/);
  });
});

describe('diet corrections in the catalog', () => {
  const pool = async (diet, allergens = []) =>
    new Set((await db.query(
      `select r.title from public.recipes r where ($1 = 'none' or $1 = any(r.diet_flags)) and not (r.allergens && $2::text[])`,
      [diet, allergens],
    )).rows.map((r) => r.title));

  test('a dish filed under Beef but made of lentils is vegetarian', async () => {
    assert.ok((await pool('vegetarian')).has('Vegetable Shepherds Pie'));
    assert.ok(!(await pool('vegan')).has('Vegetable Shepherds Pie'), 'it has butter');
  });

  test('a dish whose only meat is a stock cube is offered to vegetarians, with the swap in its payload', async () => {
    assert.ok((await pool('vegetarian')).has('Beetroot Soup (Borscht)'));
    const { rows } = await db.query(
      `select public.recipe_json(array[(select id from public.recipes where title = 'Beetroot Soup (Borscht)')]) -> 0 -> 'swaps' as swaps`,
    );
    assert.deepEqual(rows[0].swaps, [{ from: 'chicken stock cube', to: 'vegetable stock cube' }]);
  });

  test('dishes with real meat or fish are never rescued by the swap rule', async () => {
    const veg = await pool('vegetarian');
    for (const title of ['Eggplant Adobo', 'Thai rice noodle salad', 'Liegeoise Salad']) assert.ok(!veg.has(title), title);
  });

  test('eggs missing from an ingredient list are fixed: not vegan, and not safe for an egg allergy', async () => {
    assert.ok(!(await pool('vegan')).has('Egg Drop Soup'));
    assert.ok(!(await pool('none', ['eggs'])).has('Egg Drop Soup'));
    assert.ok(!(await pool('vegan')).has('Ful Medames'));
  });
});

describe('a revealed dinner stays revealed', () => {
  const settings = (u, ...args) => call(u, 'select public.update_couple_settings($1, $2, $3) as r', args);

  async function matchedCouple() {
    const { a, b, couple } = await makeCouple({ goal: 1 });
    const f = await feed(a);
    await swipe(a, f.deck_id, f.dishes[0].id, true);
    await swipe(b, f.deck_id, f.dishes[0].id, true);
    return { a, b, couple, f };
  }

  test('moving the reveal time later after the reveal neither takes it back nor reopens swiping', async () => {
    const { a, b, couple, f } = await matchedCouple();
    await openReveal(couple);
    const first = await reveal(a); // someone looks: it is stamped
    assert.equal(first.status, 'revealed');

    await settings(b, null, null, '23:59'); // the reveal time is now far in the future again
    for (const u of [a, b]) {
      const r = await reveal(u);
      assert.equal(r.status, 'revealed');
      assert.deepEqual(r.dishes, first.dishes);
      assert.equal((await feed(u)).status, 'closed');
      await assert.rejects(swipe(u, f.deck_id, f.dishes[1].id, true), /deck_closed/);
    }
  });

  test('even if nobody had looked yet when the time was moved, the passed reveal counts', async () => {
    const { a, b, couple, f } = await matchedCouple();
    await openReveal(couple); // passed, but nobody has opened the app since
    await settings(a, null, null, '23:59');
    assert.equal((await reveal(b)).status, 'revealed');
    assert.equal((await feed(b)).status, 'closed');
    await assert.rejects(swipe(b, f.deck_id, f.dishes[1].id, true), /deck_closed/);
  });

  test('a time change made before the reveal still works normally', async () => {
    const { a, couple } = await matchedCouple(); // reveal 23:59:59, still ahead
    await settings(a, null, null, '23:00');
    assert.equal((await reveal(a)).status, 'pending');
    await openReveal(couple);
    assert.equal((await reveal(a)).status, 'revealed');
  });

  test('"seen" works for a reveal whose time was moved afterwards', async () => {
    const { a, couple, f } = await matchedCouple();
    await openReveal(couple);
    await reveal(a);
    await settings(a, null, null, '23:59');
    await seen(a, f.deck_id);
    assert.equal((await reveal(a)).seen, true);
  });
});
