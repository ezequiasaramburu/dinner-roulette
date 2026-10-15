/** One place for how things move, so the whole app feels like it has the same hand. */
export const Motion = {
  /** How far a pressed control sinks. */
  pressScale: 0.97,
  spring: {
    /** Quick and tight: touch feedback. */
    press: { damping: 18, stiffness: 420, mass: 0.6 },
    /** Softer: things settling into place. */
    gentle: { damping: 20, stiffness: 180, mass: 1 },
  },
  duration: {
    fast: 120,
    base: 220,
    /** Entrances (what the screens use today). */
    slow: 500,
  },
  /** Delay between siblings entering one after another. */
  stagger: 80,
} as const;
