import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCreateCouple } from '@/hooks/use-couple';
import { friendlyError } from '@/lib/errors';
import { usePendingInvite } from '@/lib/pending-invite';

export default function CoupleSetup() {
  const router = useRouter();
  const createCouple = useCreateCouple();
  const pendingCode = usePendingInvite((s) => s.code);

  // Opened an invite link: skip straight to joining.
  useEffect(() => {
    if (pendingCode) router.push('/join');
  }, [pendingCode, router]);

  async function onCreate() {
    try {
      await createCouple.mutateAsync();
    } catch (e) {
      Alert.alert('Could not create your couple', friendlyError(e));
    }
  }

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', gap: Spacing.three }}>
        <ThemedText type="subtitle">Who&apos;s joining you for dinner?</ThemedText>
        <ThemedText themeColor="textSecondary">
          Dinner Roulette works for two. One of you starts the couple and invites the other with a
          code.
        </ThemedText>
      </View>
      <Button title="Invite my partner" onPress={onCreate} loading={createCouple.isPending} />
      <Button title="I have an invite code" variant="secondary" onPress={() => router.push('/join')} />
    </Screen>
  );
}
