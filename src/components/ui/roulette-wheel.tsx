import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';

const DISHES = ['🍝', '🌮', '🍣', '🥗', '🍕', '🍜', '🥘', '🍤'];
const TICKS = 24;

/**
 * The brand mark: a wheel of dishes with a fixed pointer. Purely decorative.
 * By default it turns slowly forever; with `spin` it does one fast turn that slows to a stop (the reveal).
 */
export function RouletteWheel({ size = 280, spin: spinOnce = false }: { size?: number; spin?: boolean }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    if (spinOnce) {
      rotation.value = withTiming(360 * 4 + 45, { duration: 2800, easing: Easing.out(Easing.cubic) });
      return;
    }
    rotation.value = withRepeat(withTiming(360, { duration: 70_000, easing: Easing.linear }), -1);
  }, [reduceMotion, spinOnce, rotation]);

  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  const plate = size * 0.19;
  const dishRadius = size * 0.335;
  const tickRadius = size * 0.455;
  const hub = size * 0.3;

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={[
          styles.disc,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.surfaceMuted, borderColor: theme.borderStrong },
        ]}
      />

      <Animated.View style={[StyleSheet.absoluteFill, spin]}>
        {Array.from({ length: TICKS }).map((_, i) => {
          const a = (i / TICKS) * Math.PI * 2;
          return (
            <View
              key={`t${i}`}
              style={{
                position: 'absolute',
                width: i % 3 === 0 ? 5 : 3,
                height: i % 3 === 0 ? 5 : 3,
                borderRadius: 3,
                backgroundColor: i % 3 === 0 ? theme.primary : theme.textTertiary,
                left: size / 2 + Math.sin(a) * tickRadius - 2.5,
                top: size / 2 - Math.cos(a) * tickRadius - 2.5,
              }}
            />
          );
        })}
        {DISHES.map((emoji, i) => {
          const a = (i / DISHES.length) * Math.PI * 2;
          return (
            <Plate
              key={emoji}
              emoji={emoji}
              size={plate}
              rotation={rotation}
              left={size / 2 + Math.sin(a) * dishRadius - plate / 2}
              top={size / 2 - Math.cos(a) * dishRadius - plate / 2}
            />
          );
        })}
      </Animated.View>

      <View
        style={[
          styles.hub,
          { width: hub, height: hub, borderRadius: hub / 2, backgroundColor: theme.primary, borderColor: theme.surface },
        ]}>
        <Text style={{ fontSize: hub * 0.46, lineHeight: hub * 0.6 }}>🍽️</Text>
      </View>

      {/* Fixed pointer at 12 o'clock */}
      <View
        style={[
          styles.pointer,
          { top: -6, borderTopColor: theme.primary },
        ]}
      />
    </View>
  );
}

/** One dish on the wheel. Counter-rotates so the emoji always stays upright. */
function Plate({
  emoji,
  size,
  rotation,
  left,
  top,
}: {
  emoji: string;
  size: number;
  rotation: SharedValue<number>;
  left: number;
  top: number;
}) {
  const theme = useTheme();
  const upright = useAnimatedStyle(() => ({ transform: [{ rotate: `${-rotation.value}deg` }] }));
  return (
    <Animated.View
      style={[
        styles.plate,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          left,
          top,
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
        upright,
      ]}>
      <Text style={{ fontSize: size * 0.5, lineHeight: size * 0.62 }}>{emoji}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  disc: { position: 'absolute', borderWidth: 1.5 },
  plate: { position: 'absolute', alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  hub: { alignItems: 'center', justifyContent: 'center', borderWidth: 4 },
  pointer: {
    position: 'absolute',
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: 11,
    borderRightWidth: 11,
    borderTopWidth: 18,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
