import { Alert, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useProfile } from '@/hooks/use-profile';
import { supabase } from '@/lib/supabase';

// Placeholder home. Phase 2 puts the paywall here, Phase 3 the partner invite.
export default function Home() {
  const { data: profile } = useProfile();

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Could not sign out', error.message);
  }

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
        <ThemedText type="subtitle">Hi {profile?.display_name} 👋</ThemedText>
        <ThemedText themeColor="textSecondary">
          You&apos;re signed in. Next up: subscription and inviting your partner.
        </ThemedText>
      </View>
      <Button title="Sign out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
