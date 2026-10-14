import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { DishCard } from '@/components/dish/dish-card';
import { Text } from '@/components/ui';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import type { Dish } from '@/hooks/use-swipe-feed';
import { useTheme } from '@/hooks/use-theme';

export type SwipeDeckHandle = { swipe: (liked: boolean) => void };

type Props = {
  /** Dishes still to swipe, top card first. */
  recipes: Dish[];
  onSwipe: (recipe: Dish, liked: boolean) => void;
  ref?: Ref<SwipeDeckHandle>;
};

/** A stack of dish cards: drag right to like, left to pass, or use `ref.swipe()` from buttons. */
export function SwipeDeck({ recipes, onSwipe, ref }: Props) {
  const topRef = useRef<SwipeDeckHandle>(null);
  const [top, next] = recipes;

  useImperativeHandle(ref, () => ({ swipe: (liked) => topRef.current?.swipe(liked) }), []);

  if (!top) return null;

  return (
    <View style={styles.stack}>
      {next ? (
        <View style={styles.behind} pointerEvents="none">
          <DishCard recipe={next} />
        </View>
      ) : null}
      {/* key: each card owns its own animation state and starts fresh */}
      <TopCard key={top.id} ref={topRef} recipe={top} onSwiped={onSwipe} />
    </View>
  );
}

function TopCard({
  recipe,
  onSwiped,
  ref,
}: {
  recipe: Dish;
  onSwiped: (recipe: Dish, liked: boolean) => void;
  ref: Ref<SwipeDeckHandle>;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const settle = useSharedValue(0); // 0 = sitting in the stack (slightly small), 1 = on top
  const flying = useSharedValue(false);

  const threshold = width * 0.28;
  const offscreen = width * 1.4;

  useEffect(() => {
    settle.set(withTiming(1, { duration: reduceMotion ? 0 : 220 }));
  }, [settle, reduceMotion]);

  const finish = (liked: boolean) => onSwiped(recipe, liked);

  const flyOff = (liked: boolean) => {
    'worklet';
    if (flying.get()) return;
    flying.set(true);
    x.set(
      withTiming((liked ? 1 : -1) * offscreen, { duration: reduceMotion ? 0 : 230 }, (done) => {
        if (done) scheduleOnRN(finish, liked);
      }),
    );
  };

  useImperativeHandle(ref, () => ({ swipe: (liked) => flyOff(liked) }));

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (flying.get()) return;
      x.set(e.translationX);
      y.set(e.translationY * 0.25);
    })
    .onEnd((e) => {
      if (flying.get()) return;
      const far = Math.abs(e.translationX) > threshold;
      const fast = Math.abs(e.velocityX) > 900;
      if (far || fast) {
        flyOff(far ? e.translationX > 0 : e.velocityX > 0);
      } else {
        x.set(withSpring(0, { damping: 18, stiffness: 220 }));
        y.set(withSpring(0, { damping: 18, stiffness: 220 }));
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.get() + interpolate(settle.get(), [0, 1], [12, 0]) },
      { rotate: `${interpolate(x.get(), [-width, 0, width], [-14, 0, 14], Extrapolation.CLAMP)}deg` },
      { scale: interpolate(settle.get(), [0, 1], [0.95, 1]) },
    ],
  }));
  const yumStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.get(), [0, threshold], [0, 1], Extrapolation.CLAMP) }));
  const passStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.get(), [-threshold, 0], [1, 0], Extrapolation.CLAMP) }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.top, cardStyle]}>
        <DishCard recipe={recipe} />
        <Animated.View style={[styles.stamp, styles.yum, { borderColor: theme.primary, backgroundColor: theme.surface }, yumStyle]} pointerEvents="none">
          <Text style={[styles.stampText, { color: theme.primary }]}>YUM</Text>
        </Animated.View>
        <Animated.View style={[styles.stamp, styles.pass, { borderColor: theme.text, backgroundColor: theme.surface }, passStyle]} pointerEvents="none">
          <Text style={[styles.stampText, { color: theme.text }]}>PASS</Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  stack: { flex: 1 },
  behind: { ...StyleSheet.absoluteFill, transform: [{ scale: 0.95 }, { translateY: 12 }], opacity: 0.9 },
  top: { ...StyleSheet.absoluteFill },
  stamp: {
    position: 'absolute',
    top: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    borderWidth: 3,
    borderRadius: Radius.md,
  },
  yum: { left: Spacing.xl, transform: [{ rotate: '-12deg' }] },
  pass: { right: Spacing.xl, transform: [{ rotate: '12deg' }] },
  stampText: { fontFamily: Fonts.display, fontSize: 30, lineHeight: 36, letterSpacing: 2 },
});
