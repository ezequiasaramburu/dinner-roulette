import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { DishCard } from '@/components/dish/dish-card';
import { IngredientsSheet } from '@/components/dish/ingredients-sheet';
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
  const cards = useRef(new Map<string, SwipeDeckHandle>());
  const [inspected, setInspected] = useState<Dish | null>(null);
  // Cards flying away. The one behind moves up and takes swipes right away, so a quick second swipe is not lost.
  const [departing, setDeparting] = useState<string[]>([]);
  const visible = recipes.slice(0, 2);
  const first = visible[0];
  const active = visible.find((d) => !departing.includes(d.id));

  useImperativeHandle(ref, () => ({ swipe: (liked) => active && cards.current.get(active.id)?.swipe(liked) }), [active]);

  if (!first) return null;

  return (
    <View style={styles.stack}>
      {/* key: a card keeps its own state and its picture while it moves from behind to the top, so nothing reloads */}
      {visible.map((dish, i) => (
        <StackCard
          key={dish.id}
          ref={(handle) => {
            if (handle) cards.current.set(dish.id, handle);
            else cards.current.delete(dish.id);
          }}
          recipe={dish}
          layer={i === 0 ? 2 : 1}
          promoted={i === 0 || departing.includes(first.id)}
          active={dish.id === active?.id}
          onDepart={(id) => setDeparting((ids) => (ids.includes(id) ? ids : [...ids, id]))}
          onSwiped={(d, liked) => {
            setDeparting((ids) => ids.filter((id) => id !== d.id));
            onSwipe(d, liked);
          }}
          onInspect={setInspected}
        />
      ))}
      <IngredientsSheet dish={inspected} onClose={() => setInspected(null)} />
    </View>
  );
}

function StackCard({
  recipe,
  layer,
  promoted,
  active,
  onDepart,
  onSwiped,
  onInspect,
  ref,
}: {
  recipe: Dish;
  /** Which card is drawn on top of the other. */
  layer: number;
  /** Sitting at full size (the top card, or the one moving up as the top card leaves). */
  promoted: boolean;
  /** Takes swipes and taps. */
  active: boolean;
  onDepart: (id: string) => void;
  onSwiped: (recipe: Dish, liked: boolean) => void;
  onInspect: (recipe: Dish) => void;
  ref: Ref<SwipeDeckHandle>;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const settle = useSharedValue(promoted ? 1 : 0); // 0 = sitting in the stack (slightly small), 1 = on top
  const appear = useSharedValue(promoted ? 1 : 0);
  const flying = useSharedValue(false);

  const threshold = width * 0.28;
  const offscreen = width * 1.4;

  useEffect(() => {
    settle.set(withTiming(promoted ? 1 : 0, { duration: reduceMotion ? 0 : 200 }));
  }, [promoted, settle, reduceMotion]);

  // A card that joins the stack fades in instead of popping into place.
  useEffect(() => {
    appear.set(withTiming(1, { duration: reduceMotion ? 0 : 160 }));
  }, [appear, reduceMotion]);

  // Tell the deck as soon as this card starts flying away, so the next one can move up while it is still on its way.
  useAnimatedReaction(
    () => flying.get(),
    (now, was) => {
      if (now && !was) scheduleOnRN(onDepart, recipe.id);
    },
  );

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
    .enabled(active)
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

  // A tap (no drag) opens the ingredient list; dragging still swipes.
  const tap = Gesture.Tap()
    .enabled(active)
    .maxDuration(250)
    .onEnd((_e, success) => {
      if (success && !flying.get()) scheduleOnRN(onInspect, recipe);
    });
  const gesture = Gesture.Race(pan, tap);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: appear.get(),
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
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.top, { zIndex: layer }, cardStyle]} pointerEvents={active ? 'auto' : 'none'}>
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
