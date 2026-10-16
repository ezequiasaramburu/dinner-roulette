#!/usr/bin/env node
// Dev only: wipe the app data of two test users in the LOCAL database so you can walk the whole flow again
// without making new accounts or waiting for tomorrow. The accounts themselves (email + password) are kept.
//
//   npm run dev:reset -- eze@gmail.com daryna@gmail.com
//   npm run dev:reset                       (uses DEV_RESET_EMAILS from .env.local, comma separated)
//
// Removes: their couple (members, invite codes, daily decks, swipes, reveal views), food preferences, notices,
// join attempts, blocks, reports, their trial history (so a new couple gets a fresh 7 days), and their display name and
// accepted terms (so you start at the name screen).
// Options:
//   --keep-name   keep display name and accepted terms (start at "create a couple")
//   --recipes     also delete the community recipes they wrote (photos in Storage stay: remove them in Studio)
//   --force       allow deleting a couple that has a member outside the two emails
//   --dry-run     do everything, check it, then roll back: nothing is changed
import { execFileSync } from 'node:child_process';

try {
  process.loadEnvFile('.env.local');
} catch {
  // optional
}

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const emails = (args.filter((a) => !a.startsWith('--')).length ? args.filter((a) => !a.startsWith('--')) : (process.env.DEV_RESET_EMAILS ?? '').split(','))
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const container = process.env.DEV_DB_CONTAINER ?? 'supabase_db_dinner-roulette';
const fail = (msg) => {
  console.error(`dev:reset: ${msg}`);
  process.exit(1);
};

if (emails.length === 0) fail('give the emails of the users to reset, or set DEV_RESET_EMAILS in .env.local.');
if (!emails.every((e) => /^[^\s'"\;]+@[^\s'"\;]+$/.test(e))) fail('that does not look like an email address.');

// Everything goes through the local Supabase container, so this can never touch a hosted project.
const psql = (sql) => {
  try {
    return execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At', '-F', '|'], {
      input: sql,
      encoding: 'utf8',
    }).trim();
  } catch (e) {
    fail(`could not reach the local database (container "${container}"). Is it running? (npm run db:start)\n${e.stderr ?? e.message}`);
  }
};

const list = emails.map((e) => `'${e}'`).join(', ');
const users = psql(`select id, email from auth.users where lower(email) in (${list}) order by email;`)
  .split('\n')
  .filter(Boolean)
  .map((l) => l.split('|'));
const missing = emails.filter((e) => !users.some(([, email]) => email.toLowerCase() === e));
if (missing.length) fail(`no account for: ${missing.join(', ')}`);

const ids = users.map(([id]) => `'${id}'`).join(', ');

// A couple with someone else in it would take that person's data with it.
const strangers = psql(`
  select distinct u.email from couple_members m join auth.users u on u.id = m.user_id
  where m.couple_id in (select couple_id from couple_members where user_id in (${ids})) and m.user_id not in (${ids});`);
if (strangers && !flags.has('--force')) {
  fail(`their couple also includes ${strangers.split('\n').join(', ')}. Add that email, or use --force to remove it anyway.`);
}

const keepName = flags.has('--keep-name');
const recipes = flags.has('--recipes');
const dry = flags.has('--dry-run');

const tables = ['couples', 'couple_members', 'invites', 'daily_decks', 'swipes', 'reveal_views', 'preferences', 'notices', 'join_attempts', 'author_blocks', 'recipe_reports'];
const count = (t) => `select '${t}', count(*) from ${t}`;

// Rows that would go with the two users, counted before and after; "after" must be zero or nothing is committed.
const reach = `
  create temp table _c on commit drop as
    select id from couples where owner_id in (${ids}) or id in (select couple_id from couple_members where user_id in (${ids}));
  create temp table _before on commit drop as
    select 'couples' t, count(*) n from couples where id in (select id from _c)
    union all select 'couple_members', count(*) from couple_members where couple_id in (select id from _c)
    union all select 'invites', count(*) from invites where couple_id in (select id from _c) or created_by in (${ids})
    union all select 'daily_decks', count(*) from daily_decks where couple_id in (select id from _c)
    union all select 'swipes', count(*) from swipes where user_id in (${ids}) or deck_id in (select id from daily_decks where couple_id in (select id from _c))
    union all select 'reveal_views', count(*) from reveal_views where user_id in (${ids}) or deck_id in (select id from daily_decks where couple_id in (select id from _c))
    union all select 'preferences', count(*) from preferences where user_id in (${ids})
    union all select 'notices', count(*) from notices where recipient_id in (${ids})
    union all select 'join_attempts', count(*) from join_attempts where user_id in (${ids})
    union all select 'author_blocks', count(*) from author_blocks where blocker_id in (${ids}) or blocked_id in (${ids})
    union all select 'recipe_reports', count(*) from recipe_reports where reporter_id in (${ids})
    ${recipes ? `union all select 'recipes', count(*) from recipes where author_id in (${ids})` : ''};`;

const wipe = `
  delete from couples where id in (select id from _c);
  delete from invites where created_by in (${ids});
  delete from swipes where user_id in (${ids});
  delete from reveal_views where user_id in (${ids});
  delete from preferences where user_id in (${ids});
  delete from notices where recipient_id in (${ids});
  delete from join_attempts where user_id in (${ids});
  delete from author_blocks where blocker_id in (${ids}) or blocked_id in (${ids});
  delete from recipe_reports where reporter_id in (${ids});
  ${recipes ? `delete from recipes where author_id in (${ids});` : ''}
  update profiles set trial_started_at = null where id in (${ids});
  ${keepName ? '' : `update profiles set display_name = null, terms_accepted_at = null, push_token = null where id in (${ids});`}`;

const left = `
  select 'LEFT:' || t || '=' || n from (
    select 'couples' t, count(*) n from couples where id in (select id from _c)
    union all select 'swipes', count(*) from swipes where user_id in (${ids})
    union all select 'preferences', count(*) from preferences where user_id in (${ids})
    union all select 'notices', count(*) from notices where recipient_id in (${ids})
    ${recipes ? `union all select 'recipes', count(*) from recipes where author_id in (${ids})` : ''}
  ) x where n > 0;`;

const out = psql(`begin;\n${reach}\nselect 'DEL:' || t || '=' || n from _before where n > 0;\n${wipe}\n${left}\n${dry ? 'rollback;' : 'commit;'}`);
const lines = out.split('\n');
const leftovers = lines.filter((l) => l.startsWith('LEFT:'));
if (leftovers.length) fail(`something was left behind (${leftovers.join(', ')}); nothing was changed.`);

const deleted = lines.filter((l) => l.startsWith('DEL:')).map((l) => l.slice(4).replace('=', ' ').replace(/ (\d+)$/, ': $1'));
console.log(`${dry ? '[dry run, nothing changed] would reset' : 'Reset'}: ${users.map(([, e]) => e).join(', ')}`);
console.log(deleted.length ? `  removed  ${deleted.join(', ')}` : '  nothing to remove');
console.log(keepName ? '  kept     display name and accepted terms' : '  cleared  display name and accepted terms (you start at the name screen)');
if (!dry) console.log('Now close and reopen the app on both phones so they drop what they had loaded.');
