# Audit

Date: 2026-10-21. Scope: the mobile app in this repo (`dinner-roulette`). The website project (`dinner-roulette-web`) was not audited.

**What this repo does:** The React Native app for couples who swipe dishes privately and see their matches at a set time. It runs on Expo with a Supabase backend (database functions, an Edge Function webhook, storage) and RevenueCat for the subscription. Assumed load: a small launch, hundreds to a few thousand couples, with each couple's data only touched by two people at a time.

**What was read:** the couple, subscription, recipe and trial functions; the webhook; the delete-account flow; the recipe submit flow; the icon, release and CI files. No new tests were run for this audit. The 154 database tests and 55 unit tests passed on the same day.

Pick items by number ("do 2 and 3").

**Status (2026-10-23):** items 2 to 7 are done. Item 1 is done in the app: the operator is Raul Ezequias Aramburu (the legal name on the Google Play account) and the support email is `support@swipefordinner.app`. The website's legal pages must say the same.
- 2: the webhook now ignores events without an expiry date (test flipped).
- 3: the iOS fix is saved in `patches/expo-modules-jsi+57.1.2.patch` and applied by `patch-package` on `npm install`; `npm run ios` sets `EXPO_USE_PRECOMPILED_MODULES=0`. Drop the patch when you move to Expo SDK 58.
- 4 to 7: removed `reset-project`, `expo-device`, `expo-web-browser`, `react-native-web`, `react-dom`, the `web` script and block, the app favicon, the `@/assets/*` alias and the `HapticKind` export.

## Must fix

### 1. Legal text still has placeholders (`src/constants/legal.ts:4-5`)
- **What this is:** The in-app Terms and Privacy screens read the operator name and support email from these two lines.
- **Problem:** They are still `[Your name or company]` and `support@example.com` (with a `TODO`). Both stores need real legal pages, and the paywall links to this text. The website now uses `support@swipefordinner.app`, so the two already disagree.
- **Fix:** Put the real operator name and `support@swipefordinner.app` there (confirm the mailbox exists first). Do it together with the website's legal text, which is meant to stay in step.
- **If we skip it:** The first store review, or the first user, sees a placeholder address in the Terms.

## Should fix

### 2. A webhook event without an expiry date gives access forever (`supabase/functions/revenuecat-webhook/parse.ts:31`, test at `parse.test.mjs:20`)
- **What this is:** The webhook turns each RevenueCat event into "paid until this date".
- **Problem:** If an event has no expiry date, the code writes `infinity`, a lifetime purchase. The app sells only monthly and yearly plans, so a missing date is not a lifetime sale. Any event type that arrives without a date (for example a one-off or promotional grant) would unlock the couple permanently and could never be undone by a later renewal date.
- **Fix:** Ignore events with no expiry until a lifetime plan exists: `return null` in place of `'infinity'`, and flip the matching test. If a lifetime plan is added later, handle it by product id.
- **If we skip it:** One odd event gives a couple free access for good, and nothing in our data would show why.

### 3. The iOS build fix lives only in `node_modules` (`node_modules/expo-modules-jsi/apple/scripts/build-xcframework.sh`)
- **What this is:** One line was changed there so Xcode 27.1 can build the app (the interface cleanup now strips the `__ObjC::` syntax Swift 6.4 prints). Expo fixed the same thing in SDK 58 (`expo-modules-jsi` 58.0.4).
- **Problem:** `npm install` or `npm ci` overwrites it, and the iOS build fails again with the `__ObjC::expo` error. A new machine or a fresh clone hits it too. The build also needs `EXPO_USE_PRECOMPILED_MODULES=0` typed by hand each time.
- **Fix:** Save it as a patch with `patch-package` (one dev dependency plus a postinstall line), or move to an Expo SDK that has the fix. Keep the environment variable in a script so nobody forgets it.
- **If we skip it:** The next reinstall breaks local iOS builds, and the cause is not obvious. EAS cloud builds should not be affected (not confirmed which Xcode their image uses).

### 4. `npm run reset-project` can wipe the app (`package.json:61`, `scripts/reset-project.js`, 114 lines)
- **What this is:** A leftover from the Expo starter template.
- **Problem:** It moves or deletes `src/` and `scripts/` and replaces the app with a blank screen. One mistyped or autocompleted command does it. Git can bring it back, but only if everything is committed.
- **Fix:** Delete the file and the `package.json` line.
- **If we skip it:** A slip costs the uncommitted work, and a new person may run it out of curiosity.

## Nice to have

### 5. Two packages nothing uses (`package.json:18` and `:34`)
- **What this is:** `expo-device` and `expo-web-browser` came with the template.
- **Problem:** No file imports them and no other package needs them, yet each adds native code to every build.
- **Fix:** Remove both, then run a build once. `expo-device` is useful later for push notifications, so adding it back then is one line.
- **If we skip it:** A slightly bigger app and slower builds.

### 6. Web-only packages in a mobile-only app (`package.json:36`, `:46`, and the `web` block in `app.json`)
- **What this is:** `react-native-web` and `react-dom` exist for running the app in a browser (`npm run web`).
- **Problem:** Nothing in the product uses the web build, because the website is a separate project.
- **Fix:** If you never run the app in a browser, remove both, the `web` script and the `web` block. Keep them if you want the option.
- **If we skip it:** Nothing breaks. It is two extra dependencies.

### 7. Small leftovers (`tsconfig.json:9-11`, `src/lib/haptics.ts:41`)
- **What this is:** An `@/assets/*` path alias that no file uses, and an exported `HapticKind` type that no file imports.
- **Fix:** Delete both. About 6 lines.
- **If we skip it:** Nothing breaks.

Left out: about 15 more `export` keywords on names only used inside their own file. They are harmless.

## Verdict

The code is in good shape. Fix 1 before any store submission. Of the rest, do 2 and 3 first: one is a one-line change and the other is one small package.

**Lean:** -130 lines, -4 dependencies possible (items 4 to 7).

## Not checked

- The inside of the deck-building and reveal functions, beyond what their tests cover.
- Real behaviour on a device after the recent changes (subscribers-only recipes, the Video tag, icons).
- The hosted project's settings.
- The GitHub workflows (never run).
- Load beyond a few thousand couples.
- The website project (`dinner-roulette-web`).

## Known and accepted (from earlier reviews, not repeated above)

Photo link host not pinned, no photo count limit, report abuse, a partner taking over payment, no offline banner. They are listed in `ROADMAP.md` and `docs/security-review.md`.
