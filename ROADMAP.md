# Roadmap

Last updated: 2026-10-15. Tick items as they land. "Unverified" means not yet seen on a real device.

## Done
- [x] Couples, invites, preferences, swiping, matching
- [x] Reveal modes (scheduled and instant) with the match, closest, surprise fallback ladder
- [x] Swipe again (one extra round, only after closest or surprise)
- [x] Premium UI polish (16 tasks, code-complete; hand-test pending, see below)
- [x] `npm run dev:reset` (dry run only so far)
- [x] Buttons and form fields share one height (`ControlHeight` 50), unverified on a device

## Blocking a real launch
- [ ] 1. RevenueCat paywall (the "paid" part of the app; was planned right after the MVP)
- [ ] 2. Server push notifications (blocked on Apple and FCM credentials; today only a local reminder fires)
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
- [ ] 9. Ingredient share button
- [ ] 10. Notice to the partner when swipe again starts
- [ ] 11. Admin dashboard

## Parked on purpose
- Sign in with Apple (becomes an App Store requirement if other social logins are offered, so it may come back)
- Languages other than English (MVP is English only)

## Suggested order
6 and 8 first (bugs found on a device are cheapest now), then 3 and 4 (quick), then 1 (paywall), then 2 (push, once Apple and FCM accounts are ready).

## Housekeeping
- [ ] Delete `tasks/` once item 6 is done (copy any open items here first)
