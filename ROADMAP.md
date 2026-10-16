# Roadmap

Last updated: 2026-10-15. Tick items as they land. "Unverified" means not yet seen on a real device.

## Done
- [x] Couples, invites, preferences, swiping, matching
- [x] Reveal modes (scheduled and instant) with the match, closest, surprise fallback ladder
- [x] Swipe again (one extra round, only after closest or surprise)
- [x] Premium UI polish (16 tasks, code-complete; hand-test pending, see below)
- [x] `npm run dev:reset` (dry run only so far)
- [x] `npm run dev:reset-day` (reset today's swipes and matches for a couple; dry run only so far)
- [x] Buttons and form fields share one height (`ControlHeight` 50), unverified on a device

## Blocking a real launch
- [ ] 1. RevenueCat paywall (the "paid" part of the app; was planned right after the MVP)
  - Decisions so far: 7-day free trial; keep the single "Continue with email" sign-in as it is (no separate login and signup, first screen unchanged); the payer sees the paywall at couple setup; the invited partner joins on the payer's subscription and never sees it
  - The paywall shows the trial length, the price after the trial, how to cancel, and a "Restore purchases" button
  - [x] Trial-end rules decided: locked with data kept (payer and partner both paused), data kept until the user deletes the account, only the payer subscribes (no partner take-over for now)
  - [x] Groundwork built (migration 0034, "Paused" card on Home; see README "Trial and access"): `trial_ends_at`, `paid_until`, `subscription_required`
  - [x] RevenueCat integrated in code (paywall, Customer Center, entitlement `dinner_roulette_pro`, webhook that sets `paid_until`, deletion note): see README "Subscriptions (RevenueCat)". Unverified on a device
  - [ ] Yours to do: rebuild the dev app (native SDK), set up the entitlement, products, offering and paywall in the RevenueCat dashboard, add the webhook URL and secret, deploy the function. Real store keys (`appl_`, `goog_`) before release
  - [x] Trial remembered per person, anonymous deletion log (migration 0039); abuse monitoring in the admin dashboard, see docs/trial-abuse.md
- [x] The trial starts when the partner joins (migration 0035), and the payer sees a "days left" line on Home (unverified on a device)
- [ ] 2. Server push notifications (blocked on Apple and FCM credentials; today only a local reminder fires)
- [ ] Go-live email: pick an SMTP provider, verify a domain, connect it in Supabase (steps in the README, "Going live: sign-in email")
- [ ] 3. Legal placeholders: operator and contact values in `src/constants/legal.ts`
- [ ] 4. App icon and splash screen (still the defaults)
- [ ] 5. Android native rebuild check (`expo run:android` with `expo-haptics` and `expo-linear-gradient`)

## Needs a hand-test (you, on a real phone)
- [ ] 6. Polish hand-test: iOS and Android, light and dark, Reduce Motion on and off. Open questions:
  - [ ] Gradient strength (about 6% lighter at the top of the primary button)
  - [ ] Compact button size for tight inline text actions: yes or no
  - [ ] Duplicate screen after `router.replace('/')` or `router.replace('/recipes')` (fix would be `router.dismissTo`)
  - [ ] Smoothness on a mid-range Android
- [ ] 7. First real (non-dry) `npm run dev:reset -- one@example.com two@example.com`
- [ ] 8. Android fixes, unverified: side menu fits without scroll, smaller stats box text, invite code cursor (if still on the right, make the code field left-aligned on both platforms)
- [ ] Form field heights: add-recipe form, Preferences allergy and dislike fields next to Add, Android time picker

## Small features (only if wanted)
- [x] 9. Ingredient share button (shares the unticked ingredients as a shopping list; unverified on a device)
- [x] 10. Notice to the partner when swipe again starts (unverified on a device)
- [ ] 11. Admin dashboard. Include trial and conversion tracking (we run our own 7-day trial, so RevenueCat shows 0 trials): couples in trial (`trial_ends_at` in the future), trials ended, paid (`paid_until`), conversion rate, and subscription expiries per product (`couple_subscriptions`)

## Security
- [x] Database security pass (docs/security-review.md, migration 0038). Left as known low risks: photo URL host not pinned, report abuse, no photo count limit
- [ ] Check the hosted-project settings listed at the end of docs/security-review.md before launch

## Instant mode rework (built, hand-test pending)
Plan in [docs/instant-mode-plan.md](docs/instant-mode-plan.md).
- [x] Remove the early "Reveal with what we have" shortcut; offer it on a separate Home card once both have swiped half the deck with no match
- [x] Swipe reminder for instant mode (local notification at a time the person chooses)
- [x] Confirm the open points in the plan (reminder time, card wording, where the offer shows)

## Parked on purpose
- Sign in with Apple (becomes an App Store requirement if other social logins are offered, so it may come back)
- Languages other than English (MVP is English only)

## Suggested order
6 and 8 first (bugs found on a device are cheapest now), then 3 and 4 (quick), then 1 (paywall), then 2 (push, once Apple and FCM accounts are ready).

## Housekeeping
- [ ] Delete `tasks/` once item 6 is done (copy any open items here first)
