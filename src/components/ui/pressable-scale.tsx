import { useState } from 'react';
import { Pressable, type PressableProps, type PressableStateCallbackType, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Motion } from '@/constants/motion';
import { useMotion } from '@/hooks/use-motion';
import { haptics } from '@/lib/haptics';

// The Pressable itself is animated, with no wrapper view, so stretched buttons and rows lay out exactly as before.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  /** Plain style, or the `({ pressed }) => style` form Pressable allows. */
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
  /** Played when the press completes (not when the finger lands, so starting a scroll never buzzes). */
  haptic?: 'tap' | 'select' | 'none';
};

/** A Pressable that eases down when touched and springs back. With Reduce Motion on it does not move. */
export function PressableScale({ haptic = 'none', style, onPress, onPressIn, onPressOut, ...rest }: Props) {
  const { animate } = useMotion();
  const scale = useSharedValue(1);
  const [pressed, setPressed] = useState(false);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        setPressed(true);
        if (animate) scale.set(withSpring(Motion.pressScale, Motion.spring.press));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        scale.set(withSpring(1, Motion.spring.press));
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic !== 'none') haptics[haptic]();
        onPress?.(e);
      }}
      style={[typeof style === 'function' ? style({ pressed, hovered: false }) : style, animated]}
    />
  );
}
