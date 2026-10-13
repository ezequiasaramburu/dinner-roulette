import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { useCouple } from '@/hooks/use-couple';
import { useProfile } from '@/hooks/use-profile';

/**
 * Onboarding as a state machine. Exactly one group of screens is reachable at a time:
 *   no name → name · no couple → couple-setup/join · couple but no partner → invite · paired → home/preferences
 */
export default function AppLayout() {
  const profile = useProfile();
  const couple = useCouple();

  if (profile.isPending || couple.isPending) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (profile.isError || couple.isError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
        <ThemedText>We couldn&apos;t load your account.</ThemedText>
        <Button
          title="Try again"
          onPress={() => {
            profile.refetch();
            couple.refetch();
          }}
        />
      </View>
    );
  }

  const hasName = !!profile.data.display_name;
  const hasCouple = !!couple.data;
  const isPaired = !!couple.data?.partner;

  return (
    <Stack screenOptions={{ headerShown: false }}>
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
        <Stack.Screen name="index" />
        <Stack.Screen name="preferences" />
      </Stack.Protected>
    </Stack>
  );
}
