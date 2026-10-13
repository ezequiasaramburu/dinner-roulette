import { Redirect, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useCouple } from '@/hooks/use-couple';
import { useProfile } from '@/hooks/use-profile';
import { supabase } from '@/lib/supabase';

// Placeholder home. Next up: the daily deck and swiping.
export default function Home() {
  const router = useRouter();
  const { data: profile } = useProfile();
  const { data: couple, refetch } = useCouple();
  const partnerReady = !!couple?.partner?.ready;

  // We can't see the partner's preferences (by design), so poll for their "ready" flag.
  useEffect(() => {
    if (!couple?.me_ready || partnerReady) return;
    const id = setInterval(() => refetch(), 15_000);
    return () => clearInterval(id);
  }, [couple?.me_ready, partnerReady, refetch]);

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Could not sign out', error.message);
  }

  // Everyone chooses their food preferences before seeing the home screen.
  if (couple && !couple.me_ready) return <Redirect href="/preferences" />;

  const partnerName = couple?.partner?.display_name ?? 'your partner';

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
        <ThemedText type="subtitle">
          {profile?.display_name} + {partnerName} 💞
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          {partnerReady
            ? `You're both set. Reveal time is ${couple?.reveal_time} (${couple?.timezone}). Next up: the daily swipe deck.`
            : `Waiting for ${partnerName} to choose their food preferences. We'll start once you're both done.`}
        </ThemedText>
      </View>
      <Button title="Edit my preferences" variant="secondary" onPress={() => router.push('/preferences')} />
      <Button title="Sign out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
