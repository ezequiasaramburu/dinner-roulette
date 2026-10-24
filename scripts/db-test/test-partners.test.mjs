import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { before, describe, test } from 'node:test';

import { addUser, asUser, createDb, prefs } from './harness.mjs';

let db;
before(async () => {
  db = await createDb();
  // The hosted auth.users has more columns than the harness stub; add the ones the script fills in.
  await db.exec(`
    alter table auth.users
      add column instance_id uuid, add column aud text, add column role text, add column encrypted_password text,
      add column email_confirmed_at timestamptz, add column raw_app_meta_data jsonb, add column created_at timestamptz,
      add column updated_at timestamptz, add column confirmation_token text, add column recovery_token text,
      add column email_change_token_new text, add column email_change text;
  `);
});

const script = readFileSync(new URL('../test-partners.sql', import.meta.url), 'utf8');
const call = (user, sql, args = []) => asUser(db, user, async () => (await db.query(sql, args)).rows[0]?.r);

describe('test partners script', () => {
  test('makes 20 ready partners with unused codes, and running it again adds nothing', async () => {
    await db.exec(script);
    const first = (await db.query("select count(*)::int n from auth.users where email like 'test-partner-%'")).rows[0].n;
    assert.equal(first, 20);
    const rows = await db.exec(script);
    const codes = rows.at(-1).rows;
    assert.equal(codes.length, 20, 'still 20, all printed');
    assert.ok(codes.every((c) => /^[A-HJ-NP-Z2-9]{6}$/.test(c.code)));
  });

  test('a tester joins with a code and can swipe and get a reveal on their own', async () => {
    const code = (await db.query("select i.code from invites i join auth.users u on u.id = i.created_by where u.email = 'test-partner-01@swipefordinner.app'")).rows[0].code;
    const tester = await addUser(db, 'tester@test.dev');
    const p = prefs();
    await db.query('insert into preferences (user_id, diet, allergens, cuisines, disliked) values ($1, $2, $3, $4, $5)', [tester, p.diet, p.allergens, p.cuisines, p.disliked]);
    assert.ok(await call(tester, 'select public.join_couple($1) as r', [code]));

    const state = await call(tester, 'select public.get_couple_state() as r');
    assert.equal(state.partner.display_name, 'Test partner');
    assert.equal(state.partner.ready, true, 'the partner has finished its preferences');
    assert.equal(state.role, 'partner');
    assert.equal(state.has_access, true);

    const feed = await call(tester, 'select public.get_swipe_feed() as r');
    assert.equal(feed.status, 'ready');
    await call(tester, 'select public.record_swipe($1, $2, true) as r', [feed.deck_id, feed.dishes[0].id]);
    await db.query("update couples set reveal_time = '00:00' where id = $1", [state.couple_id]);
    const reveal = await call(tester, 'select public.get_reveal() as r');
    assert.equal(reveal.status, 'revealed');
    assert.equal(reveal.kind, 'closest');
    assert.deepEqual(reveal.dishes.map((d) => d.id), [feed.dishes[0].id]);

    const again = await addUser(db, 'tester2@test.dev');
    assert.equal(await call(again, 'select public.join_couple($1) as r', [code]), null, 'a code works once');
  });
});
