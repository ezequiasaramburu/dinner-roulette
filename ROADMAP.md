# Roadmap

Last updated: 2026-10-17. "Hand-test pending" means built and checked by tests, not yet tried by you on a phone.

## Done and hand-tested

- [x] Couples, invites, preferences, swiping, matching
- [x] Reveal modes (scheduled and instant) with the match, closest, surprise fallback ladder
- [x] Swipe again (one extra round after closest or surprise), with a notice to the partner
- [x] Instant mode rework: the early reveal is offered on its own Home card once both have swiped half the deck with no match; daily swipe reminder (docs/instant-mode-plan.md)
- [x] Premium UI polish (16 tasks): press feedback, haptics, depth, skeletons, entrances; iOS and Android, light and dark, Reduce Motion
- [x] Android fixes (side menu, stats box, invite code field) and one shared height for buttons and form fields
- [x] Ingredient share button (shopping list of the unticked ingredients)
- [x] Dev tools: `npm run dev:reset`, `npm run dev:reset-day` (local database only)
- [x] Hosted test project on Supabase: migrations pushed, recipes loaded from `supabase/seed.sql` (the SQL editor works), the app runs against it on iOS and Android
- [x] Sign-in email on the hosted test project: custom SMTP through Resend with the verified domain `dinnerroulette.app` (DKIM, SPF, DMARC), the code template in "Confirm signup" and "Magic link", code length 6 and lifetime 10 minutes
- [x] RevenueCat paywall and Customer Center with the Test Store on iOS and Android, against the hosted backend: the purchase reaches the deployed webhook and unlocks the couple (README "Subscriptions (RevenueCat)")
- [x] Per-product subscription expiry (migration 0037): checked on hosted by sending a yearly event and a late monthly event; the late one is ignored and `paid_until` follows the latest expiry
- [x] Trial and access: the 7-day trial starts when the partner joins, is remembered per person, the payer sees "days left", locked couples see the Paused card, and the locked state also covers swiping and reading the reveal (migrations 0034, 0035, 0039)
- [x] Accessibility fixes (docs/accessibility-review.md): VoiceOver or TalkBack, largest text size, the two slightly changed greys
- [x] Weak-connection and error fixes (docs/connection-review.md): airplane-mode list passed, except sign-out (see below)
- [x] Partner-left notices sit below the page title (couple setup, invite)

## Built, hand-test pending

- [ ] Sign out on this device only (found in the airplane-mode test: it signed out but showed "Could not sign out"). Check offline sign-out from Settings and from the Home menu shows no alert, and that signing out on one phone leaves the other phone signed in
- [ ] Anonymous account-deletion log for spotting trial abuse (migration 0039, docs/trial-abuse.md): delete an account in the app and check the one anonymous row
- [ ] Database security pass (migration 0038, docs/security-review.md): the hosted flow ran on it, but check on purpose that saving your name and preferences, notices, your recipes and live updates all work
- [ ] Release setup (docs/release.md): CI (runs when a pull request is merged into main, not on a direct push) and the manual build workflow have not run yet, so expect small fixes on the first run
- [ ] App icon, Android themed icon and splash (tomato with the pizza slice; `node brand-assets/build-icons.mjs` rebuilds them, `brand-assets/play-store-512.png` is for the Play Console). Splash and Android icon were seen on the emulator; check the iOS icon, the themed icon on Android 13+, and the splash in dark mode. The website has its own copies in dinner-roulette-web

## Before launch: needs something from you or an outside account

- [ ] Separate launch project on Supabase: the current hosted project is a test project. Repeat for the launch project: link and `db push`, load `supabase/seed.sql`, SMTP and both code templates, code length 6 and 10 minutes, redirect URLs, the webhook function with its secret, and RevenueCat's webhook URL. Do not reuse the test project's data
- [ ] Release accounts and secrets: Expo account and `EXPO_TOKEN` in GitHub, `eas init`, EAS environment variables for the launch Supabase and the real RevenueCat keys, Apple Developer Program and Google Play Console (docs/release.md)
- [ ] Decide the bundle id before the first submission. It is `com.ezequias.dinnerroulette` today; with the new domain the conventional form is `app.dinnerroulette`. It cannot change after the first submission
- [ ] Paywall in the stores: create `monthly` (4.99) and `yearly` (49.99) in App Store Connect and Google Play, swap the Test Store key for the real `appl_` and `goog_` keys, then try a real sandbox or internal-testing purchase on both
- [ ] Public Terms and Privacy pages on `dinnerroulette.app` (a free static host such as GitHub Pages or Cloudflare Pages is enough); the paywall links need them
- [ ] Legal placeholders in `src/constants/legal.ts` (operator name and support email). Have someone qualified read the text
- [ ] A support address on the domain (`support@dinnerroulette.app`): Spacemail mailbox or forwarding to your own inbox. If it goes through Spacemail, keep a single DMARC record and keep Resend's records as shown
- [ ] Server push notifications (Apple developer account and FCM credentials; today only the local reminders fire)
- [ ] Crash reporting (a free Sentry-style account)
- [ ] A "you're offline" banner (needs the native NetInfo module, so add it with the next native rebuild)
- [ ] Tappable invite links: the link uses the app's own scheme today; an `https` link needs the domain and store configuration
- [ ] Check the hosted-project settings listed at the end of docs/security-review.md (rate limits including the emails per hour now that SMTP is custom, redirect URLs, backups, two-factor)

## Before launch: buildable now

- [ ] Privacy declarations draft for Apple's privacy labels and Google's data safety form (include the anonymous deletion log, purchase data and the email provider)

## After launch / later

- [ ] Admin dashboard: recipe review (show the photo link's host), trial and conversion numbers, subscription expiries per product (`couple_subscriptions`), and the trial-abuse queries in docs/trial-abuse.md. RevenueCat shows 0 trials because the trial is our own
- [ ] Switch to a store free trial if abuse turns out to be common (trigger described in docs/trial-abuse.md)
- [ ] Optional: a darker border for inputs (WCAG 3:1) and screen-reader announcements for live changes (docs/accessibility-review.md)
- [ ] Known low risks from the security review: photo link host not pinned, report abuse, no photo count limit
- [ ] Device limits per account, only if sharing a login turns out to be abused (today one login works on several phones, which is fine: access belongs to the couple)

## Parked on purpose

- Sign in with Apple (becomes an App Store requirement if other social logins are offered, so it may come back)
- Languages other than English (MVP is English only)
- A partner taking over paying when the payer leaves

## Suggested order

Re-check sign-out and the deletion log, then the outside items as accounts become available (launch project, Expo and store accounts, real RevenueCat keys, since they gate the paywall), the public pages and legal text on the new domain, the privacy draft, then the first CI and build runs, and the admin dashboard after launch.
