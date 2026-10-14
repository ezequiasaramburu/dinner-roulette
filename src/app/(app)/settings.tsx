import { useRouter } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Accent, BackButton, Button, Card, Screen, Stepper, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useCouple, useUpdateMatchGoal } from '@/hooks/use-couple';
import { useProfile } from '@/hooks/use-profile';
import { supabase } from '@/lib/supabase';

export default function Settings() {
  const router = useRouter();
  const { data: couple } = useCouple();
  const { data: profile } = useProfile();
  const updateGoal = useUpdateMatchGoal();
  const goal = couple?.match_goal ?? 2;

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Could not sign out', error.message);
  }

  return (
    <Screen footer={<Button title="Sign out" variant="secondary" onPress={signOut} />}>
      <BackButton />
      <Animated.View entering={FadeInDown.duration(500)} style={styles.stack}>
        <Text variant="title">
          Your <Accent>settings</Accent>
        </Text>

        <Card>
          <Text variant="overline" tone="tertiary">
            Dinner options
          </Text>
          <Text variant="heading" style={styles.cardTitle}>
            Matches per day
          </Text>
          <Text variant="caption" tone="secondary">
            You keep swiping until you&apos;ve both liked this many of the same dishes. They&apos;re revealed together
            at {couple?.reveal_time ?? 'the reveal'}, so you&apos;ll have {goal === 1 ? 'one dish' : `${goal} options`} to
            cook. Either of you can change this.
          </Text>
          <View style={styles.stepper}>
            <Stepper
              label="Matches per day"
              value={goal}
              min={1}
              max={5}
              onChange={(n) => updateGoal.mutate(n, { onError: () => Alert.alert("Couldn't save that", 'Please try again.') })}
            />
          </View>
        </Card>

        <Card onPress={() => router.push('/preferences')} accessibilityLabel="Your food preferences">
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text variant="heading">Your food preferences</Text>
              <Text variant="caption" tone="secondary">
                Diet, allergies, cuisines and what you&apos;d rather avoid.
              </Text>
            </View>
            <Text tone="tertiary">›</Text>
          </View>
        </Card>

        <Card tone="muted" padding="lg">
          <Text variant="overline" tone="tertiary">
            Daily reveal
          </Text>
          <Text variant="bodyStrong" style={styles.cardTitle}>
            {couple?.reveal_time} · {couple?.timezone?.replace('_', ' ')}
          </Text>
          <Text variant="caption" tone="secondary">
            Signed in as {profile?.display_name}. Choosing your own reveal time is coming soon.
          </Text>
        </Card>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.lg, marginTop: Spacing.lg },
  cardTitle: { marginTop: Spacing.xs, marginBottom: Spacing.sm },
  stepper: { marginTop: Spacing.lg, alignItems: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  rowText: { flex: 1, gap: Spacing.xs },
});
