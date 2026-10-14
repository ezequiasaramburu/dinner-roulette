// Builds a throwaway Postgres (PGlite, in-process) from supabase/migrations + supabase/seed.sql,
// with just enough Supabase scaffolding (roles, auth schema) for the migrations to run.
// No Docker needed, so deck logic can be tested and reviewed anywhere.
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../supabase/', import.meta.url));

export async function createDb() {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema auth; create schema extensions;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    -- Stand-in for pgcrypto (only used for invite codes).
    create function extensions.gen_random_bytes(n int) returns bytea language sql as $$
      select decode(substr(md5(random()::text), 1, n * 2), 'hex') $$;
    create publication supabase_realtime;
    -- Supabase grants the API roles access to everything in public by default; RLS then does the gatekeeping.
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
    grant usage on schema public, auth, extensions to anon, authenticated, service_role;
  `);
  for (const file of readdirSync(root + 'migrations').filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(root + 'migrations/' + file, 'utf8'));
  }
  await db.exec(readFileSync(root + 'seed.sql', 'utf8'));
  return db;
}

export async function addUser(db, email) {
  const { rows } = await db.query('insert into auth.users (email) values ($1) returning id', [email]);
  return rows[0].id;
}

/** Run `fn` as an authenticated Supabase user (auth.uid() = userId, role = authenticated). */
export async function asUser(db, userId, fn) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.exec('set role authenticated');
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

export const prefs = (over = {}) => ({ diet: 'none', allergens: [], cuisines: [], disliked: [], ...over });

export async function buildDeck(db, a, b, recent = {}, size = 12) {
  const { rows } = await db.query(
    `select b.pos, b.score, b.pool_size, b.is_repeat, r.id, r.title, r.country, r.category, r.dish_type, r.allergens, r.diet_flags,
            r.ingredient_names,
            coalesce((select array_agg(h.dislike_id) from public.recipe_dislike_hits h where h.recipe_id = r.id), '{}') as hits
     from public.build_deck($1::jsonb, $2::jsonb, $3::jsonb, $4) b
     join public.recipes r on r.id = b.recipe_id
     order by b.pos`,
    [JSON.stringify(a), JSON.stringify(b), JSON.stringify(recent), size],
  );
  return rows;
}
