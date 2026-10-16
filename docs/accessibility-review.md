# Accessibility review

Reviewed 2026-10-16 by reading every shared component and screen, and by computing contrast ratios for the whole palette.
Nothing was tried with VoiceOver, TalkBack or a large text size: the hand-test is at the end. Target: WCAG 2.2 AA where it
applies to a native app.

## Already good
- Screen-reader roles and labels on buttons, chips (with selected state), option cards (radio), checkboxes, toggles, the
  back and menu buttons, the swipe buttons (Pass, Yum, Undo) and the form fields. Swiping a card is never required: the
  buttons do the same.
- Reduce Motion is honoured everywhere (nothing opts out of the system setting), and `npm run check:ui` guards it.
- Touch targets of 44 and more on buttons, steppers (48) and the round buttons; text fields and buttons are 50 tall.
- Modals (side menu, sheets, country picker) are real modals with a close button and Android back support.
- Decorative things are hidden from screen readers (the roulette wheel).

## Fixed
| Problem | Who it hurt | Fix |
|---|---|---|
| Steppers (matches per day, etc.) were one "adjustable" element with no increment/decrement actions, and the +/- buttons inside it were unreachable | Screen-reader users could not change the value | The row now answers the increment and decrement actions (swipe up and down) |
| Big serif text had no heading role | No way to jump between sections | `display`, `title` and `heading` text is announced as a heading |
| Form errors were not announced | A wrong field was silent | Errors are an alert with a polite live region, and read as the field's hint |
| Small grey labels failed contrast: tertiary text was 3.5:1 on the page and 3.2:1 on muted cards (light mode), 4.2:1 on muted cards (dark) | Low vision, bright sun. Affects the small uppercase labels (Tonight, Daily reveal, Allergens, Reveal…) and placeholders | Light `textTertiary` `#8F8174` to `#74685E`, dark `#8F8274` to `#998D7F`: now 4.5:1 or more on every surface |
| Tomato text on the soft tomato card was 4.44:1 | Same | Light `primarySoft` `#F6E1D9` to `#F8E7DF` (4.65:1), a barely visible lightening |
| Chip touch height was 40 | Hard to hit | Added 2 points of hit area top and bottom (44 total), no visual change |
| Chips read their emoji aloud before the label | Noise | The chip's label is the label only |
| Dish photos and avatars were read next to their name ("Chicken curry, Chicken curry") | Noise | Hidden from screen readers; the name is always beside them |
| The invite code was read as six separate letters | Slow, confusing | One element: "Invite code A B C D E F" |
| Pass and Yum did not say which dish | You could not know what you were passing on | "Pass on <dish>" and "Yum, <dish>" |
| iOS time picker was inside a wrapper that hid it from VoiceOver | The reveal time could not be changed | The label sits on the picker itself |
| Fixed-size glyphs (invite code letters, stepper signs, avatar initials, round buttons) clipped at very large text | Large-text users | Those few glyphs stop growing at 120 to 130 percent; all other text scales fully |

## Known and left as is
- **Soft borders around inputs and outlined buttons are 1.6:1 against the page**, below the 3:1 that WCAG asks for the
  edge of a control. The fields have a visible label, a lighter fill than the page and a thick tomato border when focused,
  and buttons are readable by their text, so most people find them fine, but a stricter reading calls this a fail.
  The fix is a darker border token for inputs only (changes the look: your call).
- **The paywall is built in RevenueCat's dashboard**, so its accessibility depends on their templates. Check it with a large
  text size and with VoiceOver once the real paywall is live.
- **No announcements when things change by themselves** (a partner joins, the reveal opens). The screens update; a
  screen-reader user finds out on their next swipe. Could add `announceForAccessibility` later.
- Pill status colours rely on the words inside them too, never on colour alone.
- Alert dialogs are native, so they are as accessible as the system makes them.

## Hand-test
1. **VoiceOver (iOS) or TalkBack (Android)**, one full run: sign in, name, preferences (chips: "selected" is said), create or
   join a couple (code field and the code tiles), Home, swipe with the Pass and Yum buttons, reveal, a recipe, Settings.
2. **Steppers:** on the match goal in Settings, focus it and swipe up and down: the value changes and is spoken.
3. **A wrong sign-in code:** the error is spoken without hunting for it.
4. **Largest text size** (iOS Larger Accessibility Sizes, Android font size and display size at maximum): nothing is cut
   off, nothing overlaps, every button is still reachable (the side menu scrolls if it must).
5. **Bold text and Increase Contrast** on iOS: nothing disappears.
6. **Dark mode:** the grey labels on the muted cards are readable.
7. **Switch Control or keyboard** if you have a keyboard attached: you can reach and press everything.
