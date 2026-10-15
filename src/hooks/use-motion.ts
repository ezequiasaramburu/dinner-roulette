import { useReducedMotion } from 'react-native-reanimated';

/** Whether to animate at all. False when the phone's Reduce Motion setting is on. */
export function useMotion() {
  return { animate: !useReducedMotion() };
}
