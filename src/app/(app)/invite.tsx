import * as Linking from 'expo-linking';
import { useEffect } from 'react';
import { Alert, Share, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Accent, Button, Card, CodeTiles, Pill, Screen, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useCancelCouple, useCouple, useCoupleRealtime, useInviteCode } from '@/hooks/use-couple';
import { friendlyError } from '@/lib/errors';

export default function Invite() {
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
    <Screen
      footer={
        <>
          {invite.isError ? (
            <Button title="Try again" variant="secondary" onPress={() => invite.refetch()} />
          ) : null}
          <Button title="Share invite" onPress={onShare} disabled={!invite.data} />
          <Button title="Start over" variant="ghost" onPress={onCancel} loading={cancel.isPending} />
        </>
      }>
      <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
        <Text variant="overline" tone="primary">
          Almost there
        </Text>
        <Text variant="title">
          Invite your <Accent>partner</Accent>
        </Text>
        <Text tone="secondary">
          Send them this code. They sign up for free and you&apos;ll be connected right away.
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120).duration(500)}>
        <Card style={styles.codeCard}>
          <Text variant="overline" tone="tertiary" align="center">
            Your invite code
          </Text>
          {invite.isError ? (
            <Text tone="secondary" align="center">
              Could not create a code.
            </Text>
          ) : (
            <CodeTiles code={invite.data} />
          )}
          <Text variant="caption" tone="tertiary" align="center">
            Expires in 7 days
          </Text>
        </Card>
        <Pill label="Waiting for your partner to join" tone="warning" pulse />
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.md, marginTop: Spacing.xl },
  codeCard: { gap: Spacing.lg, marginTop: Spacing.sm, marginBottom: Spacing.lg },
});
