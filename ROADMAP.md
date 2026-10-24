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
- [x] Sign-in email on the hosted test project: custom SMTP through Resend with the verified domain `dinnerroulette.app` (DKIM, SPF, DMARC; to be redone on `swipefordinner.app`, see the rename item below), the code template in "Confirm signup" and "Magic link", code length 6 and lifetime 10 minutes
- [x] RevenueCat paywall and Customer Center with the Test Store on iOS and Android, against the hosted backend: the purchase reaches the deployed webhook and unlocks the couple (README "Subscriptions (RevenueCat)")
- [x] Per-product subscription expiry (migration 0037): checked on hosted by sending a yearly event and a late monthly event; the late one is ignored and `paid_until` follows the latest expiry
- [x] Trial and access: the trial (14 days since migration 0044, 7 before) starts when the partner joins, is remembered per person, the payer sees "days left", locked couples see the Paused card, and the locked state also covers swiping and reading the reveal (migrations 0034, 0035, 0039)
- [x] Accessibility fixes (docs/accessibility-review.md): VoiceOver or TalkBack, largest text size, the two slightly changed greys
- [x] Weak-connection and error fixes (docs/connection-review.md): airplane-mode list passed, except sign-out (see below)
- [x] Partner-left notices sit below the page title (couple setup, invite)

## Built, hand-test pending

- [x] Sign out on this device only (found in the airplane-mode test: it signed out but showed "Could not sign out"). Check offline sign-out from Settings and from the Home menu shows no alert, and that signing out on one phone leaves the other phone signed in
- [x] Anonymous account-deletion log for spotting trial abuse (migration 0039, docs/trial-abuse.md): delete an account in the app and check the one anonymous row
- [x] Database security pass (migration 0038, docs/security-review.md): the hosted flow ran on it, but check on purpose that saving your name and preferences, notices, your recipes and live updates all work
- [x] Sharing recipes only for subscribers (migration 0040, `src/components/recipes-locked.tsx`): apply the migration first (`supabase migration up` locally, `supabase db push` on the hosted test project). Check as the payer and as the partner, on the free trial, with a paid plan, and after it ends: the form only opens with a paid plan, and the other cases explain why
- [x] "Video" tag on swipe cards (migration 0041): apply it, then check a catalogue recipe with a video shows the tag at the right of the country row, and a recipe someone wrote never does
- [x] Dependencies trimmed and the iOS build fix saved as a patch (docs/audit.md): run `npm install`, `npx expo prebuild --clean`, then `npm run ios` and `npm run android` once, and check both still build and open
- [x] Tab bar and the Dinners tab (migrations 0042 and 0043, `get_dinner_history` and `get_history_recipe`): apply both first (`supabase migration up` locally, `supabase db push` on the hosted test project). Check the three tabs (Tonight, Dinners, Recipes) on iOS and Android, light and dark: the bar sits below the Start swiping button without a double gap, the side menu still opens from Tonight, the list shows 10 days with a "Show earlier dinners" button (no full recipes are loaded until you open one), a past dinner opens its recipe and shopping list, a locked couple sees the Paused card on Dinners, and after sending a recipe you land back on the Recipes tab (`dismissTo`), not on a second copy of the tabs
- [x] Swipe cards without the twitch (`src/components/dish/swipe-deck.tsx`): swipe several cards quickly by finger and with the Yum and Pass buttons, on iOS and Android, with Reduce Motion on and off. The next card should already be sitting at full size when the last one leaves, with no flash, and a second swipe should work while the first card is still flying away. Also check Undo and a swipe that fails offline (the card comes back)
- [ ] "You're offline" banner (`src/components/offline-banner.tsx`, NetInfo): needs `npm install`, `npx expo prebuild --clean` and a reinstall, since NetInfo is native. Turn on airplane mode on any screen: a dark pill "You're offline. Check your connection." appears at the top without blocking the back button, VoiceOver or TalkBack reads it, and it goes away when the connection is back. Also check it doesn't flash on launch
- [ ] 14-day free trial (migration 0044): apply it (`supabase migration up` locally, `supabase db push` on the hosted and launch projects). A new couple shows "14 days left in your free trial" on Home for the payer, and a couple already on a trial has 7 more days. Deploy the website too: its pricing section and FAQ read the trial length from `trialDays`
- [ ] Closed test on Google Play (docs/closed-test.md): run `scripts/test-partners.sql` on the launch project after its migrations, send the codes to testerscommunity with the email in that doc, and remove the test partners after the test
- [ ] Reviewer account (docs/closed-test.md, `scripts/review-account.sql`): create `review@swipefordinner.app` with a password in the dashboard, run the script, then check on a phone that this address asks for a password (not a code), lands on Home paired with Sam, can swipe, and shows five past dinners. Every other address must still get a code
- [ ] Release setup (docs/release.md): CI (runs when a pull request is merged into main, not on a direct push) and the manual build workflow have not run yet, so expect small fixes on the first run
- [x] App icon, Android themed icon and splash (tomato with the pizza slice; `node brand-assets/build-icons.mjs` rebuilds them, `brand-assets/play-store-512.png` is for the Play Console). Splash and Android icon were seen on the emulator; check the iOS icon, the themed icon on Android 13+, and the splash in dark mode. The website has its own copies in dinner-roulette-web (now the Swipe for Dinner site)

