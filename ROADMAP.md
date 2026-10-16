# Roadmap

Last updated: 2026-10-16. "Hand-test pending" means built and checked by tests, not yet tried by you on a phone.

## Done and hand-tested

- [x] Couples, invites, preferences, swiping, matching
- [x] Reveal modes (scheduled and instant) with the match, closest, surprise fallback ladder
- [x] Swipe again (one extra round after closest or surprise), with a notice to the partner
- [x] Instant mode rework: the early reveal is offered on its own Home card once both have swiped half the deck with no match; daily swipe reminder (docs/instant-mode-plan.md)
- [x] Premium UI polish (16 tasks): press feedback, haptics, depth, skeletons, entrances; iOS and Android, light and dark, Reduce Motion
- [x] Android fixes (side menu, stats box, invite code field) and one shared height for buttons and form fields
- [x] Ingredient share button (shopping list of the unticked ingredients)
- [x] Dev tools: `npm run dev:reset`, `npm run dev:reset-day`
- [x] RevenueCat paywall and Customer Center, tried with the Test Store on iOS: a purchase reaches the webhook and unlocks the couple (README "Subscriptions (RevenueCat)")



## Built, hand-test pending

- [x] Trial and access: the 7-day trial starts when the partner joins, is remembered per person, the payer sees "days left", locked couples see the Paused card, and the locked state also covers swiping and reading the reveal (migrations 0034, 0035, 0039)
- [ ] Anonymous account-deletion log for spotting trial abuse (migration 0039, docs/trial-abuse.md)
- [ ] Database security pass (migration 0038, docs/security-review.md): check especially that saving your name and preferences, notices, your recipes and live updates still work
- [x] Partner-left notices now sit below the page title (couple setup, invite)
- [ ] Per-product subscription expiry (migration 0037) after buying a second plan
- [ ] Weak-connection and error fixes (docs/connection-review.md): airplane-mode hand-test list is at the end of that file
- [x] Sign-in codes now last 10 minutes (restart local Supabase to load it)



## Before launch: needs something from you or an outside account

- [ ] Paywall in the stores: create `monthly` (4.99) and `yearly` (49.99) in App Store Connect and Google Play, swap the Test Store key for the real `appl_` and `goog_` keys, deploy the webhook function to the hosted project with its secret. Try a purchase on Android (only iOS has been tried)
- [ ] The paywall's Terms and Privacy links need public web pages
- [ ] Legal placeholders in `src/constants/legal.ts` (operator name and support email), plus a public page for the terms and privacy text. Have someone qualified read the text
- [ ] App icon and splash screen (still the defaults)
- [ ] Server push notifications (Apple developer account and FCM credentials; today only the local reminders fire)
- [ ] Go-live email: SMTP provider and a domain (README "Going live: sign-in email")
- [ ] Crash reporting (a free Sentry-style account)
- [ ] A "you're offline" banner (needs the native NetInfo module, so add it with the next native rebuild)
- [ ] Tappable invite links: the link uses the app's own scheme today; an `https` link needs a domain and store configuration
- [ ] Check the hosted-project settings listed at the end of docs/security-review.md (rate limits, redirect URLs, backups, two-factor)



## Before launch: buildable now

- [ ] Release setup: `eas.json` build profiles, versions and bundle ids in `app.json`, a short "how to ship a build" note
- [ ] Privacy declarations draft for Apple's privacy labels and Google's data safety form (include the anonymous deletion log and purchase data)
- [ ] Accessibility pass: screen-reader labels, text size, contrast (including the paywall buttons and the Paused card)



## After launch / later

- [ ] Admin dashboard: recipe review (show the photo link's host), trial and conversion numbers, subscription expiries per product (`couple_subscriptions`), and the trial-abuse queries in docs/trial-abuse.md. RevenueCat shows 0 trials because the trial is our own
- [ ] Switch to a store free trial if abuse turns out to be common (trigger described in docs/trial-abuse.md)
- [ ] Known low risks from the security review: photo link host not pinned, report abuse, no photo count limit



## Parked on purpose

- Sign in with Apple (becomes an App Store requirement if other social logins are offered, so it may come back)
- Languages other than English (MVP is English only)
- A partner taking over paying when the payer leaves



## Suggested order

Weak-connection check, then release setup and the privacy draft, then the outside items as the accounts become available (stores and RevenueCat keys first, since they gate the paywall), then the admin dashboard.