import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { StyleSheet } from 'react-native';

import { Accent, BackButton, Button, Card, Pill, Screen, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import type { CoupleState } from '@/hooks/use-couple';
import { enter } from '@/hooks/use-motion';
import { useSubscribe } from '@/hooks/use-subscription';
import { purchasesAvailable } from '@/lib/purchases';

/** Sharing a recipe is for subscribers. This says why, and (while on the free trial) that subscribing is what unlocks it. */
export function RecipesLocked({ couple }: { couple: CoupleState | null }) {
  const router = useRouter();
  const { subscribe, busy } = useSubscribe();
  const isPayer = couple?.role === 'owner';
  const payer = couple?.partner?.display_name ?? 'your partner';
  const days = couple?.trial_days_left;

  let body: string;
  if (!couple) body = 'Create or join a couple and subscribe to share your own recipes with everyone on Swipe for Dinner.';
  else if (days != null)
    body = `You're on your free trial (${days} ${days === 1 ? 'day' : 'days'} left). Everything else is yours to use, but recipes can only be shared with a subscription. ${
      isPayer ? 'Subscribe any time to unlock it.' : `Once ${payer} subscribes, you can both share.`
    }`;
  else if (!couple.has_access)
    body = `The free trial has ended. ${isPayer ? 'Subscribe to share your own recipes again' : `Once ${payer} subscribes, you can both share recipes again`}. Recipes already published stay up.`;
  else
    body = `Your plan isn't active right now. ${isPayer ? 'Renew it' : `Once ${payer} renews it`} to share your own recipes. Recipes already published stay up.`;

  return (
    <Screen
      footer={
        isPayer && purchasesAvailable() ? (
          <>
            <Button title="See plans" onPress={subscribe} loading={busy} />
            <Button title="Not now" variant="ghost" onPress={() => router.back()} />
          </>
        ) : (
          <Button title="Back" variant="secondary" onPress={() => router.back()} />
        )
      }>
      <BackButton />
      <Animated.View entering={enter()} style={styles.stack}>
        <Text variant="overline" tone="primary">
          Share a dish
        </Text>
        <Text variant="title">
          Sharing recipes is for <Accent>subscribers</Accent>
        </Text>
        <Card tone="accent" padding="lg">
          <Pill label="Subscribers only" tone="warning" dot={false} />
          <Text tone="secondary" style={styles.body}>
            {body}
          </Text>
        </Card>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.lg, marginTop: Spacing.md },
  body: { marginTop: Spacing.md },
});
