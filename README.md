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
- [ ] Phases 6–9: daily decks, swiping, matching and reveal, launch polish

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
```

## Structure

```
src/app/(auth)   signed-out screens (welcome, email code sign-in)
src/app/(app)    signed-in screens (name, couple setup, invite, join, preferences, home)
src/lib          supabase client, zod schemas, errors
src/providers    auth session provider
src/hooks        data hooks (profile, couple, preferences)
src/constants    theme and food option ids (diets, allergens, dislikes)
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
