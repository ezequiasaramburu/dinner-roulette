# Task list: Premium UI polish

Plan: [plan.md](plan.md) · Spec: [../SPEC.md](../SPEC.md)

Every task: run `npx tsc --noEmit`, `npm run lint`, `npm test` (and `npm run check:ui` once Task 2 exists), then end with a short commit message. Anything not seen on a device is marked unverified.

---

## Phase 1: Foundation and first visible slice

- [x] **Task 1: Packages, motion tokens, Reduce Motion hook, safe haptics**
  - Acceptance:
    - `expo-haptics` and `expo-linear-gradient` installed with `npx expo install`
    - `Motion` exports press scale, two springs, three durations and the stagger step (entrance distance left out: Reanimated's `FadeInDown` has a fixed distance)
    - `useMotion()` tells callers whether to animate (false when Reduce Motion is on)
    - `haptics.tap / select / success / soft` never throw, even when the native module is missing
  - Verify: tsc, lint, `npm test` (new haptics fallback test passes); app still starts on the old dev build
  - Dependencies: none
  - Files: `package.json`, `src/constants/motion.ts`, `src/hooks/use-motion.ts`, `src/lib/haptics.ts`, `src/lib/haptics.test.mjs`
  - Scope: S (5 files)
  - Done. **User still needs to rebuild the dev app** (`npx expo run:ios`, and Android when ready)

- [x] **Task 2: `check:ui` guard script**
  - Acceptance: `npm run check:ui` prints counts for (a) raw `Pressable` outside the allowed list, (b) `ActivityIndicator` on swipe, recipes and preferences, (c) hex colors in `src/components` (the avatar's fixed palette is allowed), (d) files that opt out of Reduce Motion (`ReduceMotion.Never`). Baseline recorded below.
  - Verify: script runs and prints the baseline; its 5 tests pass; tsc and lint clean
  - Dependencies: none
  - Files: `scripts/check-ui.mjs`, `scripts/check-ui.test.mjs`, `package.json`
  - Scope: S (3 files)
  - Note: Reanimated already follows the phone's Reduce Motion setting by default for springs, timings and entering, exiting and layout animations, so "animated files without the hook" would have flagged 14 correct files. The guard checks for opt-outs instead.
  - **Baseline (2026-10-15):** raw Pressable 18 · spinners on the three screens 4 · hex colors in components 1 (button shadow) · Reduce Motion opt-outs 0

- [x] **Task 3: `PressableScale` and the Button**  _(code done; hand-test at Checkpoint 1 pending)_
  - Acceptance:
    - New `PressableScale` animates the Pressable itself, supports the `style` callback and the `haptic` prop, and skips movement under Reduce Motion
    - Button uses it: eases down, springs back, light tap on primary; layout identical to today (stretch, rows)
    - The old static `pressed` scale is gone from Button
  - Verify: tsc, lint, tests; **hand:** sign-in, name, home and invite buttons feel smooth; Button inside a row still lays out the same
  - Dependencies: 1
  - Files: `src/components/ui/pressable-scale.tsx`, `src/components/ui/button.tsx`
  - Scope: S (2 files)

### Checkpoint 1: first visible result
- [ ] tsc, lint, tests pass; `check:ui` numbers recorded
- [ ] User rebuilt the dev app and tapped through the buttons on a real phone
- [ ] Review with user before continuing

---

## Phase 2: Press feedback everywhere

- [x] **Task 4: Cards and rows**  _(code done; hand-test pending)_
  - Acceptance: tappable `Card`, `DishRow` and the side-menu `MenuItem` use `PressableScale`; pressed opacity/color kept; no jump on release
  - Verify: tsc, lint, tests; **hand:** home reveal card, recipe rows, menu rows
  - Dependencies: 3
  - Files: `src/components/ui/card.tsx`, `src/components/dish/dish-row.tsx`, `src/components/ui/side-menu.tsx`
  - Scope: S (3 files)

- [x] **Task 5: Selection controls (chip, option card, stepper)**  _(code done; hand-test pending)_
  - Acceptance: all three use `PressableScale` with the `select` haptic; selected and disabled states unchanged; stepper buttons still have 48pt targets
  - Verify: tsc, lint, tests; **hand:** preferences chips, reveal-mode options, matches stepper
  - Dependencies: 3
  - Files: `src/components/ui/chip.tsx`, `src/components/ui/option-card.tsx`, `src/components/ui/stepper.tsx`
  - Scope: S (3 files)

- [x] **Task 6: Icon buttons and fields**  _(code done; hand-test pending)_
  - Acceptance: `MenuButton`, `BackButton`, `TimeField` and `CountryField` (trigger, close, rows) use `PressableScale`; no haptic on back or close; hit slop kept
  - Verify: tsc, lint, tests; **hand:** burger, back, reveal-time picker, country list
  - Dependencies: 3
  - Files: `src/components/ui/menu-button.tsx`, `back-button.tsx`, `time-field.tsx`, `country-field.tsx`
  - Scope: M (4 files)

- [x] **Task 7: Screen-level pressables**  _(code done; hand-test pending)_
  - Acceptance: the photo add and remove controls, the video link on the recipe page, the swipe round buttons, and the report and ingredients sheets use `PressableScale`; swipe-deck gesture code untouched
  - Verify: tsc, lint, tests; `check:ui` raw-Pressable count is only the allowed list; **hand:** add-recipe photo, recipe video link, swipe buttons, both sheets
  - Dependencies: 3
  - Files: `src/app/(app)/add-recipe.tsx`, `src/app/(app)/recipe/[id].tsx`, `src/app/(app)/swipe.tsx`, `src/components/ui/index.ts`, `scripts/check-ui.mjs`
  - Note: the two sheets only have a full-screen dimmed backdrop that closes them, which must not shrink, so they are on the `check:ui` allowlist next to the side menu's. The real controls here were the terms checkbox, the remove buttons, the ingredient checklist rows and the swipe round buttons.
  - Scope: M (5 files)

### Checkpoint 2: press feedback complete
- [ ] tsc, lint, tests pass; `check:ui` raw-Pressable count at the allowed list
- [ ] User walked every screen once on a real phone
- [ ] Review with user before continuing

---

## Phase 3: Depth

- [ ] **Task 8: Gradient and shadow tokens**
  - Acceptance:
    - Theme gets gradient and shadow tokens derived from existing colors (no new hues)
    - Primary button has a very soft top-light gradient; accent card a faint one; both clip to their radius
    - The hard-coded `#B93D26` shadow is gone from Button
    - Looks right in light and dark
  - Verify: tsc, lint, tests; `check:ui` hex count in components is zero; **hand:** sign-in, home, invite in light and dark, on iOS and Android
  - Dependencies: 1, 3
  - Files: `src/constants/theme.ts`, `src/components/ui/button.tsx`, `src/components/ui/card.tsx`
  - Scope: S (3 files)

### Checkpoint 3: depth reviewed
- [ ] User confirms the gradient strength (answer to the spec's open question 2)

---

## Phase 4: Loading

- [ ] **Task 9: Skeleton component and the swipe screen**
  - Acceptance: a `Skeleton` block pulses quietly (opacity only, off under Reduce Motion); swipe first load and the "next batch" wait show a card-shaped skeleton, same size as a real card, so there is no jump
  - Verify: tsc, lint, tests; `check:ui` swipe spinner count is zero; **hand:** open swipe on a slow connection
  - Dependencies: 1
  - Files: `src/components/ui/skeleton.tsx`, `src/components/ui/index.ts`, `src/app/(app)/swipe.tsx`
  - Scope: S (3 files)

- [ ] **Task 10: Skeletons for Your recipes and Preferences**
  - Acceptance: recipes shows three skeleton rows; preferences shows skeleton chips; real content replaces them without a jump; error and empty states unchanged
  - Verify: tsc, lint, tests; `check:ui` spinner count is zero on all three screens; **hand:** both screens on a slow connection
  - Dependencies: 9
  - Files: `src/app/(app)/recipes.tsx`, `src/app/(app)/preferences.tsx`
  - Scope: S (2 files)

### Checkpoint 4: loading
- [ ] The three loading screens checked with the network throttled
- [ ] Review with user before continuing

---

## Phase 5: Motion and transitions

- [ ] **Task 11: Entrance helper, sign-in screens and name**
  - Acceptance: one `enter(index)` helper returns the shared entrance (duration and stagger from `Motion`, plain fade under Reduce Motion); `(auth)/index`, `(auth)/email` and `name` use it; the look matches today's, with even timing
  - Verify: tsc, lint, tests; **hand:** sign-in, email, name
  - Dependencies: 1
  - Files: `src/hooks/use-motion.ts`, `src/app/(auth)/index.tsx`, `src/app/(auth)/email.tsx`, `src/app/(app)/name.tsx`
  - Scope: S (4 files)

- [ ] **Task 12: Onboarding screens**
  - Acceptance: couple-setup, join and invite use the helper; the invite code tiles keep their own animation
  - Verify: tsc, lint, tests; **hand:** create a couple, join with a code, wait on invite
  - Dependencies: 11
  - Files: `src/app/(app)/couple-setup.tsx`, `join.tsx`, `invite.tsx`
  - Scope: S (3 files)

- [ ] **Task 13: Home, settings and smooth reflow**
  - Acceptance: home and settings use the helper; dismissing a notice slides it out and the cards below close the gap smoothly (`LinearTransition`); the new components (`TonightCard`, `RevealedCard`) are untouched
  - Verify: tsc, lint, tests; **hand:** change the match goal on one phone, dismiss the notice on the other
  - Dependencies: 11
  - Files: `src/app/(app)/index.tsx`, `src/app/(app)/settings.tsx`, `src/components/notice-card.tsx`
  - Scope: S (3 files)

- [ ] **Task 14: Recipes, recipe page, add recipe and reveal**
  - Acceptance: the four screens use the helper; deleting a recipe row slides it out and the list closes up; the reveal keeps its wheel and flow
  - Verify: tsc, lint, tests; **hand:** delete a recipe, open a recipe, add one, open a reveal
  - Dependencies: 11
  - Files: `src/app/(app)/recipes.tsx`, `recipe/[id].tsx`, `add-recipe.tsx`, `reveal.tsx`
  - Scope: M (4 files)

- [ ] **Task 15: Transitions audit**
  - Acceptance: every route is listed with its animation; fade only for auth to app and the reveal, push for drill-down, slide up for swipe, add-recipe and any sheet-like screen, slide in for legal; fix only what does not match; Back always reverses the entry
  - Verify: tsc, lint, tests; **hand:** go through every screen and back
  - Dependencies: none
  - Files: `src/app/_layout.tsx`, `src/app/(app)/_layout.tsx`, `src/app/(auth)/_layout.tsx`
  - Scope: S (3 files; may need none)

### Checkpoint 5: motion
- [ ] Full walkthrough with Reduce Motion off, then on (nothing slides or scales)
- [ ] Review with user before continuing

---

## Phase 6: Moments

- [ ] **Task 16: Haptics for swipe, match, reveal and submit**
  - Acceptance: soft tap on swipe commit and on undo; success pulse when a match is found, when the reveal's dish appears, and when a recipe is submitted; nothing on back, close or scroll
  - Verify: tsc, lint, tests; **hand:** swipe a few cards, undo, match, open a reveal, submit a recipe
  - Dependencies: 1, 7
  - Files: `src/app/(app)/swipe.tsx`, `src/app/(app)/reveal.tsx`, `src/app/(app)/add-recipe.tsx`
  - Scope: S (3 files)

### Checkpoint 6: done
- [ ] All 10 success criteria in SPEC.md met; `check:ui` numbers at their targets; `npm run test:db` still passes
- [ ] Final hand-test on iOS and Android, light and dark, Reduce Motion on and off
- [ ] Ready for review
