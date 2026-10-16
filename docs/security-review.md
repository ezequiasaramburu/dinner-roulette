# Database security review

Reviewed 2026-10-16 against the local database and the migrations up to 0037. Fixes are in migration 0038 and the tests
in `scripts/db-test/security.test.mjs`. Not independent: written and checked by the same person who built it, so treat it
as a first pass and have someone else look before a large launch.

## What was checked
Row-level security and policies on every table; table, column and function privileges for `anon` and `authenticated`;
`SECURITY DEFINER` functions (search path, who can run them); views; the realtime publication; storage bucket and
policies; the payment webhook; the auth settings in `supabase/config.toml`; the logic of the invite, swipe, recipe,
report and block functions.

## Good as found
- RLS is on for all 19 tables; the app writes through functions, not tables.
- Every `SECURITY DEFINER` function pins an empty `search_path`; internal helpers are not callable by app users.
- Invite codes use `gen_random_bytes` with no modulo bias; wrong codes are rate-limited (5 per 15 minutes).
- `submit_recipe` validates sizes and counts, blocks links, and caps submissions per day and in the review queue.
- Photos are limited to `image/jpeg`, 3 MB, and a user can only write into their own folder.
- The payment webhook refuses everything without its secret, and only the server role can unlock a couple.

## Fixed in 0038
| Finding | Risk | Fix |
|---|---|---|
| `anon` and `authenticated` held ALL privileges (including TRUNCATE) on every table, relying on RLS alone | A future table without RLS would be wide open; TRUNCATE ignores RLS | Revoked; the app keeps only the reads and writes it uses directly. New tables and functions are closed by default |
| A partner could read your whole profile row, including `push_token` | Leaks a device push token | Column grants: readable id, display_name, terms_accepted_at, locale, created_at; writable display_name only |
| Any column of your own profile was writable (`terms_accepted_at`) | Tampering with the terms record | Same column grants |
| Swiping, undoing and reading the reveal skipped the trial/paid check | A deck built earlier in the day stayed usable after the trial ended | The check now runs in `swipe_guard` and `get_reveal` too |
| Trigger functions were executable through the API | Harmless today, needless surface | Execute revoked (signup still works: tested) |
| Webhook compared its secret with `!==` | Timing leak (theoretical) | Constant-time comparison |
| Sign-in codes lived for 1 hour | A 6-digit code guessable for a long window | 10 minutes (`otp_expiry = 600` and the email text) |

## Left as is (known, low risk)
- **Recipe photo URL host is not pinned.** `submit_recipe` checks the path but not the host, so a user could point their own
  recipe at a picture on another site. Recipes are reviewed before anyone else sees them, so the admin dashboard should
  show the host. Pinning it needs the project's storage host as a per-environment setting.
- **Report abuse.** Three accounts can send any approved recipe back to review. It only costs the author a re-review.
- **Photo uploads have no per-user count limit** (only 3 MB each). Add a quota if abuse appears.
- **`recipe-photos` is a public bucket by design**: anyone with a link can view a photo. Listing is limited to your own folder.
- **A swipe on a dish already set aside in round two is accepted.** It only affects the person's own result.

## To check in the hosted project (cannot be seen from this repo)
- Auth → rate limits: emails per hour (raise it once custom SMTP is on), sign-ins and code verifications per IP.
- Auth → URL configuration: site URL and redirect URLs are your real ones, not `127.0.0.1`.
- Auth → email OTP length 6 and expiry 600 s; sign-ups on only through email; anonymous sign-ins off.
- The `service_role` key exists only as a function secret, never in the app or `.env.local`.
- Backups / point-in-time recovery switched on; two-factor on the Supabase and RevenueCat accounts.
- The webhook secret is long and random, and set on both sides.
- Objects created in the Supabase dashboard (as `supabase_admin`) keep the open default grants: create tables in migrations.
