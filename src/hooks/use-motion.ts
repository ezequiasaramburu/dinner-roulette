import { FadeInDown, FadeOutUp, LinearTransition, useReducedMotion } from 'react-native-reanimated';

import { Motion } from '@/constants/motion';

/** Whether to animate at all. False when the phone's Reduce Motion setting is on. */
export function useMotion() {
  return { animate: !useReducedMotion() };
}

/**
 * The entrance every screen uses: fade up, one sibling after another (`index` 0 is the first).
 * Reanimated follows the phone's Reduce Motion setting by default, so it simply shows up when that is on.
 */
export const enter = (index = 0) => FadeInDown.delay(index * Motion.stagger).duration(Motion.duration.slow);

/** For something that goes away (a dismissed notice): it lifts out while `reflow` closes the gap below it. */
export const exit = FadeOutUp.duration(Motion.duration.base);

/** For siblings that may move when something above them appears or goes: they glide instead of jumping. */
export const reflow = LinearTransition.duration(Motion.duration.base);
