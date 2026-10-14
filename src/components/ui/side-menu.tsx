import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Text } from '@/components/ui/text';
import { Radius, Spacing, elevation } from '@/constants/theme';
import { useScheme, useTheme } from '@/hooks/use-theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
};

/**
 * A panel that slides in from the left over a dimmed screen. Tap the dimmed area, swipe left, or press back to close.
 * Built on Modal so it sits above everything and Android's back button works.
 */
export function SideMenu({ visible, onClose, children }: Props) {
  const theme = useTheme();
  const scheme = useScheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(width * 0.84, 340);

  // Stay mounted while the closing animation plays: `closed` only flips once it has finished.
  const [closed, setClosed] = useState(!visible);
  if (visible && closed) setClosed(false);
  const progress = useSharedValue(0); // 0 = closed, 1 = open

  useEffect(() => {
    const duration = reduceMotion ? 0 : visible ? 260 : 210;
    if (visible) {
      progress.set(withTiming(1, { duration, easing: Easing.out(Easing.cubic) }));
    } else {
      progress.set(
        withTiming(0, { duration, easing: Easing.in(Easing.cubic) }, (done) => {
          if (done) scheduleOnRN(setClosed, true);
        }),
      );
    }
  }, [visible, reduceMotion, progress]);

  const close = () => onClose();

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationX < 0) progress.set(Math.max(0, 1 + e.translationX / panelWidth));
    })
    .onEnd((e) => {
      if (e.translationX < -panelWidth * 0.3 || e.velocityX < -700) scheduleOnRN(close);
      else progress.set(withTiming(1, { duration: 160 }));
    });

  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateX: (progress.get() - 1) * panelWidth }] }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));

  if (closed && !visible) return null;

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay }, scrimStyle]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close menu" style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <GestureDetector gesture={pan}>
          <Animated.View
            style={[
              styles.panel,
              {
                width: panelWidth,
                backgroundColor: theme.background,
                borderColor: theme.border,
                paddingTop: insets.top + Spacing.lg,
                paddingBottom: insets.bottom + Spacing.lg,
              },
              elevation(scheme, 2),
              panelStyle,
            ]}>
            {children}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

type ItemProps = { emoji: string; label: string; caption?: string; onPress: () => void };

/** One row in the side menu. */
export function MenuItem({ emoji, label, caption, onPress }: ItemProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed && { backgroundColor: theme.surfaceMuted }]}>
      <View style={[styles.badge, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={styles.badgeEmoji}>{emoji}</Text>
      </View>
      <View style={styles.itemText}>
        <Text variant="bodyStrong">{label}</Text>
        {caption ? (
          <Text variant="caption" tone="secondary">
            {caption}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRightWidth: 1,
    borderTopRightRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, padding: Spacing.md, borderRadius: Radius.lg },
  badge: { width: 44, height: 44, borderRadius: Radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  badgeEmoji: { fontSize: 22, lineHeight: 28 },
  itemText: { flex: 1, gap: 2 },
});
