# Dinner Roulette

A couples app: swipe on dinner options together, and at reveal time you both find out what's cooking.

Expo (SDK 57) · Expo Router · TypeScript · Supabase · TanStack Query · React Hook Form + Zod

## Status

- [x] Phase 0: project foundations
- [x] Phase 1: auth (email OTP, Sign in with Apple) and name onboarding
- [ ] Phase 2: paywall and entitlement (RevenueCat)
- [ ] Phase 3: couple pairing
- [ ] Phases 4–9: preferences, recipes, decks, swiping, reveal, launch polish

## Setup (local, no cloud needed)

Prerequisites: Node, Docker Desktop (running), Xcode for the iOS simulator.

1. `npm install`
2. `npm run db:start` starts Supabase in Docker and applies everything in `supabase/migrations`.
3. `cp .env.example .env.local`, then paste `API_URL` and `ANON_KEY` from `npm run db:status -- -o env`.
4. Build a dev client (Sign in with Apple is native, so Expo Go won't work): `npx expo run:ios`

Local services once started:

| Service | URL |
|---|---|
| API | http://127.0.0.1:54321 |
| Studio (DB browser) | http://127.0.0.1:54323 |
| Mailpit (catches OTP emails) | http://127.0.0.1:54324 |

Email sign-in works fully offline: the 6-digit code arrives in Mailpit, not a real inbox.

Sign in with Apple is enabled in `supabase/config.toml` for the bundle id `com.ezequias.dinnerroulette`.
It needs a real Apple Developer account and a real device or signed simulator build. Use email sign-in until then.

Changing the schema: `npm run db:migration -- <name>`, edit the new file, then `npm run db:reset` to rebuild from scratch.

## Scripts

```bash
npx expo start     # dev server
npm run db:start   # local Supabase up (db:stop / db:reset / db:status)
npx expo lint      # lint
npx tsc --noEmit   # typecheck
```

## Structure

```
src/app/(auth)   signed-out screens (welcome, email code sign-in)
src/app/(app)    signed-in screens (name onboarding, home)
src/lib          supabase client, apple auth, zod schemas
src/providers    auth session provider
src/hooks        data hooks (profile)
supabase/        SQL migrations
```
