# Google Play closed test

The closed test needs at least 12 testers for 14 days in a row. Testers come from testerscommunity.com and are strangers,
so each one pairs with a ready-made **test partner** instead of a real person.

## Before sending the codes

1. The build in the closed track must point at the **launch** Supabase project, with every migration applied
   (`supabase db push` on the launch project, up to 0044).
2. Run `scripts/test-partners.sql` in that project's SQL editor. It prints 20 unused codes (valid 60 days).
3. Send the email below with those codes.

## How a test partner behaves

- It owns the couple, has finished its food preferences (open to everything) and never swipes.
- The reveal is scheduled at 17:00 UTC (the app shows it in the tester's own time; either partner can change it in
  Settings). With a partner that never swipes, the reveal shows the dishes the tester liked ("One of you liked"), or our
  pick when they liked nothing.
- The 14-day trial starts when the tester joins. The partner is the payer, so the tester never sees a purchase flow, and
  sharing a recipe shows the "subscribers only" explanation.
- Each code works once. A used code says "That code is invalid or has expired". Five wrong codes in 15 minutes locks
  joining for a while, so one code per tester is better than a shared list.

## Email to support@testerscommunity.com

```text
Subject: Invite codes for my closed test (Swipe for Dinner)

Hi,

As discussed in the chat, my app pairs two people with an invite code. So testers don't need to coordinate,
I've prepared ready-made test partners. Each tester signs in with their own email and joins one of them.

My preference: one unique code per tester (each code works only once). If you can only send one shared
instruction set, please include the full list and tell testers to pick a code at random, and to try another one
if the app says the code is invalid (someone else used it).

Codes (valid until <date>):
<20 codes, one per line>

Instructions for testers:
1. Install Swipe for Dinner from the Google Play testing link and open it.
2. Tap "Continue with email", enter your email, then the 6-digit code we email you.
3. Enter your first name and tap Continue.
4. Tap "Join with a code" (not "Start a couple") and enter your invite code: <CODE>.
5. Choose your food preferences and save.
6. Every day: tap Start swiping and swipe right on dishes you'd eat, left on the ones you wouldn't.
   The day's dinner is revealed at the time shown on Home (you can change it in Settings).
7. Open the reveal, a recipe, "Share shopping list" and the Dinners tab.
Your partner is a test account named "Test partner": it never swipes, so the reveal shows the dishes you liked.

Thanks!
<your name>
```

## Reviewer access (Google now, Apple later)

Every closed-test release is reviewed, and the reviewer cannot receive a sign-in code. One address signs in with a
password instead: `review@swipefordinner.app` (the email screen asks it for a password; see `src/app/(auth)/email.tsx`).

1. Supabase dashboard > Authentication > Users > Add user > Create new user: that email, a long random password,
   "Auto Confirm User" ticked. Also check Authentication > Sign In / Providers > Email > "Confirm email" is on.
2. Run `scripts/review-account.sql` in the SQL editor. The reviewer becomes "Alex", paired with "Sam" (never swipes),
   with a paid year and five past dinners. The reveal is at 23:59 UTC, so the swipe queue is open nearly all day.
3. Play Console > App content > App access > "All or some functionality is restricted" > add instructions:

```text
Sign in: tap "Continue with email", enter review@swipefordinner.app, then the password below
(this account uses a password instead of the emailed code).
Password: <password>
The account is already paired with a partner. Swipe dishes from Home (Start swiping), see past dinners and their
recipes in the Dinners tab, and today's dinner is revealed at the time shown on Home.
```

## After the test

Remove the test partners (this also ends the testers' couples), in the same SQL editor:

```sql
delete from auth.users where email like 'test-partner-%@swipefordinner.app';
```
