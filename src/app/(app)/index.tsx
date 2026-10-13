import { Alert, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useCouple } from '@/hooks/use-couple';
import { useProfile } from '@/hooks/use-profile';
import { supabase } from '@/lib/supabase';

// Placeholder home. Next up: food preferences, then the daily deck.
export default function Home() {
  const { data: profile } = useProfile();
  const { data: couple } = useCouple();

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Could not sign out', error.message);
  }

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
        <ThemedText type="subtitle">
          {profile?.display_name} + {couple?.partner?.display_name ?? 'your partner'} 💞
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          You&apos;re connected. Reveal time is {couple?.reveal_time} ({couple?.timezone}). Next up:
          choosing the food you both like.
        </ThemedText>
      </View>
      <Button title="Sign out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
