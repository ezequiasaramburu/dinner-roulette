import { Alert, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Accent, BackButton, Card, OptionCard, Screen, Stepper, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useCouple, useUpdateCoupleSettings, type CoupleSettings } from '@/hooks/use-couple';
import { useProfile } from '@/hooks/use-profile';

export default function Settings() {
  const { data: couple } = useCouple();
  const { data: profile } = useProfile();
  const update = useUpdateCoupleSettings();
  const instant = couple?.reveal_mode === 'instant';
  const goal = couple?.match_goal ?? 2;

  function save(settings: CoupleSettings) {
    update.mutate(settings, {
      onError: () => Alert.alert("Couldn't save that", 'Please try again.'),
    });
  }

  return (
    <Screen>
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
            {instant ? ' as soon as you reach it' : ` at ${couple?.reveal_time ?? 'the reveal'}`}, so you&apos;ll have{' '}
            {goal === 1 ? 'one dish' : `${goal} options`} to cook. Either of you can change this.
          </Text>
          <View style={styles.stepper}>
            <Stepper label="Matches per day" value={goal} min={1} max={5} onChange={(n) => save({ matchGoal: n })} />
          </View>
        </Card>

        <Card>
          <Text variant="overline" tone="tertiary">
            How you find out
          </Text>
          <View style={styles.options}>
            <OptionCard
              title="At a set time"
              description="Keep swiping whenever you like. You both find out at the same time each day."
              selected={!instant}
              onPress={() => save({ revealMode: 'scheduled' })}
            />
            <OptionCard
              title="As soon as you match"
              description="The moment you've reached your matches, you both find out. Swiping reopens tomorrow."
              selected={instant}
              onPress={() => save({ revealMode: 'instant' })}
            />
          </View>
        </Card>

        {!instant ? (
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
        ) : null}
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.lg, marginTop: Spacing.lg },
  cardTitle: { marginTop: Spacing.xs, marginBottom: Spacing.sm },
  options: { gap: Spacing.sm, marginTop: Spacing.md },
  stepper: { marginTop: Spacing.lg, alignItems: 'flex-start' },
});