## Before launch: needs something from you or an outside account

- [x] Separate launch project on Supabase: the current hosted project is a test project. Repeat for the launch project: link and `db push`, load `supabase/seed.sql`, SMTP and both code templates, code length 6 and 10 minutes, redirect URLs, the webhook function with its secret, and RevenueCat's webhook URL. Do not reuse the test project's data
- [ ] Release accounts and secrets: Expo account and `EXPO_TOKEN` in GitHub, `eas init`, EAS environment variables for the launch Supabase and the real RevenueCat keys, Apple Developer Program and Google Play Console (docs/release.md)
- [x] Name decided: Swipe for Dinner, domain `swipefordinner.app`, bundle id and Android package `app.swipefordinner` (cannot change after the first submission)
- [x] Finish the rename on the outside services: verify `swipefordinner.app` in Resend (DKIM, SPF, DMARC) and set the sender on the hosted Supabase SMTP, paste the new `supabase/templates/otp.html` into "Confirm signup" and "Magic link" with the subject "Your Swipe for Dinner code", rename the RevenueCat and Supabase projects (names only; `dinner_roulette_pro` stays as the entitlement id), and update the Apple Sign in client id if it is ever turned on
- [x] Pricing decided (2026-10-23): keep the monthly plan and the yearly plan as they are, and push the yearly plan. The free trial became 14 days on 2026-10-24 (migration 0044), matching the 14-day Google Play closed test. Pushing it is set in the RevenueCat paywall, not in code: show the yearly package first and preselected, with a "best value / about four months free" label (39.99 against 59.88 for twelve monthly payments). The yearly price is 39.99 and must be the same in the app, the stores and the website
- [ ] Paywall in the stores: create `monthly` (4.99) and `yearly` (39.99) in App Store Connect and Google Play, swap the Test Store key for the real `appl_` and `goog_` keys, then try a real sandbox or internal-testing purchase on both
- [x] Public Terms, Privacy and account-deletion pages, live and matching the app (checked 2026-10-24): https://www.swipefordinner.app/terms, /privacy and /delete-account. Use these URLs in the RevenueCat paywall, App Store Connect (privacy policy URL) and the Play Console (privacy policy and the data-deletion URL). When the legal text changes, change it in the app and on the site together
- [x] Legal text in `src/constants/legal.ts`: operator name and support email are filled in; keep the website's legal pages identical, and have someone qualified read the text. Apple's account may need the same legal name
- [x] A support address on the domain (`support@swipefordinner.app`; the in-app Terms and Privacy already show it): Spacemail mailbox or forwarding to your own inbox. If it goes through Spacemail, keep a single DMARC record and keep Resend's records as shown
- [ ] Reviewer access for both stores (approach in docs/apple-testing.md): a password sign-in for one review address, already paired with a test partner, paid and with past dinners. Needed before the first review, the Google closed-test release included
- [ ] App Store later (docs/apple-testing.md): Paid Applications Agreement, Small Business Program, TestFlight, App Review checks
- [ ] Server push notifications (Apple developer account and FCM credentials; today only the local reminders fire)
- [ ] Crash reporting (a free Sentry-style account)
- [ ] Tappable invite links: the link uses the app's own scheme today; an `https` link needs the domain and store configuration
- [ ] Check the hosted-project settings listed at the end of docs/security-review.md (rate limits including the emails per hour now that SMTP is custom, redirect URLs, backups, two-factor)

## Before launch: buildable now

- [x] Privacy declarations draft for Apple's privacy labels and Google's data safety form: docs/privacy-declarations.md. Still yours: read it against the forms, decide the allergy answer, and submit

## After launch / later

- [ ] Admin dashboard: recipe review (show the photo link's host), trial and conversion numbers, subscription expiries per product (`couple_subscriptions`), and the trial-abuse queries in docs/trial-abuse.md. RevenueCat shows 0 trials because the trial is our own
- [ ] Switch to a store free trial if abuse turns out to be common (trigger described in docs/trial-abuse.md)
- [ ] Optional: a darker border for inputs (WCAG 3:1) and screen-reader announcements for live changes (docs/accessibility-review.md)
- [ ] Known low risks from the security review: photo link host not pinned, report abuse, no photo count limit
- [ ] Device limits per account, only if sharing a login turns out to be abused (today one login works on several phones, which is fine: access belongs to the couple)

## Parked on purpose
- Load testing (decided 2026-10-23): not before launch. The test project shows 6 of 200 peak Realtime connections and under 1% of every other quota, and the first month will not reach 200 phones online at once. Look again, and write a script that creates couples through the admin API against a throwaway project, when the dashboard shows more than about 100 concurrent connections, around 100 couples, or slow reveals at the shared reveal time. The likely first bottleneck is the reveal spike (everyone fetches the reveal at the same minute)
- Before real users on the launch project, check on Supabase's Plans page whether a free project pauses when idle and whether backups are included; both can matter more than traffic

- Sign in with Apple (becomes an App Store requirement if other social logins are offered, so it may come back)
- Languages other than English (MVP is English only)
- A partner taking over paying when the payer leaves

## Suggested order

Re-check sign-out and the deletion log, then the outside items as accounts become available (launch project, Expo and store accounts, real RevenueCat keys, since they gate the paywall), the public pages and legal text on the new domain, the privacy draft, then the first CI and build runs, and the admin dashboard after launch.
