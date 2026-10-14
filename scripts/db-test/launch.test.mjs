import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';

import { addUser, asUser, createDb } from './harness.mjs';

let db;
before(async () => {
  db = await createDb();
});

const rpc = (user, sql, params = []) => asUser(db, user, () => db.query(sql, params));

async function pair(ownerEmail, partnerEmail) {
  const owner = await addUser(db, ownerEmail);
  const partner = await addUser(db, partnerEmail);
  await rpc(owner, 'select public.create_couple($1)', ['UTC']);
  const { rows } = await rpc(owner, 'select public.create_invite() as code');
  await rpc(partner, 'select public.join_couple($1)', [rows[0].code]);
  return { owner, partner };
}

describe('invite code rate limit', () => {
  test('a wrong code returns null and the sixth attempt in a row is refused', async () => {
    const owner = await addUser(db, 'rl-owner@test.dev');
    const guesser = await addUser(db, 'rl-guess@test.dev');
    await rpc(owner, 'select public.create_couple($1)', ['UTC']);
    const { rows } = await rpc(owner, 'select public.create_invite() as code');

    for (let i = 0; i < 5; i++) {
      const r = await rpc(guesser, 'select public.join_couple($1) as id', ['ZZZZZ' + i]);
      assert.equal(r.rows[0].id, null);
    }
    await assert.rejects(rpc(guesser, 'select public.join_couple($1)', [rows[0].code]), /too_many_attempts/);
  });

  test('attempts older than 15 minutes stop counting', async () => {
    const owner = await addUser(db, 'rl2-owner@test.dev');
    const guesser = await addUser(db, 'rl2-guess@test.dev');
    await rpc(owner, 'select public.create_couple($1)', ['UTC']);
    const { rows } = await rpc(owner, 'select public.create_invite() as code');

    for (let i = 0; i < 5; i++) await rpc(guesser, 'select public.join_couple($1)', ['AAAAA' + i]);
    await db.query("update public.join_attempts set attempted_at = now() - interval '20 minutes' where user_id = $1", [guesser]);

    const r = await rpc(guesser, 'select public.join_couple($1) as id', [rows[0].code]);
    assert.ok(r.rows[0].id);
  });

  test('a successful join clears the failed attempts', async () => {
    const owner = await addUser(db, 'rl3-owner@test.dev');
    const guesser = await addUser(db, 'rl3-guess@test.dev');
    await rpc(owner, 'select public.create_couple($1)', ['UTC']);
    const { rows } = await rpc(owner, 'select public.create_invite() as code');
    await rpc(guesser, 'select public.join_couple($1)', ['BBBBBB']);
    await rpc(guesser, 'select public.join_couple($1)', [rows[0].code]);
    const left = await db.query('select count(*)::int as n from public.join_attempts where user_id = $1', [guesser]);
    assert.equal(left.rows[0].n, 0);
  });
});

describe('new couples', () => {
  test('reveal as soon as they match by default', async () => {
    const owner = await addUser(db, 'default-mode@test.dev');
    await rpc(owner, 'select public.create_couple($1)', ['UTC']);
    const state = await rpc(owner, 'select public.get_couple_state() as s');
    assert.equal(state.rows[0].s.reveal_mode, 'instant');
  });
});

describe('getting a new invite code', () => {
  test('the old code stops working and the new one works', async () => {
    const owner = await addUser(db, 'new-a@test.dev');
    const partner = await addUser(db, 'new-b@test.dev');
    await rpc(owner, 'select public.create_couple($1)', ['UTC']);
    const first = (await rpc(owner, 'select public.create_invite() as code')).rows[0].code;
    const second = (await rpc(owner, 'select public.regenerate_invite() as code')).rows[0].code;
    assert.notEqual(first, second);
    // create_invite now returns the new one, and the old one is dead.
    assert.equal((await rpc(owner, 'select public.create_invite() as code')).rows[0].code, second);
    assert.equal((await rpc(partner, 'select public.join_couple($1) as id', [first])).rows[0].id, null);
    assert.ok((await rpc(partner, 'select public.join_couple($1) as id', [second])).rows[0].id);
  });

  test('only the owner of a couple with room can ask, and not too often', async () => {
    const owner = await addUser(db, 'new-c@test.dev');
    const stranger = await addUser(db, 'new-d@test.dev');
    await rpc(owner, 'select public.create_couple($1)', ['UTC']);
    await assert.rejects(rpc(stranger, 'select public.regenerate_invite()'), /not_couple_owner/);

    for (let i = 0; i < 5; i++) await rpc(owner, 'select public.regenerate_invite()');
    await assert.rejects(rpc(owner, 'select public.regenerate_invite()'), /too_many_invites/);
  });

  test('a full couple cannot get another code', async () => {
    const { owner } = await pair('new-e@test.dev', 'new-f@test.dev');
    await assert.rejects(rpc(owner, 'select public.regenerate_invite()'), /couple_full/);
  });
});

describe('deleting an account', () => {
  test('removes the person and everything of theirs', async () => {
    const { owner, partner } = await pair('del-a@test.dev', 'del-b@test.dev');
    await rpc(partner, "insert into public.preferences (user_id, diet) values (auth.uid(), 'none')");
    await rpc(partner, 'select public.delete_account()');

    for (const table of ['auth.users', 'public.profiles']) {
      const r = await db.query(`select count(*)::int as n from ${table} where id = $1`, [partner]);
      assert.equal(r.rows[0].n, 0, table);
    }
    const prefs = await db.query('select count(*)::int as n from public.preferences where user_id = $1', [partner]);
    assert.equal(prefs.rows[0].n, 0);
    // The owner is untouched and the couple is back to waiting for someone.
    const members = await db.query('select count(*)::int as n from public.couple_members where user_id = $1', [owner]);
    assert.equal(members.rows[0].n, 1);
    const state = await rpc(owner, 'select public.get_couple_state() as s');
    assert.equal(state.rows[0].s.partner, null);
    const code = await rpc(owner, 'select public.create_invite() as code');
    assert.match(code.rows[0].code, /^[A-Z0-9]{6}$/);
  });

  test('when the owner leaves, the couple is dissolved and the partner keeps their account and preferences', async () => {
    const { owner, partner } = await pair('del-c@test.dev', 'del-d@test.dev');
    await rpc(partner, "insert into public.preferences (user_id, diet) values (auth.uid(), 'none')");
    await rpc(owner, 'select public.delete_account()');

    const state = await rpc(partner, 'select public.get_couple_state() as s');
    assert.equal(state.rows[0].s, null);
    const kept = await db.query('select count(*)::int as n from auth.users where id = $1', [partner]);
    assert.equal(kept.rows[0].n, 1);
    const prefs = await db.query('select count(*)::int as n from public.preferences where user_id = $1', [partner]);
    assert.equal(prefs.rows[0].n, 1);
    // They can start their own couple.
    await rpc(partner, 'select public.create_couple($1)', ['UTC']);
  });

  test('a person without a couple can delete too, and anonymous callers cannot', async () => {
    const solo = await addUser(db, 'del-solo@test.dev');
    await rpc(solo, 'select public.delete_account()');
    const r = await db.query('select count(*)::int as n from auth.users where id = $1', [solo]);
    assert.equal(r.rows[0].n, 0);
    await assert.rejects(db.query('select public.delete_account()'), /not_authenticated/);
  });
});
