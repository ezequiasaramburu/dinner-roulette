# Dinner Roulette

A couples app: swipe on dinner options together, and at reveal time you both find out what's cooking.

Expo (SDK 57) · Expo Router · TypeScript · Supabase · TanStack Query · React Hook Form + Zod

## Status

- [x] Phase 0: project foundations
- [x] Phase 1: auth (email OTP; Sign in with Apple is parked, see docs/apple-sign-in.md) and name onboarding
- [ ] Phase 2: paywall and entitlement (RevenueCat), deferred until the MVP is done
- [x] Phase 3: couple pairing (invite code/link, join, realtime)
- [x] Phase 4: food preferences (diet, allergies, cuisines, dislikes)
- [x] Phase 5: recipe catalog (473 dinners imported from TheMealDB)
- [x] Phase 6: daily deck builder (server-side filters, ranking, variety, no-repeat window)
- [x] Phase 7: swiping (endless queue, match goal, gesture card stack, settings)
- [x] Phase 8: reveal (reveal result and screen, full recipe, instant mode, reveal-time picker, daily reminder). Push from the server (partner matched, nudges) is still to do: needs the Apple developer account for iOS
- [ ] Phase 9: launch polish

## Setup (local, no cloud needed)

Prerequisites: Node, Docker Desktop (running), Xcode for the iOS simulator.

