# Android production build (EAS)

The production build talks to the hosted Supabase project (it is production). Nothing from `.env.local` reaches EAS:
the build reads its variables from EAS's "production" environment (`eas.json` > build > production > environment).

## Once

```bash
npm install -g eas-cli
eas login
eas init
```

`eas init` writes the project id and owner into `app.json`; commit that.

Environment variables (values from Supabase > Project Settings > API; the anon key is public by design):

```bash
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://<project-ref>.supabase.co --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon key> --visibility plaintext
```

Later, when the products exist in Play Console and RevenueCat: add `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` (the `goog_`
key) the same way and build again. Without it the build works and simply says plans are not available yet.

## Each release

```bash
eas build --platform android --profile production
```

- First time: let EAS generate the Android keystore (it keeps it; do not lose access to the Expo account).
- The result is an `.aab` (Play needs that, not an APK). Download it from the link EAS prints.
- Play Console > Testing > Closed testing > your track > Create new release > upload the `.aab`, add release notes,
  then send the changes for review (Publishing overview).
- The version code goes up by itself (`appVersionSource: remote`, `autoIncrement`). Change `version` in `app.json`
  for a user-visible version bump.

## Before the first upload, on the production database

- Migrations up to 0044 (`supabase db push`) and the webhook redeployed (`supabase functions deploy revenuecat-webhook`).
- Authentication > Sign In / Providers > Email > "Confirm email" on.
- The reviewer account and `scripts/review-account.sql` (docs/closed-test.md).
- `scripts/test-partners.sql` can wait until the release is approved.
