# Weak connection and error review

Reviewed 2026-10-16 by reading every screen and data hook. Nothing here was tried on a phone with a bad connection: the
checks are static (typecheck, lint, unit tests for the pure parts). The hand-test is at the end.

## What was already good
Most screens had a "Try again" path: account load, preferences, your recipes, the swipe feed, the reveal, invite code
errors. Failed saves (preferences, settings, swipes, undo, recipe submit, join code) show a message, and a failed swipe
puts the card back. The loading states use skeletons, not blank screens.

## Found and fixed
| Problem | What a person saw | Fix |
|---|---|---|
| A failed background refresh replaced the screen with an error page, even though the data was already there (`isError` stays true next to old data). Hit the account gate, preferences, swiping, your recipes and the invite code | Connection drops while on Home or Swipe: the whole app flips to "We couldn't load your account" and screens unmount, losing a half-edited form | Error pages show only when there is nothing to show. Existing data stays on screen |
| Requests had no time limit | A weak connection could leave a spinner for a minute or more | `src/lib/fetch-timeout.ts`: 15 s (60 s for photo uploads), then it fails like any network error |
| Three automatic retries per query | About 7 seconds of spinner before an error on a dead connection | One retry, one second apart |
| React Native never told the data layer the app came back to the foreground | Data that went stale offline stayed stale until a screen refetched by itself | Foreground now triggers a refresh (`focusManager` wired to `AppState`) |
| Network failures showed "Something went wrong" (or, on sign-in, "That code is invalid") | A dropped connection looked like a wrong code | `friendlyError` and the sign-in screens say "Can't reach Swipe for Dinner. Check your connection and try again." |
| A recipe page opened while offline said "This recipe is no longer available" | Looked like the recipe was deleted | It says it couldn't load, with Try again |
| A crash in any screen gave a blank or red screen | Dead end | A root error screen with Try again (`ErrorBoundary` in `src/app/_layout.tsx`) |
| After buying a plan, if the server was slow to unlock, the app just stopped waiting | The payer paid and saw nothing | An alert says the purchase went through and may take a minute |

## Left as is (known)
- **No "you're offline" banner.** It needs the native NetInfo module (a rebuild). Today the app finds out only when a request
  fails. Worth adding with the next native rebuild.
- **Offline starts.** Opening the app with no connection keeps the saved session (nothing is signed out), then shows the
  account error screen with Try again, because the account has to be loaded from the server. There is no offline copy of
  the data, on purpose: the swipe queue and the reveal depend on the server.
- **Realtime** (partner joins, reveal opens, notices) reconnects by itself when the connection returns; Home also polls and
  refreshes on foreground, so a missed event is caught within seconds.
- **Photo upload** that fails midway shows the generic "Couldn't share your recipe" (with the connection message when it
  was a network error); the person retries from the form, which keeps what they typed.

## Hand-test (airplane mode; on a real phone and again on the Android emulator)
1. **Mid-swipe:** open Swipe, switch airplane mode on, keep swiping. Cards that were already loaded stay; a swipe that can't
   be saved puts the card back with a message. Turn it off: swiping continues, no error page.
2. **Home:** with airplane mode on, wait about a minute. Home stays as it was (no full-screen error). Turn it off, bring
   the app back from the background: it refreshes.
3. **Preferences:** start editing, go offline for a minute, keep editing, then save offline: you get the connection message
   and your choices are still there.
4. **Cold start offline:** close the app, enable airplane mode, open it: the account error with Try again; turn the
   connection on and tap Try again.
5. **Sign in offline:** type an email and tap Send code, and later a code: the connection message, not "invalid code".
6. **Slow connection:** use the phone's network limiter (or a very weak signal): spinners end in an error within about
   30 seconds, not minutes.
7. **Crash screen:** hard to trigger on purpose; a dev can throw inside a screen to see it once.
8. **Purchase with a slow webhook:** stop the local webhook function, buy in the Test Store: after about 15 seconds the
   "purchase went through" alert shows. Start the function and reopen the app: unlocked.
