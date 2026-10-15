# Implementation Plan: Premium UI polish

Source: [SPEC.md](../SPEC.md). Task list with acceptance criteria and verification: [todo.md](todo.md). Status: approved; Tasks 1 and 2 are done.

## Overview

Make the existing app feel premium without changing what it does or how it looks at rest: every touch answers back, loading shows content-shaped placeholders instead of spinners, and entrances and removals move with one consistent rhythm. Style is subtle and refined; performance bar is a mid-range Android; Reduce Motion is always honored.

The work is 16 small tasks in 6 phases with a checkpoint after each phase that changes what the user sees. The user rebuilds the dev app once (after Task 1) and hand-tests on a real phone at each checkpoint. The assistant runs static checks only.

## What reading the code changed (vs SPEC.md)

| SPEC.md said | The code shows | Plan |
|---|---|---|
| Add image fade-in | `DishImage` already has `transition={250}` | No task. Verified in the final sweep |
| Rework screen transitions | Root fades auth to app, `(app)` uses the native push, swipe and add-recipe slide up, reveal fades, legal slides in | One small audit task (15), no rework |
| `PressableScale` wraps a Pressable in an `Animated.View` | A wrapper breaks stretched buttons and flex rows | Animate the Pressable itself (`Animated.createAnimatedComponent(Pressable)`). No extra view |
| Hard-coded shadow color | One in `button.tsx` (`#B93D26`) | Moved to a token in Task 8 |
| Every animated file must use the Reduce Motion hook | Reanimated already follows the phone's setting by default for springs, timings and entering/exiting/layout animations | The guard checks for opt-outs (`ReduceMotion.Never`) instead; the hook is only for components that must skip movement themselves (press scale) |
| Entrance distance as a motion token | `FadeInDown` has a fixed distance | Left out of the tokens |

## Architecture decisions

1. **Motion tokens in one file** (`src/constants/motion.ts`): press scale, two springs, three durations, stagger step. No inline numbers elsewhere.
2. **Reduce Motion**: Reanimated's default (follow the system) is kept everywhere; nothing opts out. `useMotion()` (`src/hooks/use-motion.ts`) is for components that must skip movement themselves, like the press scale.
3. **Haptics wrapper loads safely** (`src/lib/haptics.ts`): `expo-haptics` is `require`d inside a try/catch, so the app still runs on a dev build that was not rebuilt yet, and on platforms without it.
4. **`PressableScale` animates the Pressable itself**, supports the `style` callback form that Button and Chip use today, and has a `haptic` prop (`tap | select | none`).
5. **Press feedback replaces the old static `pressed` transforms**; pressed color changes stay (they are part of the current look).
6. **Skeletons use opacity only** (one shared value per group), the cheapest thing on Android.
7. **Gradients are barely-there** (about 6% lighter at the top) and built from existing primary tokens. Clip to the radius so Android corners stay clean.
8. **`npm run check:ui`** (`scripts/check-ui.mjs`) prints the spec's guards as counts so every task can show the numbers going down. Baseline (2026-10-15): raw Pressable 18 · spinners on the three screens 4 · hex colors in components 1 · Reduce Motion opt-outs 0.

## Dependency graph

```
1 packages + tokens + reduce-motion + safe haptics      (done)
  ├─ 2 check:ui guard script                            (done)
  └─ 3 PressableScale + Button  ── first visible result
        ├─ 4 Cards and rows
        ├─ 5 Selection controls
        ├─ 6 Icon buttons and fields
        └─ 7 Screen-level pressables
              └─ 16 Moment haptics (swipe, match, reveal, submit)
1 ─ 8 Depth tokens (gradient + shadows)
1 ─ 9 Skeleton + swipe ── 10 Skeletons on recipes and preferences
1 ─ 11 Entrance helper + auth ── 12 onboarding ── 13 home, settings, reflow ── 14 recipes, recipe, add, reveal
15 Transitions audit  (independent)
```

Tasks 4 to 7 are independent of each other; 9 and 11 are independent of the press work. They are listed in one order because the user tests on one phone, but they can be reordered.

## Task list

### Phase 1: Foundation and first visible slice
- [x] 1. Packages, motion tokens, Reduce Motion hook, safe haptics
- [x] 2. `check:ui` guard script
- [x] 3. `PressableScale` and the Button (hand-test pending) (every button eases and ticks)

**Checkpoint 1:** user rebuilds the dev app and taps through buttons on sign-in, name and home.

### Phase 2: Press feedback everywhere
- [x] 4. Cards and rows (hand-test pending)
- [x] 5. Selection controls (chip, option card, stepper) (hand-test pending)
- [x] 6. Icon buttons and fields (hand-test pending)
- [x] 7. Screen-level pressables (hand-test pending)

**Checkpoint 2:** every touchable thing answers back; guards show no raw `Pressable` outside the allowed list.

### Phase 3: Depth
- [x] 8. Gradient and shadow tokens on the primary button and accent card (hand-test pending)

**Checkpoint 3:** light and dark both reviewed on a real phone.

### Phase 4: Loading
- [x] 9. Skeleton component and the swipe screen (hand-test pending)
- [x] 10. Skeletons for Your recipes and Preferences (hand-test pending)

**Checkpoint 4:** user throttles the network (airplane mode toggle) and checks the three loading screens.

### Phase 5: Motion and transitions
- [x] 11. Entrance helper, sign-in screens and name (hand-test pending)
- [ ] 12. Onboarding screens (couple setup, join, invite)
- [ ] 13. Home, settings and smooth reflow of notices
- [ ] 14. Recipes, recipe page, add recipe and reveal
- [ ] 15. Transitions audit

**Checkpoint 5:** full walkthrough with Reduce Motion off, then on.

### Phase 6: Moments
- [ ] 16. Haptics for swipe, match, reveal and submit

**Checkpoint 6 (done):** all SPEC.md success criteria checked; final hand-test on iOS, Android, light and dark.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Importing `expo-haptics` or `expo-linear-gradient` before the dev app is rebuilt crashes the app | High | Haptics are guarded in try/catch (Task 1, done). The gradient package is first used in Task 8, after the Checkpoint 1 rebuild |
| Animating the Pressable changes how a button lays out in a row | Med | Animate the Pressable itself, no wrapper; check Button inside rows (add-recipe, invite) at Checkpoint 1 |
| Gradient corners bleed on Android | Med | Clip with `overflow: 'hidden'` on the same radius; check on the Android pass |
| Skeleton to content causes a layout jump | Med | Skeletons share the real component's size constants |
| Too many haptics feel cheap | Med | Fixed list in Task 16; none on back, close or scroll |
| Reduce Motion missed in a corner | Med | Nothing opts out of Reanimated's system default (`check:ui` counts opt-outs); the press scale checks `useMotion()`; Checkpoint 5 repeats the walkthrough with the setting on |
| Entrance changes feel different from today on screens that already animate | Low | The helper keeps today's duration; only the inconsistent delays are evened out |

## Assumptions carried from SPEC.md (change any before the task that uses it)

1. No in-app haptics switch; the phone's own setting applies.
2. Gradient is about 6% lighter at the top.
3. Swipe-card physics and the reveal wheel are not part of this round.
4. Every task ends with a short commit message, and anything not seen on a device is marked unverified.

## Open questions

None blocking. The three assumptions above are the only choices the plan makes for you.
