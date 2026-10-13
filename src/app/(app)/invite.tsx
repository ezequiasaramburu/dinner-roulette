import * as Linking from 'expo-linking';
import { useEffect } from 'react';
import { ActivityIndicator, Alert, Share, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCancelCouple, useCouple, useCoupleRealtime, useInviteCode } from '@/hooks/use-couple';
import { useTheme } from '@/hooks/use-theme';
import { friendlyError } from '@/lib/errors';

export default function Invite() {
  const theme = useTheme();
  const couple = useCouple();
  const invite = useInviteCode(couple.data?.couple_id);
  const cancel = useCancelCouple();

  // Realtime moves us along instantly; polling covers a dropped socket.
  useCoupleRealtime(couple.data?.couple_id);
  useEffect(() => {
    const id = setInterval(() => couple.refetch(), 10_000);
    return () => clearInterval(id);
  }, [couple]);

  async function onShare() {
    if (!invite.data) return;
    const link = Linking.createURL(`join/${invite.data}`);
    await Share.share({
      message: `Let's pick dinner together on Dinner Roulette! Use my invite code ${invite.data}, or open ${link}`,
    });
  }

  function onCancel() {
    Alert.alert('Start over?', 'This deletes your couple and invite code.', [
      { text: 'Keep waiting', style: 'cancel' },
      {
        text: 'Start over',
        style: 'destructive',
        onPress: () => cancel.mutate(undefined, { onError: (e) => Alert.alert('Error', friendlyError(e)) }),
      },
    ]);
  }

  return (
    <Screen>
      <View style={styles.body}>
        <ThemedText type="subtitle">Invite your partner</ThemedText>
        <ThemedText themeColor="textSecondary">
          Send them this code. They sign up for free, and you&apos;ll be connected right away.
        </ThemedText>

        <View style={[styles.codeBox, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          {invite.isPending ? (
            <ActivityIndicator />
          ) : invite.isError ? (
            <ThemedText themeColor="textSecondary">Could not create a code.</ThemedText>
          ) : (
            <ThemedText selectable style={styles.code}>
              {invite.data}
            </ThemedText>
          )}
        </View>

        <View style={styles.waiting}>
          <ActivityIndicator size="small" />
          <ThemedText type="small" themeColor="textSecondary">
            Waiting for your partner to join…
          </ThemedText>
        </View>
      </View>

      {invite.isError ? <Button title="Try again" onPress={() => invite.refetch()} /> : null}
      <Button title="Share invite" onPress={onShare} disabled={!invite.data} />
      <Button title="Start over" variant="secondary" onPress={onCancel} loading={cancel.isPending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center', gap: Spacing.three },
  codeBox: {
    minHeight: 96,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.three,
  },
  code: { fontSize: 40, lineHeight: 48, fontWeight: '700', letterSpacing: 8 },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
