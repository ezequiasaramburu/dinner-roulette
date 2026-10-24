import { Ionicons } from '@expo/vector-icons';
import { useNetInfo } from '@react-native-community/netinfo';
import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const MESSAGE = "You're offline. Check your connection.";

/**
 * A small pill at the top of every screen while the phone has no connection. It lets taps through (pointerEvents none),
 * so it never blocks a back button. "Unknown" (null, the first moment after launch) counts as online, to avoid a flash.
 */
export function OfflineBanner() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isConnected, isInternetReachable } = useNetInfo();
  const offline = isConnected === false || isInternetReachable === false;

  useEffect(() => {
    if (offline) AccessibilityInfo.announceForAccessibility(MESSAGE);
  }, [offline]);

  if (!offline) return null;

  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + Spacing.xs }]}>
      <Animated.View
        entering={FadeInUp}
        exiting={FadeOutUp}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[styles.pill, { backgroundColor: theme.text }]}>
        <Ionicons name="cloud-offline-outline" size={16} color={theme.background} />
        <Text variant="label" style={{ color: theme.background }}>
          {MESSAGE}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 1000 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
  },
});
