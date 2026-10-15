#!/usr/bin/env node
// Dev only: put a couple back to "nobody has swiped today" in the LOCAL database, to test the reveal cases
// (match, closest, surprise, swipe again) over and over. Accounts, couple and preferences are kept.
//
//   npm run dev:reset-day -- eze@gmail.com            (any one member; the whole couple is reset)
//   npm run dev:reset-day                             (uses DEV_RESET_EMAILS from .env.local, comma separated)
//
// Removes the couple's deck for the current cycle (its swipes and reveal views go with it, so the matches and the
// second round are gone) and the "started another round" notices. The next time they open the app a fresh deck is
// built, which may hold different dishes. Add --dry-run to check it and roll back.
import { execFileSync } from 'node:child_process';

try {
  process.loadEnvFile('.env.local');
} catch {
  // optional
}

const args = process.argv.slice(2);
const dry = args.includes('--dry-run');
const given = args.filter((a) => !a.startsWith('--'));
const emails = (given.length ? given : (process.env.DEV_RESET_EMAILS ?? '').split(','))
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const container = process.env.DEV_DB_CONTAINER ?? 'supabase_db_dinner-roulette';
const fail = (msg) => {
  console.error(`dev:reset-day: ${msg}`);
  process.exit(1);
};

if (emails.length === 0) fail('give the email of a member of the couple, or set DEV_RESET_EMAILS in .env.local.');
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
const found = psql(`select lower(email) from auth.users where lower(email) in (${list});`).split('\n');
const missing = emails.filter((e) => !found.includes(e));
if (missing.length) fail(`no account for: ${missing.join(', ')}`);

const out = psql(`
begin;
create temp table _c on commit drop as
  select distinct couple_id from couple_members where user_id in (select id from auth.users where lower(email) in (${list}));
create temp table _d on commit drop as
  select d.id from daily_decks d join couples c on c.id = d.couple_id
  where d.couple_id in (select couple_id from _c) and d.deck_date = public.cycle_date(c.timezone);
select 'COUPLES=' || count(*) from _c;
select 'SWIPES=' || count(*) from swipes where deck_id in (select id from _d);
select 'VIEWS=' || count(*) from reveal_views where deck_id in (select id from _d);
delete from daily_decks where id in (select id from _d);
select 'DECKS=' || count(*) from _d;
with gone as (
  delete from notices
  where kind = 'swipe_again_started' and recipient_id in (select user_id from couple_members where couple_id in (select couple_id from _c))
  returning 1)
select 'NOTICES=' || count(*) from gone;
select 'LEFT=' || count(*) from daily_decks where id in (select id from _d);
${dry ? 'rollback;' : 'commit;'}`);

const n = Object.fromEntries(out.split('\n').filter((l) => l.includes('=')).map((l) => l.split('=')));
if (!Number(n.COUPLES)) fail('those accounts are not in a couple yet: nothing to reset.');
if (Number(n.LEFT)) fail('the deck was not removed; nothing was changed.');

console.log(`${dry ? '[dry run, nothing changed] would reset' : 'Reset'} today for the couple of ${emails.join(', ')}`);
console.log(`  removed  deck ${n.DECKS}, swipes ${n.SWIPES}, reveal views ${n.VIEWS}, another-round notices ${n.NOTICES}`);
if (!Number(n.DECKS)) console.log('  (there was no deck for today yet: they had not opened the swipe screen)');
if (!dry) console.log('Now close and reopen the app on both phones so they drop what they had loaded.');
