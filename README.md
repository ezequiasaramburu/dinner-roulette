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
- [x] Phase 7: swipe screen (gesture card stack, like/pass, undo, partner progress)
- [ ] Phases 8–9: matching and reveal, launch polish

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
src/components/ui  the UI library: Text, Button, Card, Chip, TextField, Screen, Pill, Avatar, ...
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

`public.build_deck` (see `supabase/migrations/0005_decks.sql`) picks 12 dishes per couple per local day, the same for both
partners. It is created on the first `get_or_create_today_deck()` call of the day.

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

## Swiping

Each person swipes the 12 dishes of the day (right = yum, left = pass; buttons and undo are there too). Choices are stored
by `record_swipe` / `undo_last_swipe` (see `supabase/migrations/0006_swipes.sql`), which check that the deck belongs to the
caller's couple and is still today's. Row-level security means you can only read **your own** swipes. The deck payload
carries your swipes plus how *many* dishes your partner has swiped, never which ones, so the match stays a surprise
until the reveal.

Gotcha for SQL changes: the Supabase API role runs with `pg_safeupdate`, which rejects any `UPDATE`/`DELETE` without a
`WHERE`. `npm run test:db` scans the migrations for that, but always try new functions through the real API too.
