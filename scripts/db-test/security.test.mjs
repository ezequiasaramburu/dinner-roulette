// Guards for the database security pass (migration 0038): least privilege, column grants, and rules that keep new
// tables and functions from being exposed by accident.
import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';

import { addUser, asUser, createDb } from './harness.mjs';

let db;
before(async () => {
  db = await createDb();
});

const as = (user, sql, params = []) => asUser(db, user, () => db.query(sql, params));
async function asAnon(fn) {
  await db.exec('set role anon');
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
  }
}

async function pair(a, b) {
  const owner = await addUser(db, a);
  const partner = await addUser(db, b);
  await as(owner, 'select public.create_couple($1)', ['UTC']);
  const { rows } = await as(owner, 'select public.create_invite() as code');
  await as(partner, 'select public.join_couple($1)', [rows[0].code]);
  return { owner, partner };
}

describe('who can touch what', () => {
  test('signed-out users (anon) cannot read or write any table', async () => {
    for (const table of ['profiles', 'couples', 'couple_members', 'daily_decks', 'swipes', 'preferences', 'notices', 'recipes', 'invites', 'couple_subscriptions']) {
      await assert.rejects(asAnon(() => db.query(`select * from public.${table}`)), /permission denied/, table);
    }
    await assert.rejects(asAnon(() => db.query('select public.get_swipe_feed()')), /permission denied/);
  });

  test('signed-in users never get truncate, trigger or references, on any table', async () => {
    const { rows } = await db.query(`
      select table_name, privilege_type from information_schema.role_table_grants
      where table_schema = 'public' and grantee in ('anon', 'authenticated') and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES')`);
    assert.deepEqual(rows, []);
  });

  test('a partner cannot read your push token, and you cannot rewrite your own terms date', async () => {
    const { owner, partner } = await pair('sec-a@test.dev', 'sec-b@test.dev');
    await db.query("update public.profiles set display_name = 'Sam', push_token = 'ExponentPushToken[secret]' where id = $1", [owner]);
    await assert.rejects(as(partner, 'select push_token from public.profiles'), /permission denied/);
    await assert.rejects(as(partner, 'select * from public.profiles'), /permission denied/);
    // The partner still sees the name, as the app needs.
    const { rows } = await as(partner, 'select id, display_name from public.profiles where id = $1', [owner]);
    assert.deepEqual(rows, [{ id: owner, display_name: 'Sam' }]);

    await assert.rejects(as(owner, 'update public.profiles set terms_accepted_at = null where id = $1', [owner]), /permission denied/);
    await assert.rejects(as(owner, "update public.profiles set push_token = 'x' where id = $1", [owner]), /permission denied/);
    await as(owner, "update public.profiles set display_name = 'Sammy' where id = $1", [owner]);
    assert.equal((await db.query('select display_name from public.profiles where id = $1', [owner])).rows[0].display_name, 'Sammy');
  });

  test('the app can still read and write what it uses directly', async () => {
    const { owner } = await pair('sec-c@test.dev', 'sec-d@test.dev');
    await as(owner, 'insert into public.preferences (user_id) values ($1) on conflict (user_id) do update set diet = $2', [owner, 'none']);
    for (const sql of [
      'select * from public.preferences',
      'select * from public.notices',
      'select id, title from public.recipes',
      'select * from public.cuisine_options',
      'select * from public.couples',
      'select * from public.couple_members',
      'select * from public.daily_decks',
    ]) {
      await as(owner, sql);
    }
  });

  test('trigger functions cannot be called as API functions', async () => {
    const owner = await addUser(db, 'sec-e@test.dev');
    for (const fn of ['handle_new_user', 'preferences_normalize', 'recipes_derive']) {
      await assert.rejects(as(owner, `select public.${fn}()`), /permission denied/, fn);
    }
  });
});

describe('sign-up still works with locked-down trigger functions', () => {
  test('a user created by a plain role (like Supabase Auth) still gets a profile', async () => {
    // Supabase Auth inserts into auth.users as its own role, not as a superuser: the signup trigger must still fire.
    await db.exec(`
      create role signup_probe nologin;
      grant usage on schema auth, public to signup_probe;
      grant insert, select on auth.users to signup_probe;`);
    await db.exec('set role signup_probe');
    let id;
    try {
      id = (await db.query("insert into auth.users (email) values ('probe@test.dev') returning id")).rows[0].id;
    } finally {
      await db.exec('reset role');
    }
    const { rows } = await db.query('select id from public.profiles where id = $1', [id]);
    assert.equal(rows.length, 1);
  });
});

describe('rules that keep future changes safe', () => {
  test('every table in public has row-level security on', async () => {
    const { rows } = await db.query(`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
    assert.deepEqual(rows, [], 'a table without RLS is readable by anyone it is granted to');
  });

  test('every security definer function pins its search_path', async () => {
    const { rows } = await db.query(`
      select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef and not coalesce(p.proconfig, '{}') && array['search_path=""']`);
    assert.deepEqual(rows, []);
  });

  test('only the intended functions can be run by signed-in users', async () => {
    const { rows } = await db.query(`
      select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prokind = 'f' and has_function_privilege('authenticated', p.oid, 'execute')
      order by 1`);
    assert.deepEqual(
      rows.map((r) => r.proname),
      [
        'block_author', 'blocked_authors_count', 'cancel_couple', 'clear_blocks', 'create_couple', 'create_invite',
        'delete_account', 'delete_recipe', 'dismiss_notice', 'get_couple_state', 'get_dinner_history', 'get_history_recipe', 'get_reveal', 'get_swipe_feed',
        'is_couple_member', 'join_couple', 'mark_reveal_seen', 'record_swipe', 'regenerate_invite', 'report_recipe',
        'reveal_now', 'shares_couple_with', 'submit_recipe', 'swipe_again', 'undo_last_swipe', 'update_couple_settings',
      ],
      'a new callable function must be added here on purpose',
    );
  });
});
