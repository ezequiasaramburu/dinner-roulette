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
| History | nothing the couple passed on in the last 3 days, nor liked in the last 7 | If the pool runs dry, the oldest dishes return first. |

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
  "Recently seen" means dishes the couple actually swiped, not everything that was queued: 3 days for a dish only passed on, 7 if someone liked it (migration 0033).

Gotcha for new tables and functions (migration 0038): `public` is closed by default, so `anon` and `authenticated` get
nothing. A new table needs row-level security on, and an explicit `grant select (...) on ... to authenticated` only if the app
reads it directly; a new function needs `grant execute ... to authenticated` only if the app calls it. The test
`security.test.mjs` fails if a table has no RLS or an unexpected function becomes callable. The review is in
`docs/security-review.md`.

Gotcha for SQL changes: the Supabase API role runs with `pg_safeupdate`, which rejects any `UPDATE`/`DELETE` without a
`WHERE`. `npm run test:db` scans the migrations for that, but always try new functions through the real API too.

## The reveal

At the couple's reveal time, `get_reveal()` (`supabase/migrations/0008_reveal.sql`) opens today's cycle for both
partners, with the full recipe (ingredients, steps, video). Before that it only returns `pending` and the reveal time.
How the dinner is found:

- `match`: dishes both liked, in queue order.
- `closest`: nothing shared, so dishes one of you liked (up to the match goal).
- `surprise`: nobody liked anything, so the top of the queue (the best fit for both tastes).

Instant mode uses the same ladder. It opens when the match goal is reached, when both partners have been through every
dish, or when either taps "Reveal with what we have" (`reveal_now()`, migration 0026). That button is not on the swipe screen: Home offers it on its own card only once **both** of you have swiped half of the dishes you can swipe in the round with no match (migration 0031, `reveal_offer_ready()`). Instant couples get a daily swipe reminder on each phone, at a time they choose (default 14:00).

If nobody matched (`closest` or `surprise`), the couple can **swipe again** once (`swipe_again()`, migration 0027): the
dishes just shown are set aside, the reveal reopens, and a second round with new dishes from the rest of the queue
reveals the instant way, whatever the couple's mode. After that the result is final. A dish the couple swiped is held
back from new queues for 3 days if it was only passed on, 7 if someone liked it.

Apart from that, swipes after the reveal belong to tomorrow's queue, so a revealed result never changes. `mark_reveal_seen()` records that a
partner opened it: the roulette animation plays once, and home shows "New" until then. The recipe screen carries an
allergen disclaimer, since allergens are derived from ingredient text.

To try it without waiting for 17:00, set `couples.reveal_time` to `00:00` in the local database, reload the app, and
put it back afterwards.

### Reveal mode

