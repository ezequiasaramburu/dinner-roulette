import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/button';
import { useProfile } from '@/hooks/use-profile';

export default function AppLayout() {
  const { data: profile, isPending, isError, refetch } = useProfile();

  if (isPending) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
        <ThemedText>We couldn&apos;t load your profile.</ThemedText>
        <Button title="Try again" onPress={() => refetch()} />
      </View>
    );
  }

  const hasName = !!profile.display_name;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!hasName}>
        <Stack.Screen name="name" />
      </Stack.Protected>
      <Stack.Protected guard={hasName}>
        <Stack.Screen name="index" />
      </Stack.Protected>
    </Stack>
  );
}