1. `npm install`
2. `npm run db:start` starts Supabase in Docker and applies everything in `supabase/migrations`.
3. `cp .env.example .env.local`, then paste `API_URL` and `ANON_KEY` from `npm run db:status -- -o env`.
4. Android emulator: nothing extra, the app maps `127.0.0.1` to the host automatically (`10.0.2.2`).
5. Build a dev client (native modules, so Expo Go won't work): `npx expo run:ios`

Local services once started:

| Service | URL |
|---|---|
| API | http://127.0.0.1:54321 |
| Studio (DB browser) | http://127.0.0.1:54323 |
| Mailpit (catches OTP emails) | http://127.0.0.1:54324 |

Email sign-in works fully offline: the 6-digit code arrives in Mailpit, not a real inbox.

Sign in with Apple is **off** for now: free personal Apple teams can't sign that capability. The Supabase provider is
already configured, and `docs/apple-sign-in.md` has the code and steps to turn it on once you have a paid Apple
Developer account. Until then, use email sign-in.

Changing the schema: `npm run db:migration -- <name>`, edit the new file, then `npm run db:reset` to rebuild from scratch.

## Scripts

```bash
npx expo start     # dev server
npm run db:start   # local Supabase up (db:stop / db:reset / db:status)
npx expo lint      # lint
npx tsc --noEmit   # typecheck
npm test           # recipe normalizer tests
npm run test:db    # database + deck tests (in-process Postgres, no Docker needed)
npm run decks:review          # print decks for realistic couples to judge quality by eye
```

## Structure

```
src/app/(auth)   signed-out screens (welcome, email code sign-in)
src/app/(app)    signed-in screens (name, couple setup, invite, join, preferences, home)
src/lib          supabase client, zod schemas, errors
src/providers    auth session provider
src/hooks        data hooks (profile, couple, preferences, deck + swipes)
src/constants    design tokens (theme.ts) and food option ids (diets, allergens, dislikes)
src/components/dish  DishCard and the gesture-driven SwipeDeck
src/components/ui  the UI library: Text, Button, Card, Chip, TextField, Screen, Pill, Avatar, SideMenu, ...
scripts/mealdb   TheMealDB importer + recipe tagging (unit tested)
supabase/        SQL migrations, seed.sql (generated recipes), email templates
```

## Recipes

`supabase/seed.sql` is generated and loads on every `npm run db:reset`. It contains the dinner-eligible recipes
(Beef, Chicken, Pork, Lamb, Goat, Seafood, Pasta, Vegetarian, Vegan; desserts, sides, starters, breakfast and
miscellaneous are skipped), each tagged with allergens and diet flags derived from its ingredients.

To refresh it: `npm run recipes:import` (fetches from TheMealDB; set `MEALDB_API_KEY` once you have a supporter key),
then `npm run db:reset`. Allergen tagging is keyword-based and intentionally errs on the side of over-flagging, but it is
not a guarantee. The recipe screen must keep an "check the ingredient list" notice.

Recipe data courtesy of [TheMealDB](https://www.themealdb.com).

## Design system

Warm editorial: paper and ink with a tomato accent, Fraunces (serif) for headlines and Inter for interface text.
Light and dark palettes follow the phone's setting.

- **Tokens** live in `src/constants/theme.ts` (colours, spacing, radius, fonts, elevation). Text/background pairs were
  checked for WCAG AA contrast. One pairing to avoid: tomato text on `primarySoft` in light mode (4.4:1).
- **Components** live in `src/components/ui` and are imported from `@/components/ui`. Build screens from these instead of
  raw `react-native` `Text`/`Pressable` with ad-hoc styles, and read colours with `useTheme()`, never hard-coded hex values.
- **Headlines:** `<Text variant="title">Decide <Accent>together.</Accent></Text>`; the italic tomato accent word is the brand's signature.
- **Layout:** `<Screen footer={...}>` pins the primary action above the keyboard and handles safe areas and scrolling.
- **Motion** is subtle and respects the system "reduce motion" setting (`FadeInDown` entrances, the slow roulette wheel).

Splash colours are set in `app.json` and need a native rebuild (`npx expo prebuild --clean`) to take effect.
The app icon is still the Expo placeholder.

## How decks are built

`public.build_deck` (see `supabase/migrations/0005_decks.sql`) ranks the dishes for a couple. The swipe queue is that
ranking, built once per dinner cycle (see "Swiping and matches").

| Tier | Filters | Behaviour |
|---|---|---|
| Hard | diet (the stricter of the two), allergens (union), meats and specific ingredients either dislikes | Never relaxed. A very restrictive couple gets a shorter deck, not a wrong one. |
| Soft | onions, tomatoes, chili (each is in more than 25% of the catalog) | Used last, behind even repeated dishes. |
| Boost | cuisines | Both like: highest. One likes: next. Never a restriction. |
| Variety | max 3 per country, 3 per category, 2 per dish family | Relaxed only if the pool can't fill 12. |
| History | nothing served in the last 30 days | If the pool runs dry, the oldest dishes return first. |

The dislike rules live in the `dislike_rules` table (regex over ingredient names). The catalog is curated by
`scripts/mealdb/exclude.mjs` (sauces, sides, desserts, duplicates and fast-food clones are removed) and each dish gets a
family (`dish_type`) from its title. Add to the blocklist whenever a bad dish shows up in a deck.

## Swiping and matches

There is no daily quota and no "N left". Each couple has **one ranked queue per day** (the couple's local date). Both partners
walk the same queue in the same order at their own pace, a few swipes at a time, whenever they like. Swiping is open from
midnight until the dinner is revealed (the reveal time, or the moment the goal is reached in instant mode); after that it
is closed for both until the next day (`0014_swiping_closes_at_reveal.sql`).

A **match** is a dish both partners liked. The couple's **match goal** (default 2, settable 1 to 5 in Settings, by either
partner) is how many matches get revealed together at the reveal time. When the goal is reached, swiping ends for both
of them; the matches themselves stay hidden until the reveal.

Server pieces (`supabase/migrations/0006_swipes.sql`, `0007_match_goal_queue.sql`):

- `get_swipe_feed()` creates the cycle's queue on first use and returns the caller's next few dishes plus a status
  (`ready`, `goal_reached`, `exhausted`). No counts, nothing about the partner's choices.
- `record_swipe()` / `undo_last_swipe()` check the deck belongs to the caller's couple, is the current cycle's, and isn't
  closed by the goal. Row-level security lets you read only your own swipes.
- The queue is built once per cycle with `build_deck(..., 100)`: the full ranked list, so the order is stable.
  "Recently seen" means dishes the couple actually swiped in the last 30 days, not everything that was queued.

Gotcha for SQL changes: the Supabase API role runs with `pg_safeupdate`, which rejects any `UPDATE`/`DELETE` without a
`WHERE`. `npm run test:db` scans the migrations for that, but always try new functions through the real API too.

## The reveal

At the couple's reveal time, `get_reveal()` (`supabase/migrations/0008_reveal.sql`) opens today's cycle for both
partners, with the full recipe (ingredients, steps, video). Before that it only returns `pending` and the reveal time.
How the dinner is found:

- `match`: dishes both liked, in queue order.
- `closest`: nothing shared, so dishes one of you liked (up to the match goal).
- `surprise`: nobody liked anything, so the top of the queue (the best fit for both tastes).

Swipes after the reveal belong to tomorrow's queue, so a revealed result never changes. `mark_reveal_seen()` records that a
partner opened it: the roulette animation plays once, and home shows "New" until then. The recipe screen carries an
allergen disclaimer, since allergens are derived from ingredient text.

To try it without waiting for 17:00, set `couples.reveal_time` to `00:00` in the local database, reload the app, and
put it back afterwards.

### Reveal mode

A couple picks how they find out (Settings, either partner): `scheduled` (at the reveal time, as above) or `instant`
(`supabase/migrations/0009_reveal_mode.sql`). In instant mode swipes always count toward today, the reveal opens the
moment the match goal is reached (`daily_decks.revealed_at`, so it sticks even if the goal changes), and swiping stays
closed until tomorrow. There are no fallbacks: a day that doesn't reach the goal reveals nothing. An open app hears
about it through Realtime (`0010`); a push notification for a partner who isn't in the app comes with the push work.
`update_couple_settings(match_goal, reveal_mode, reveal_time)` changes any of the three; omitted ones stay.

### Notices

`notices` (`0011_notices.sql`) holds short in-app messages one partner's action leaves for the other. Changing the match
goal tells the partner on their home screen ("Daryna changed matches per day from 2 to 3", with "Got it" to dismiss).
Changes collapse into one notice from the original to the latest value, changing it back leaves none, and changing the
goal yourself clears the notice you were holding. Readable only by the recipient; created by `update_couple_settings`.

### Free-text exclusions

Beyond the fixed allergy and dislike lists, each person can type their own ("kiwi", "mustard", "blue cheese"):
`preferences.custom_allergens` and `custom_dislikes` (`0013_custom_exclusions.sql`). Nothing is stored on recipes. Each
term is matched against a recipe's ingredient names when the deck is built (whole words, plural tolerated: "nut" is not
"nutmeg", "peanuts" matches "peanut butter"), both partners' terms add up, and both lists exclude outright. A trigger
cleans what is typed (lower-case, letters/digits/spaces/hyphens, 3 to 40 characters, at most 20 per list). Terms are
private to their owner, like the rest of the preferences. Because it works on ingredient names at query time, it covers
recipes added later without any tagging.

### Reveal time and the daily reminder

In scheduled mode either partner picks the reveal time in Settings (`update_couple_settings(..., reveal_time)`). Each
phone then schedules one repeating local notification (`expo-notifications`, `src/hooks/use-reveal-reminder.ts`), so no
server is involved: the time is fixed and known ahead. The reveal time is on the couple's clock, so it is converted to
this phone's clock for today (`src/lib/zoned-time.ts`, tested with `npm test`, including daylight-saving days) and
rescheduled whenever the app comes to the foreground, the settings change, or the mode switches (instant mode has no
reminder). Permission is asked from a button, never on first launch; the on/off switch for the reminder is per phone.
`expo-notifications` and the time picker are native modules, so the first run after pulling this needs a rebuild
(`npx expo run:ios` / `run:android`).

### A revealed dinner stays revealed

The reveal is stamped on the day's deck (`daily_decks.revealed_at`, `0015_revealed_stays_revealed.sql`) the first time
anyone looks after the reveal time, and right before the reveal time or mode is changed. Once stamped it never goes
back: moving the reveal time later afterwards only affects tomorrow, and swiping stays closed. To test a reveal by
editing `couples.reveal_time`, remember a stamped deck stays revealed; use a fresh day or clear `revealed_at`.
