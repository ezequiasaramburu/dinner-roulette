# Spec: Premium UI polish (motion, feedback, loading)

Status: approved. Task 1 and Task 2 are built (see `tasks/todo.md`).

## Objective

Make the existing app feel like a finished, premium product without changing what it does, how it is laid out, or its colors and fonts. The polish comes from three things people feel but rarely name: **every touch answers back**, **screens move with intent**, and **loading never looks like a blank or a spinner**.

Users: couples using the app daily, mostly on a phone for a few seconds at a time. The feel of the first 2 seconds is what they judge it by.

Priorities, as chosen by the product owner:
1. **Press feedback everywhere** (buttons, cards, chips, option rows, menu rows).
2. **Screen transitions and loading** (skeleton placeholders, staggered entrances, smooth reflow when things appear or go away).
3. Style: **subtle and refined**. It should feel expensive, never busy.
4. Performance bar: **smooth on a mid-range Android**. Reduce-motion is always honored.

Approved packages: `expo-haptics` and `expo-linear-gradient` (both need a native rebuild of the dev app).

Not a priority this round (left as they are): swipe-card physics and the reveal wheel and its entrance. They only get haptics (see Scope).

## Assumptions

1. Polish only: no new screens, no copy changes, no layout changes, no color or font changes. New shades come only from existing theme tokens.
2. Animation uses what is installed: Reanimated 4 and gesture-handler. Only the two approved packages are added.
3. Database and business logic are untouched.
4. The user hand-tests on a real phone. This spec ends with a per-screen checklist instead of simulator driving.

## Scope

### In
| # | Capability | What the user sees |
|---|---|---|
| 1 | **Motion tokens** | One place for springs, durations, press scale and stagger delay, so everything moves the same way |
| 2 | **Reduce-motion** | Reanimated already follows the phone's setting for springs, timings and entering, exiting and layout animations. Nothing may opt out of it, and components that must skip movement themselves (the press scale) use one shared hook |
| 3 | **Animated press feedback** | Buttons, cards, chips, option cards, menu rows and steppers ease down on touch and spring back, instead of jumping to a scaled state |
| 4 | **Haptics** | A light tap on primary actions, a selection tick on chips and options, a success pulse on match, reveal and recipe submit, a soft tap on swipe commit and undo. Never on back or close |
| 5 | **Depth** | A very soft gradient on the primary button and the accent card, built from existing primary tokens; shadow colors move from hard-coded hex into theme tokens |
| 6 | **Skeleton loading** | Placeholders shaped like the content (swipe card, recipe rows, preference chips) replace the spinners on those screens |
| 7 | **Image fade-in** | Dish photos fade in over a tinted placeholder instead of popping in (already in place via `transition={250}`; verified at the end) |
| 8 | **Screen transitions** | Drill-down screens use the platform push animation; sheets slide up; only the auth-to-app switch and the reveal fade (mostly in place already; audited) |
| 9 | **Staggered entrances and smooth reflow** | One shared entrance helper (same duration and delay everywhere); notices and list rows slide out and the rest closes the gap smoothly |

### Out
Swipe-card tilt and stamps, reveal wheel changes, confetti or Lottie, blur effects, parallax, shared-element transitions, sound, new fonts or colors, app icon and splash (a separate item).

## Tech stack

Expo SDK 57 (`expo ~57.0.28`), Expo Router, React Native with the React Compiler lint rules, Reanimated `4.5.1` and Worklets `0.10.1`, expo-image, TanStack Query. New: `expo-haptics`, `expo-linear-gradient`, both installed with `npx expo install` so the versions match SDK 57.

## Commands

```
Typecheck:   npx tsc --noEmit
Lint:        npm run lint
Unit tests:  npm test
UI guards:   npm run check:ui        (prints the counts below; baseline in tasks/todo.md)
DB tests:    npm run test:db         (unchanged by this work; run once at the end)
Add packages: npx expo install expo-haptics expo-linear-gradient
Rebuild dev app (iOS, run by the user):     npx expo run:ios
Rebuild dev app (Android, run by the user): npx expo run:android
Start:       npx expo start
Reset two test users (local DB): npm run dev:reset -- one@example.com two@example.com
```

Static checks only from the assistant: no simulator driving. The user runs the rebuild and the hand-test.

## Project structure

```
src/constants/motion.ts          NEW  springs, durations, press scale, stagger step        (done)
src/constants/theme.ts           EDIT gradient and shadow tokens (derived from existing colors)
src/hooks/use-motion.ts          NEW  Reduce Motion aware helpers (one source of truth)    (done)
src/lib/haptics.ts               NEW  tap / select / success / soft; safe no-ops          (done)
scripts/check-ui.mjs             NEW  the guard counts                                    (done)
src/components/ui/pressable-scale.tsx  NEW  animated press wrapper used by every pressable primitive
src/components/ui/skeleton.tsx   NEW  quiet pulsing placeholder blocks
src/components/ui/{button,card,chip,option-card,stepper,menu-button,back-button,time-field,country-field}.tsx  EDIT use PressableScale
src/app/_layout.tsx, src/app/(app)/_layout.tsx, src/app/(auth)/_layout.tsx  AUDIT per-route transitions
screens with spinners (swipe, recipes, preferences)   EDIT skeletons
```

## Code style

Follow the repo as it stands: Reanimated 4 `.get()/.set()` on shared values, tokens from `@/constants`, apostrophes as `&apos;` in JSX, no hex colors in components. One example of the target pattern:

