# Privacy declarations (draft)

Answers for Apple's App Privacy labels (App Store Connect) and Google's Data safety form (Play Console), based on what the app does on 2026-10-23. Not legal advice: read each answer against the form's own wording before you submit, and keep this file in step with `src/constants/legal.ts` and the website's Privacy page.

## The short version

- No advertising, no analytics, no crash reporting, no tracking across other companies' apps or sites. Nothing is sold.
- Apple: "Data Not Used to Track You". Do not add the tracking prompt.
- Everything is encrypted in transit (HTTPS). Account deletion is in the app (Settings) and on the website (`/delete-account`).
- Three outside services handle data for us, not for their own use: Supabase (database and photo storage), RevenueCat (subscription status) and Resend (sign-in emails). Apple and Google handle the payment.

## What is collected

| Data | Where it comes from | Why | Linked to the person | Apple category | Google category |
|---|---|---|---|---|---|
| Email address | Sign-in | Sign in, account | Yes | Contact Info: Email Address | Personal info: Email address |
| First name | Onboarding | Shown to the partner | Yes | Contact Info: Name | Personal info: Name |
| Account id (Supabase user id, also used as the RevenueCat customer id) | Created at sign-up | App functionality | Yes | Identifiers: User ID | Personal info: User IDs |
| Food preferences, allergies, dislikes, swipes, couple settings | The person | Matching, filtering dishes | Yes | User Content: Other User Content | App activity: Other user-generated content (see the note on allergies) |
| Recipes and recipe photos the person submits | The person | Shared with other users after review | Yes | User Content: Photos or Videos, Other User Content | Photos and videos: Photos; App activity: Other user-generated content |
| Purchase status (plan, expiry) | RevenueCat and the stores | Unlock the couple | Yes | Purchases: Purchase History | Financial info: Purchase history |
| Reports and blocks on other people's recipes | The person | Safety | Yes | User Content: Other User Content | App activity: Other user-generated content |

Not collected today: precise or coarse location, contacts, browsing or search history, health records, device id, advertising id, diagnostics, crash logs. The `push_token` column exists in the database, but nothing writes to it yet.

## Notes on the answers

- **Allergies and diet.** They are food preferences, not medical records, and the Privacy text says so. A cautious reviewer may still read "allergies" as health data. If you want the safest answer, also tick Apple "Health & Fitness: Health" and Google "Health info", and say the purpose is app functionality only. Decide once and keep it consistent.
- **Data shared with third parties.** Google excludes service providers that process data only for us, which covers Supabase, RevenueCat and Resend. Apple's labels have no "shared" column. If a reviewer pushes back, name the three above as processors.
- **Photo hosting by TheMealDB.** Catalogue photos load from their servers, so their servers see the phone's IP address. We send them nothing else. This is disclosed in the Privacy text.
- **Public photo links.** Recipe photos are in a public storage bucket, so anyone with a link can open one. Disclosed in the Privacy text. Mention it in the Google form's description if there is a free-text field.
- **Anonymous deletion record.** One row with no id, email or name stays after deletion (date, was in a couple, trial day, ever paid). It is not personal data, so it needs no label. It is disclosed in the Privacy text.
- **Retention.** Kept while the account exists; deleted when the person deletes the account.

## Account deletion (both stores require it)

- In the app: Settings, Delete account. It removes the profile, preferences, swipes, notices, recipes and uploaded photos, and ends the couple if the person created it.
- Google also needs a web page with the steps. `https://www.swipefordinner.app/delete-account` exists; paste it into the Data safety form. Check that it mentions the uploaded photos and the anonymous record, as the Privacy text now does.
- The store subscription is not cancelled by deletion. The app says so before deleting.

## Change this file when

- Crash reporting or analytics is added (Sentry and similar): add Diagnostics, and update the Privacy text.
- Server push is added: add Device ID (the push token) and update the Privacy text.
- A second email, payment or storage provider is added.
- The admin dashboard starts reading anything beyond `account_deletions` and recipe review.
