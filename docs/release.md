# Shipping a build

What exists: `eas.json` (two build profiles), `.github/workflows/ci.yml` (checks once a pull request is merged into main; a direct push does not run it) and
`.github/workflows/build.yml` (a manual build button). None of the workflows has run yet: the first run may need small
fixes. Native folders (`ios/`, `android/`) are not committed; every build generates them from `app.json`.

## The two build routes
| | Where it builds | Where the file ends up | Good for |
|---|---|---|---|
| **EAS cloud** (default) | Expo's servers | On expo.dev: Builds, then the build page (download link, QR code for installing). The workflow log prints the link | iOS (needs a Mac and signing, which EAS handles), and store builds |
| **Android on the GitHub runner** (tick "android_artifact") | A GitHub machine | On the workflow run page, under **Artifacts** (a zip with the APK), kept 14 days. Free storage is 500 MB | Quick Android test builds without using the EAS monthly quota |

An iOS file (IPA) cannot be built on GitHub's free setup in a practical way: it needs a macOS runner (billed at about 10 times
the Linux minutes on a private repo) plus certificates and provisioning profiles. Let EAS do iOS.

**Profiles:** `preview` = an installable test build (Android APK, iOS internal/ad hoc); `production` = the store build
(Android app bundle for Google Play, iOS for App Store Connect and TestFlight), version numbers bumped automatically.

## What you need
**Accounts**
- Expo account (free): the build service. The free plan includes a limited number of low-priority builds a month
  (see expo.dev/pricing for the current number).
- Apple Developer Program (99 USD a year): needed for any iPhone install outside the simulator, TestFlight and the App Store.
  There is no IPA without it.
- Google Play Console (25 USD once): for Play. An APK for your own phone needs nothing.
- GitHub: the free account is enough. Private repo: 2,000 Actions minutes a month; public repo: free.

**One-time setup (on your computer)**
```bash
npm install -g eas-cli
eas login
eas init                    # links the project to your Expo account and writes the project id into app.json: commit that
```
Then make a token for GitHub: expo.dev, Account settings, Access tokens, create one. In the GitHub repo: Settings, Secrets
and variables, Actions, new repository secret named `EXPO_TOKEN`.

**Environment values for the builds.** `.env.local` is not in git, so cloud builds do not see it. The app reads these at build
time (they are public values, never put the `service_role` key here):
```bash
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://YOUR-PROJECT.supabase.co --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value YOUR-ANON-KEY --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value appl_xxx --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_REVENUECAT_ANDROID_KEY --value goog_xxx --visibility plaintext
```
Repeat with `--environment preview` (pointing at a test project, or the same one). A `test_` RevenueCat key is ignored in a
release build on purpose, so purchases stay off instead of crashing.

## Running a build
- **From GitHub:** Actions tab, Build, Run workflow, pick platform and profile. To also get an Android APK as a GitHub file,
  tick the box (preview only).
- **From your computer:** `eas build --platform android --profile preview` (or `ios`, `all`, `--profile production`).
- First iOS build: EAS asks for your Apple login once and creates the certificates and profiles for you. Run it from your
  computer, not from Actions, so you can answer the prompts.
- Installing a preview build: open the build page on expo.dev on the phone (Android downloads the APK; iOS needs the device
  registered first with `eas device:create`).

## Versions
`version` in `app.json` is the number people see (change it by hand for a release). The build number (iOS) and version code
(Android) count up by themselves on `production` builds (`appVersionSource: remote`).

## Before the first store build
1. App icon and splash (still the defaults), legal text and public Terms and Privacy pages.
2. Hosted Supabase project: link it (`supabase link`), push the migrations (`supabase db push`), deploy the webhook function
   and set its secret (README "Subscriptions (RevenueCat)"), custom email sending, and the hosted settings in
   `docs/security-review.md`.
3. RevenueCat: real store products and keys (above), and the webhook pointing at the hosted function.
4. **The bundle id is `app.swipefordinner` on both stores.** It cannot be changed after the first submission, so
   decide now whether you want it (a company name instead of your own, for example).
5. Privacy declarations for the App Store and Play (see the roadmap) and store screenshots and text.
6. Submit with `eas submit --platform ios` / `android` once the store accounts and their keys exist (not set up here).

## Not set up on purpose
- Over-the-air updates (`expo-updates`): every change goes through a store build for now.
- Automatic builds on every push: they would eat the free quota. Use the manual button.
- Submitting to the stores from CI.
