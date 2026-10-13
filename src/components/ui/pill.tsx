import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  label: string;
  tone?: 'success' | 'warning' | 'neutral';
  /** Gently pulse the dot, for "waiting" states. */
  pulse?: boolean;
};

export function Pill({ label, tone = 'neutral', pulse }: Props) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!pulse || reduceMotion) {
      opacity.value = 1;
      return;
    }
    opacity.value = withRepeat(
      withSequence(withTiming(0.25, { duration: 800, easing: Easing.inOut(Easing.ease) }), withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })),
      -1,
    );
  }, [pulse, reduceMotion, opacity]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const fg = tone === 'success' ? theme.success : tone === 'warning' ? theme.warning : theme.textSecondary;
  const bg = tone === 'success' ? theme.successSoft : tone === 'warning' ? theme.warningSoft : theme.surfaceMuted;

  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Animated.View style={[styles.dot, { backgroundColor: fg }, dotStyle]} />
      <Text variant="label" style={{ color: fg }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.sm,
    borderRadius: Radius.pill,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
