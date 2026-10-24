# Testing and review on the App Store (for later)

Parked until there is a paid Apple Developer account (individual). Written 2026-10-24; check Apple's current pages when
you start, because the terms change.

## How it differs from Google Play

- No minimum testers and no waiting period: a personal account can submit as soon as the app is ready.
- Every version goes through App Review (usually a day or two). A rejection says why; fix it and resubmit.
- Testing is optional, through TestFlight:
  - internal testers (people added to your App Store Connect team, up to 100): no review, builds arrive right away;
  - external testers (anyone, by email or a public link): the first build of a version gets a short beta review.

## Before anything can be sold

1. Accept the **Paid Applications Agreement** in App Store Connect (Business section) and fill in the bank account and
   the tax form (a W-8BEN for someone outside the US). Until it shows "Active", subscription products don't load, not even
   in sandbox, and the RevenueCat paywall shows nothing.
2. Apply to the **App Store Small Business Program** (15% commission instead of 30% under 1 million USD a year).
3. Answer the **EU trader** question: a paid app makes you a trader, so your address, phone and email are shown on the
   App Store page.

## The review problem, and the approach

Sign-in is an emailed code, and the app needs a partner. A reviewer has neither the mailbox nor a partner, so without
help they stop at the sign-in or the invite screen. Same problem as Google, same answer for both stores:

- **A reviewer account with a password.** One address only (for example `review@swipefordinner.app`): the email screen
  shows a password field for it instead of sending a code. Everyone else is unchanged. Real users have no password, and
  a password sign-up still needs the confirmation email, so this opens no shortcut. Create the user in the Supabase
  dashboard (Authentication > Users > Add user, "Auto confirm") with a long random password, and enter the email and
  password under **App Review Information** in App Store Connect.
- **Already paired and paid.** A script (like `scripts/test-partners.sql`) pairs the reviewer with a test partner,
  finishes the preferences, gives the couple a paid period and adds a few past dinners, so every screen has something
  to show. Put a note in the review notes: "The partner is a test account that never swipes; the reveal shows the dishes
  you liked."
- Not built yet (decided 2026-10-24). Build it before the first submission to either store.

TestFlight testers who are strangers can use the test partners exactly as in the Google closed test
(`docs/closed-test.md`).

## What App Review checks for this app

- **Account deletion inside the app**: done (Settings).
- **Subscriptions**: the paywall shows the price and the renewal period, has Restore purchases (RevenueCat's paywall
  does), and links to the Terms and Privacy pages (`https://www.swipefordinner.app/terms` and `/privacy`). Add the
  Terms link (or Apple's standard EULA) to the App Store description too.
- **Privacy labels and privacy policy URL**: `docs/privacy-declarations.md`.
- **Sign in with Apple**: not required while email is the only sign-in. If Google sign-in is added, Apple requires Sign
  in with Apple as well (steps in `docs/apple-sign-in.md`); add both together.
- **Encryption**: `ios.config.usesNonExemptEncryption` is already `false` in `app.json`.

## Build and submit

1. `eas build --platform ios --profile production` (EAS picks the signing certificate and profile; the bundle id is
   `app.swipefordinner`).
2. `eas submit --platform ios`, or upload from EAS to App Store Connect.
3. In App Store Connect: create the subscription group with `monthly` (4.99) and `yearly` (39.99), attach them to the
   `dinner_roulette_pro` entitlement in RevenueCat, and put the real `appl_` key in the EAS environment variables.
4. Try a sandbox purchase through TestFlight before submitting for review.

The local Xcode 27.1 patch (`patches/expo-modules-jsi+57.1.2.patch`) only matters for building on your Mac; EAS builds
on its own machines.
