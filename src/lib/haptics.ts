/**
 * Small, deliberate taps. Everything here is fire-and-forget and never throws: the native module is loaded lazily
 * inside a try/catch, so the app still runs on a dev build that was made before expo-haptics was added.
 */
type Native = typeof import('expo-haptics');

let native: Native | null | undefined;

function load(): Native | null {
  if (native === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy on purpose, see the note above
      native = require('expo-haptics') as Native;
    } catch {
      native = null;
    }
  }
  return native;
}

function run(play: (h: Native) => Promise<void>): void {
  try {
    const h = load();
    if (h) play(h).catch(() => {});
  } catch {
    // Haptics are a nicety: a missing engine or a refused call is never worth an error.
  }
}

export const haptics = {
  /** A light tap: primary actions. */
  tap: () => run((h) => h.impactAsync(h.ImpactFeedbackStyle.Light)),
  /** A selection tick: chips, options, steppers. */
  select: () => run((h) => h.selectionAsync()),
  /** A success pulse: a match, a reveal, a submitted recipe. */
  success: () => run((h) => h.notificationAsync(h.NotificationFeedbackType.Success)),
  /** A soft tap: swiping a card away, undoing. */
  soft: () => run((h) => h.impactAsync(h.ImpactFeedbackStyle.Soft)),
};
