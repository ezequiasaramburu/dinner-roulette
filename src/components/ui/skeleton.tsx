import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { Motion } from '@/constants/motion';
import { Radius } from '@/constants/theme';
import { useMotion } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';

/** A quiet placeholder block that breathes while content loads. Still under Reduce Motion. Hidden from screen readers. */
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const { animate } = useMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!animate) return;
    pulse.set(withRepeat(withTiming(0.55, { duration: Motion.duration.pulse, easing: Easing.inOut(Easing.quad) }), -1, true));
    return () => cancelAnimation(pulse);
  }, [animate, pulse]);

  const animated = useAnimatedStyle(() => ({ opacity: pulse.get() }));

  return (
    <Animated.View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[{ backgroundColor: theme.surfaceMuted, borderRadius: Radius.sm }, style, animated]}
    />
  );
}