A couple picks how they find out (Settings, either partner): `scheduled` (at the reveal time, as above) or `instant`
(the default for new couples: with a set time, a couple that signs up after that time can't swipe until midnight)
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

## Accounts, invite codes and legal

- **Invite code rate limit:** `join_couple` counts wrong codes per user in `join_attempts`. Five wrong codes in 15 minutes
  raises `too_many_attempts`; a correct join clears the count. A wrong code returns `null` (not an error), because an
  error would roll the attempt back; the app turns that into "invalid code".
- **Deleting an account:** Settings → Delete my account calls `delete_account()`, which deletes the `auth.users` row; every
  table cascades from it. If the owner (the payer) leaves, the couple is dissolved: the partner keeps their account and
  preferences and can start or join another couple. If the partner leaves, the owner keeps the couple and can invite again.
  Once subscriptions exist, deleting must also tell the user to cancel in the App Store / Google Play.
- **Terms and Privacy:** draft text in `src/constants/legal.ts`, shown at `/legal/terms` and `/legal/privacy` (reachable
  signed out too). Fill in the operator name and support email and get it reviewed before submitting to the stores; the
  stores also need the privacy policy at a public URL (the landing page).

## Trial and access (paywall groundwork)

Decided rules: a 7-day free trial, then paid. When it ends without a subscription (or the payer cancels), the couple is
**locked, with data kept**: nobody can swipe or get new reveals, Home shows a "Paused" card (payer: "Your free trial has
ended", partner: "<payer>'s free trial has ended"), and preferences, history and recipes stay. Subscribing brings
everything back. Data is kept until the user deletes their account. Only the payer subscribes; the partner cannot take
over (if the payer deletes their account the couple dissolves, as before).

How it works (migrations 0034, 0035, 0039): `couples.trial_ends_at` and `couples.paid_until` (empty until a subscription
exists). The trial starts when the **partner joins**, and nothing is locked while the couple waits for its partner. It is
remembered **per person** (`profiles.trial_started_at`, not readable by the app): a new couple's trial ends 7 days after the
earliest start of its two people, so ending a couple and pairing up again does not give a fresh week, and a later partner
does not restart a running one. Deleting an account leaves one anonymous row in `account_deletions` so abuse can be
measured later: see `docs/trial-abuse.md`. A couple has access while `now()` is before either. `ensure_deck()` raises `subscription_required`
when it does not, which blocks the feed, swipes, early reveals and new queues for both partners; `get_couple_state()`
returns `has_access`. The app has no update policy on `couples`, so only a server-side process (the RevenueCat webhook,
to come) can write `paid_until`.

The payer sees "N days left in your free trial" on Home ("Last day" at the end). Not built yet: the subscribe button
and RevenueCat itself.

To test the lock locally: `update couples set trial_ends_at = now() - interval '1 day';` (and
`update couples set paid_until = now() + interval '30 days';` to pay), then reopen the app.

## Subscriptions (RevenueCat)

Plans are sold with RevenueCat; **the server decides who has access**. Flow: the payer taps "See plans" (on the Paused
card, or Settings → Subscription) → RevenueCat's paywall → after the purchase RevenueCat calls our webhook → the
function calls `apply_subscription_event()` (migrations 0036, 0037) → each product keeps its own expiry in
`couple_subscriptions` and `couples.paid_until` is the latest of them → the couple unlocks, partner included. Sandbox and
Test Store periods are shortened (monthly lasts about 5 minutes, yearly about an hour), so a test purchase expires and
the couple locks again on its own. The app waits for that for a few seconds after a purchase. A purchase with no expiry (not sold today) would set `paid_until` to `infinity`.

- **App side:** `src/lib/purchases.ts` (lazy-loaded SDK; does nothing without the key or on a build made before the SDK
  was added), `src/hooks/use-subscription.ts`. The customer is logged in with the Supabase user id. Entitlement:
  `dinner_roulette_pro`. Products: `monthly` (4.99) and `yearly` (49.99, about two months free), set up in the RevenueCat dashboard. There is no lifetime plan; the webhook still understands one (no expiry means never ends), in case it is added later.
- **Key:** `EXPO_PUBLIC_REVENUECAT_API_KEY` in `.env.local` (a `test_` key uses the Test Store). Use the real `appl_` and
  `goog_` keys for store builds.
- **The SDK is native:** rebuild the dev app once (`npx expo run:ios`, `npx expo run:android`).
- **Dashboard (once):** create the entitlement, attach the three products, make an offering with a paywall, enable the
  Customer Center, then Integrations (left menu) → Webhooks → Add new configuration: URL
  `https://<project>.supabase.co/functions/v1/revenuecat-webhook` and an Authorization header value of your choice.
- **Server secret:** `supabase secrets set REVENUECAT_WEBHOOK_SECRET=<the same value>` and
  `supabase functions deploy revenuecat-webhook`. Locally: put `REVENUECAT_WEBHOOK_SECRET=...` in
  `supabase/functions/.env` and run `supabase functions serve --env-file supabase/functions/.env`, then
  `curl -X POST http://127.0.0.1:54321/functions/v1/revenuecat-webhook -H 'Authorization: <secret>' -d '{...}'`.
  RevenueCat's dashboard can also send a test event.
- **Known limits:** a purchase made before the couple exists is not applied (the paywall only shows to payers with a
  couple). Events are matched to the user by id, so a purchase by an anonymous customer is ignored.

## Going live: sign-in email

Sign-in is a 6-digit code sent by email. Locally nothing is sent: the codes land in the Supabase test mailbox
(Inbucket, http://127.0.0.1:54324, set in `supabase/config.toml`). A hosted project needs a real sender, or users never
get a code.

1. **Pick an SMTP provider.** Resend, Postmark, Brevo, Mailgun, SendGrid or Amazon SES all work; most have a free tier
   that covers an early app. Compare current prices when you choose. Do not use the project's built-in sender in
   production: it has a very low hourly limit and, as far as we know, only delivers to the Supabase team's own addresses.
2. **Verify a domain you own** (for example `dinnerroulette.app`) with the provider and add the DNS records it gives you:
   SPF and DKIM, and DMARC if offered. Without them the codes tend to land in spam. Send from an address on that domain,
   such as `no-reply@yourdomain`.
3. **Connect it to the hosted project:** Supabase dashboard → Authentication → SMTP settings → enable custom SMTP, then
   fill in host, port, user, password, sender address and sender name. (The CLI can also push the commented
   `[auth.email.smtp]` block of `supabase/config.toml` with `supabase config push`; check the current CLI docs, and keep
   the password in an env var, never in the file.)
4. **Use the code template in the hosted project too.** Dashboard → Authentication → Email templates: set both
   "Confirm signup" (new users) and "Magic link" (returning users) to the text in `supabase/templates/otp.html`, which
   shows `{{ .Token }}`. With the default templates users get a link instead of a code, and the app has no screen for it.
5. **Check the limits.** Raise the project's emails-per-hour limit (Authentication → Rate limits) once custom SMTP is on.
   The code lifetime is `otp_expiry` (600 s = 10 minutes, and the template says so): if you change it, change the
   template text to match.
6. **Test with a real address** before launch: request a code on a real phone, with an address at a different provider
   (Gmail, iCloud, Outlook), and check it arrives quickly and not in spam.

## Community recipes

Anyone can submit a recipe (`submit_recipe`, migration `0023_community_recipes.sql`). It starts `pending` and is only
published (`approved`) after review: open the `recipes` table in Supabase Studio, filter `status = pending`, read it,
and change `status` to `approved` or `rejected` (put the reason in `review_note`). A recipe appears in queues built after
it is approved.

- **Authors write ingredients and steps only.** Everything the app filters on is derived from the ingredients by a
  trigger (`recipes_derive`) using rules in tables (`allergen_rules`, `diet_patterns`, `dish_family_rules`):
  `ingredient_names`, `category` (main ingredient), `dish_type`, `allergens`, `diet_flags`, `swaps`. Editing a recipe's
  title or ingredients in Studio re-derives them. The rules are ported from `scripts/mealdb/normalize.mjs`;
  `recipes.test.mjs` checks they reproduce the importer's output on the whole catalogue (except the three hand-corrected
  recipes in `overrides.mjs`). Change a rule in both places.
- **Each viewer's exclusions apply at query time**, exactly as for the catalogue: community recipes go through the same
  `build_deck` filters (diet, allergens, hard dislikes, free-text terms).
- **Limits:** 3 to 30 ingredients, 1 to 25 steps, no links, 5 submissions per day, 10 waiting for review. Terms must be
  accepted on the first submission (`profiles.terms_accepted_at`). Photos must live in the author's own folder of the
  `recipe-photos` bucket.
- **Report** (`report_recipe`): the reporter's couple stops seeing the recipe at once; three different reporters send an
  approved recipe back to `pending`. **Block** (`block_author`, takes a recipe so the app never handles another person's
  id): hides the author's recipes for the whole couple. It is refused for yourself and your partner, ignored when queues
  are built, and removed when two people pair up. Authors are never told.
- **Photos** (optional, last field of the form): the app crops to 4:3, resizes to at most 1600 px wide and saves a JPEG
  (`expo-image-picker` + `expo-image-manipulator`, which need a native rebuild), then uploads it when the recipe is
  submitted to the public `recipe-photos` bucket, into `<user id>/<random>.jpg` (migration `0025_recipe_photos.sql`: 3 MB,
  JPEG only; people can add, list and remove only their own folder). `submit_recipe` only accepts a URL inside the
  author's own folder. Files are removed through the Storage API when a recipe or account is deleted (SQL deletes are
  blocked by Storage). A photo is publicly readable by its URL even while the recipe is pending; to take one down, delete
  the file in Studio → Storage.
- Deleting an account deletes the recipes the person wrote.

## Starting over while testing

`npm run dev:reset -- you@example.com partner@example.com` wipes the app data of two test users in the **local**
database (couple, invite codes, decks, swipes, preferences, notices, display name) and keeps their accounts, so you can
walk the whole flow again without new sign-ups or waiting for tomorrow. Add `--dry-run` to see what it would remove,
`--keep-name` to skip the name screen, `--recipes` to drop their community recipes too. Put
`DEV_RESET_EMAILS=you@example.com,partner@example.com` in `.env.local` to run it with no arguments. Reopen the app
afterwards. It refuses to run if their couple includes a third account (override with `--force`).

`npm run dev:reset-day -- you@example.com` (any one member; or no arguments with `DEV_RESET_EMAILS`) puts the couple back
to "nobody has swiped today" in the **local** database, to replay the reveal cases (match, closest, surprise, swipe
again). It removes the couple's deck for the current cycle with its swipes and reveal views, plus any "started another
round" notice, and keeps accounts, couple and preferences. A fresh deck is built the next time they open the app, so
the dishes may differ. `--dry-run` shows what it would remove. Reopen the app on both phones afterwards.