```tsx
// src/components/ui/pressable-scale.tsx (shape, not final)
// The Pressable itself is animated: no wrapper view, so stretched buttons and flex rows lay out as before.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressableScale({ haptic = 'none', style, onPressIn, onPressOut, ...rest }: Props) {
  const scale = useSharedValue(1);
  const { animate } = useMotion();
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      onPressIn={(e) => {
        if (animate) scale.set(withSpring(Motion.pressScale, Motion.spring.press));
        if (haptic !== 'none') haptics[haptic]();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, Motion.spring.press));
        onPressOut?.(e);
      }}
      style={[style, animated]}
      {...rest}
    />
  );
}
```

Rules: animate only `transform` and `opacity` (UI thread). No animation on layout props in lists of images. Durations and springs come from `Motion`, never inline numbers.

## Testing strategy

There are no automated screen tests in this app, and adding a UI test framework is out of scope. So:

1. **Static checks after every task:** `tsc`, `lint`, `npm test`.
2. **Guards, printed by `npm run check:ui`** (counts must only go down to their targets):
   - Raw `Pressable` outside the allowed files (the wrapper itself and the side menu's backdrop): target 0.
   - `ActivityIndicator` on swipe, recipes and preferences (the auth gate, the reveal wheel and button loading states keep theirs): target 0.
   - Hard-coded hex colors in `src/components` (the avatar's fixed palette is the one exception): target 0.
   - Files that opt out of Reduce Motion (`ReduceMotion.Never`): target 0. Reanimated follows the phone's setting by default for springs, timings and entering, exiting and layout animations, so no per-file hook is required.
3. **Pure helpers get unit tests** (`node --test`): the haptics wrapper's no-op fallback and the guard script itself.
4. **Hand-test checklist** (below), run by the user on a real phone, with one pass on Android and one with Reduce Motion switched on.

## Boundaries

- **Always:** use `Motion` tokens; never opt out of Reduce Motion; animate transform and opacity only; keep a 44pt minimum touch target; run tsc, lint and tests after each task; end each task with a short commit message; mark anything not seen on a device as unverified.
- **Ask first:** adding any package beyond the two approved; changing a color or font; touching copy; changing a route's behavior (not just its animation); anything that needs a native rebuild beyond the two packages.
- **Never:** animate on the JS thread or with `setState` timers; add looping or attention-seeking animations (nothing pulses forever except skeletons and the existing pills); remove or weaken accessibility labels or roles; change business logic or the database; drive the iOS simulator to test.

## Success criteria

A task is done when **all** of these hold.

1. Every pressable primitive (button, card, chip, option card, stepper, menu and back button, time and country field, menu rows) eases to the press scale and springs back, with no jump.
2. Haptics fire exactly where listed in Scope and nowhere else, and a missing haptics engine never throws.
3. With the OS **Reduce Motion** setting on, no screen scales, slides or staggers; state changes are instant or a plain fade.
4. The three spinner screens show skeletons shaped like their content, and the real content replaces them without a layout jump.
5. Dish images fade in; none flash blank-then-pop.
6. Moving between screens uses push for drill-down, slide-up for sheets, fade for auth-to-app and the reveal. Back always reverses the entry.
7. Dismissing a notice or removing a row closes the gap smoothly.
8. `npx tsc --noEmit`, `npm run lint` and `npm test` pass; `npm run check:ui` shows every guard at its target; `npm run test:db` still passes.
9. On a mid-range Android phone, nothing visibly drops frames while swiping, opening the menu, or scrolling lists.
10. Light and dark modes both look right (shadows and gradients are token-based).

## Hand-test checklist (user, real phone)

| Screen | Check |
|---|---|
| Sign in, name, preferences | Buttons and chips ease down; chips tick; skeleton chips while loading |
| Home | Cards and menu rows respond to touch; entrances feel even; notice dismiss closes the gap |
| Swipe | Skeleton card on first load; light tap on pass, like and undo; no stutter |
| Reveal | Success pulse when the dish appears; fade, not slide, in |
| Recipe, Your recipes | Rows press smoothly; skeleton rows while loading; photos fade in |
| Add a recipe | Primary button depth looks right; success pulse on submit |
| Settings, invite, join | Steppers and fields respond; push transition feels native |
| Everything | Repeat once on Android and once with Reduce Motion on; light and dark |

Tip: `npm run dev:reset` puts the two test accounts back at the start of the flow between passes.

## Build order

See `tasks/todo.md` for the 16 tasks. In short:

1. Foundation: packages, tokens, Reduce Motion hook, safe haptics; the guard script. **Done.**
2. `PressableScale`, then the UI primitives onto it.
3. Depth: gradient and shadow tokens; button and accent card.
4. Skeletons for the three loading screens.
5. Route transitions audit, shared entrance helper and list reflow.
6. Moment haptics and the final sweep.

Each step lands separately, so a regression is easy to find and revert. The user rebuilds the dev app once after step 1, and again only if the native layer changes.

## Open questions (assumed defaults, change any before the task that uses it)

1. **Haptics toggle:** no in-app switch; the phone's own haptics setting applies.
2. **Gradient strength:** a barely-there lift (about 6% lighter at the top of the primary button). Reviewed at Checkpoint 3.
3. **Reveal and swipe visuals:** deliberately left out of this round.
