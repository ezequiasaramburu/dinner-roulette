# Instant mode: remove the early-reveal shortcut, add a "half the deck" offer and a swipe reminder

Status: built (migration 0031, offer card, instant-mode reminder); hand-test pending. Decided in chat on 2026-10-15. Open points settled: reminder 14:00, the card wording as drafted, offer on Home only. Not built: skipping the reminder when the person already swiped (a local notification cannot know); the card has no extra "Keep swiping" button because Home's footer already has one.

## Why

"Reveal with what we have" was added as an escape hatch because instant mode has no clock: without it, a couple who
does not match would have to swipe all 100 dishes to get an answer. But it can be tapped after one swipe (a 15-swipe
minimum was added as a patch, migration 0030), which ends the day's game early. Scheduled mode never needed it: the
reveal time arrives and the fallback ladder (match, closest, surprise, none) resolves the day by itself.

## The rules

**Instant mode reveals when:**
1. They match (the match goal is reached): regular flow, the top card on Home changes. No button.
2. Both have been through every dish: reveal with the fallback ladder (as today).
3. **New:** both have swiped at least half of the dishes they can swipe, with no match. Home then shows a separate
   offer card (not the swipe prompt):
   - Wording (draft): "You've swiped half of today's dishes with no match yet. Want to see the best of what you liked?"
   - Main button: "Reveal with what we have". Quiet button: "Keep swiping".
   - Tapping the main button reveals for both (the existing confirmation alert stays, since it ends the day).

**Nothing swiped at all:** no reveal, no result. Not a gap by itself, but instant couples get no nudge today, so:

**New: a swipe reminder for instant mode.** A local notification on each phone at a time that person chooses (default
14:00), "Time to find tonight's dinner". Local only, no server and no Apple/FCM setup. Settings gets the time, next to
the existing "Remind me on this phone" switch. Scheduled mode keeps its reveal-time reminder.

**Swipe again** stays as it is (once, only after closest or surprise, reveals the instant way). It now also needs a
natural end, so the same half-the-deck offer applies to round two, counted on the dishes left for that round.

## Details settled

- "Half" = half of the dishes the person can actually swipe (deck minus hidden, unpublished and, in round two, the
  first round's dishes), not a flat 50.
- Both people must reach half. One person's swipes alone never trigger the offer.
- The offer is a prompt: they can always keep swiping.
- The 15-swipe minimum from migration 0030 is replaced by this rule.
- "Reveal with what we have" is removed from the swipe screen and from the end-of-deck cards. It lives only on the new
  offer card. At the end of the deck the reveal already opens by itself (rule 2).

## Tasks

1. **Migration 0031.** Replace `reveal_now_ready()` with a half-deck check for both members, counted in the current
   round. Feed returns `can_reveal_now` only when both are there, so the card can show for both. `reveal_now()`
   refuses with `swipe_more` otherwise. Remove nothing from the data model.
   Check: DB tests (below).
2. **Offer card.** New card on Home (a component under `src/components/home/`), shown when `can_reveal_now`. Removes the
   button from the "ready" card and the exhausted card and from `swipe.tsx`. Check: tsc, lint, `check:ui`.
3. **Reminder for instant mode.** Extend `src/hooks/use-reveal-reminder.ts` to schedule the daily notification for
   instant couples at the phone's chosen time (stored locally, default 14:00), and add the time field to Settings.
   Check: tsc, lint, a small unit test for the time handling if any new pure helper appears.
4. **Docs and roadmap.** README reveal section, ROADMAP.

## Tests to write or change

- DB: one person at half, the other below: `can_reveal_now` false for both, `reveal_now` refused with `swipe_more`.
- DB: both at half with no match: true for both, reveal works and gives closest or surprise.
- DB: a tiny deck (fewer than 15 dishes) works with the same ratio; a narrow deck is not stuck.
- DB: round two counts half of the leftover dishes, not half of the first deck.
- DB: matching before half never needs the offer (regular flow).
- Update the existing tests that use the 15-swipe helper (`pad` in `reveal.test.mjs`) to use half the deck.

## Hand-test (iOS and Android)

1. Instant mode, one phone swipes 3 dishes: no offer, no reveal button anywhere.
2. Both swipe past half with no shared yes: the offer card shows on both Homes; "Keep swiping" returns to swiping.
3. Tap the reveal: both see closest or surprise, with "Swipe again" if there are leftovers.
4. After swipe again, repeat with the new set: the offer shows at half of the leftovers.
5. Instant couple, set the reminder time two minutes ahead: the notification arrives; scheduled mode still reminds at its reveal time.
6. dev tools: `npm run dev:reset-day` between runs.

## Open points (to confirm before building)

- Reminder default time (14:00 proposed) and whether the same notification skips a day when the person already swiped
  (a local notification cannot know; skipping would mean rescheduling on app open).
- The final wording of the offer card.
- Whether the offer also appears on the swipe screen's end state, or only on Home (proposed: only Home).
