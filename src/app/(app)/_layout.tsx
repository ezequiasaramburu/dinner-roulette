import { Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useCouple } from '@/hooks/use-couple';
import { useProfile } from '@/hooks/use-profile';
import { useRevealReminderSync } from '@/hooks/use-reveal-reminder';
import { useTheme } from '@/hooks/use-theme';

/**
 * Onboarding as a state machine. Exactly one group of screens is reachable at a time:
 *   no name → name · no couple → couple-setup/join · couple but no partner → invite · paired → home/preferences
 */
export default function AppLayout() {
  const theme = useTheme();
  const profile = useProfile();
  const couple = useCouple();
  useRevealReminderSync(couple.data);

  if (profile.isPending || couple.isPending) {
    return (
      <Screen scroll={false} contentStyle={styles.center}>
        <ActivityIndicator color={theme.primary} />
      </Screen>
    );
  }

  // A refresh that fails while we already have the data (a dropped connection) must not throw the screen away.
  if ((profile.isError && !profile.data) || (couple.isError && couple.data === undefined)) {
    return (
      <Screen
        scroll={false}
        contentStyle={styles.center}
        footer={
          <Button
            title="Try again"
            onPress={() => {
              profile.refetch();
              couple.refetch();
            }}
          />
        }>
        <Text variant="heading" align="center">
          We couldn&apos;t load your account
        </Text>
        <Text tone="secondary" align="center">
          Check your connection and try again.
        </Text>
      </Screen>
    );
  }

  const hasName = !!profile.data.display_name;
  const hasCouple = !!couple.data;
  const isPaired = !!couple.data?.partner;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}>
      <Stack.Protected guard={!hasName}>
        <Stack.Screen name="name" />
      </Stack.Protected>
      <Stack.Protected guard={hasName && !hasCouple}>
        <Stack.Screen name="couple-setup" />
        <Stack.Screen name="join" />
      </Stack.Protected>
      <Stack.Protected guard={hasName && hasCouple && !isPaired}>
        <Stack.Screen name="invite" />
      </Stack.Protected>
      <Stack.Protected guard={hasName && isPaired}>
        {/* Arriving by replace() ("save and go home") should feel like going back, not forward. */}
        <Stack.Screen name="index" options={{ animationTypeForReplace: 'pop' }} />
        <Stack.Screen name="preferences" />
        <Stack.Screen name="swipe" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="settings" />
        <Stack.Screen name="reveal" options={{ animation: 'fade' }} />
        <Stack.Screen name="recipe/[id]" />
        <Stack.Screen name="recipes" options={{ animationTypeForReplace: 'pop' }} />
        <Stack.Screen name="add-recipe" options={{ animation: 'slide_from_bottom' }} />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
});
