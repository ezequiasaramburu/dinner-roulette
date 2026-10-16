# Spotting free-trial abuse

The trial is our own (7 days, no payment details), so someone can try to get it again. What is stopped today: ending a
couple and pairing up again (the trial is remembered per person). What is not: deleting an account and signing up again with
a new email, with both people new. We accepted that on purpose (the cost is small) and want numbers to know when it is not.

## What is recorded
- `profiles.trial_started_at`: when a person's first trial started. Lives as long as the account.
- `account_deletions`: one anonymous row per deleted account (no id, email or name): `deleted_at`, `was_owner`,
  `had_couple`, `trial_day` (days into their trial when they deleted, empty if none), `had_paid`.
- `couples.trial_ends_at`, `paid_until` and `couple_subscriptions`: trial and payment state per couple.

## Signals (queries for the admin dashboard, run with the service role)
Deletions around the end of a trial, per week. The abuse pattern is delete + sign up again, so this clusters on days 5 to 9:
```sql
select date_trunc('week', deleted_at) as week,
       count(*) as deletions,
       count(*) filter (where trial_day between 5 and 9 and not had_paid) as around_trial_end
from public.account_deletions group by 1 order by 1 desc;
```
Trials started per week, to compare against (a couple's trial starts when its partner joins):
```sql
select date_trunc('week', trial_ends_at - interval '7 days') as week, count(*) as trials_started
from public.couples where trial_ends_at is not null group by 1 order by 1 desc;
```
Conversion: couples whose trial ended, and how many paid.
```sql
select count(*) filter (where trial_ends_at < now()) as trials_ended,
       count(*) filter (where trial_ends_at < now() and paid_until is not null) as converted
from public.couples;
```
New pairs that got no trial because someone had used theirs (pairs formed locked or almost):
```sql
select count(*) from public.couples
where trial_ends_at is not null and trial_ends_at < created_at + interval '2 days' and paid_until is null;
```

## When to move to a store trial
Suggested trigger (adjust to your numbers): for two months in a row, deletions on days 5 to 9 are more than about 10% of
trials started, or more than 20 a week, and conversion stays low. One caveat: honest people also delete near the end of a
trial (they did not like it), so look at the trend and compare with `trial_ends_at` conversion before deciding. The signal
misses people who sign up again without deleting, so a flat deletion count does not prove there is no abuse.
Switching means selling plans with a store free trial (Apple and Google allow one per store account): the paywall wording
and where it appears change, the server side (webhook, paid periods) stays.
