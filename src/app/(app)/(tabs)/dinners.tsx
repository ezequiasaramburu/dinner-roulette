import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { DishRow } from '@/components/dish/dish-row';
import { LockedCard } from '@/components/home/locked-card';
import { Accent, Button, Card, Pill, Screen, Skeleton, Text } from '@/components/ui';
import { TAB_EDGES } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useCouple } from '@/hooks/use-couple';
import { useDinnerHistory, type HistoryDay } from '@/hooks/use-dinner-history';
import { enter } from '@/hooks/use-motion';
import { dayLabel, todayIn } from '@/lib/day-label';

const KIND: Record<HistoryDay['kind'], { label: string; tone: 'success' | 'neutral' }> = {
  match: { label: 'You both liked', tone: 'success' },
  closest: { label: 'One of you liked', tone: 'neutral' },
  surprise: { label: 'Our pick', tone: 'neutral' },
};

/** Every reveal the couple has had, newest first, so a dish you loved is never lost. */
export default function Dinners() {
  const router = useRouter();
  const { data: couple } = useCouple();
  const locked = couple?.has_access === false;
  const history = useDinnerHistory(!locked);
  const today = todayIn(couple?.timezone ?? 'UTC');
  const days = history.data?.pages.flatMap((page) => page.days) ?? [];

  // The tabs stay mounted, so coming back to this one would show the old list. Refresh it when it is older than a minute.
  const refetch = history.refetch;
  const stale = history.isStale;
  useFocusEffect(
    useCallback(() => {
      if (stale && !locked) refetch();
    }, [stale, locked, refetch]),
  );

  return (
    <Screen edges={TAB_EDGES}>
      <Animated.View entering={enter()} style={styles.stack}>
        <Text variant="overline" tone="primary">
          Your table
        </Text>
        <Text variant="title">
          Past <Accent>dinners</Accent>
        </Text>
        <Text tone="secondary">Every reveal you&apos;ve had, so a great dish is never lost.</Text>

        {locked && couple ? (
          <LockedCard couple={couple} />
        ) : history.isPending ? (
          <DinnersSkeleton />
        ) : history.isError && !history.data ? (
          <Card tone="muted">
            <Text tone="secondary">We couldn&apos;t load your dinners.</Text>
            <Button title="Try again" variant="secondary" onPress={() => history.refetch()} />
          </Card>
        ) : days.length === 0 && !history.hasNextPage ? (
          <Card tone="accent" padding="lg">
            <Text variant="heading">Your first dinner will show up here</Text>
            <Text tone="secondary" style={styles.empty}>
              After your first reveal, each dinner you were shown is kept here with its recipe and shopping list.
            </Text>
          </Card>
        ) : (
          <>
            {days.map((day) => (
              <View key={day.deck_id} style={styles.day}>
                <View style={styles.dayHeader}>
                  <Text variant="bodyStrong">{dayLabel(day.deck_date, today)}</Text>
                  <Pill label={KIND[day.kind].label} tone={KIND[day.kind].tone} dot={false} />
                </View>
                {day.dishes.map((dish) => (
                  <DishRow key={dish.id} recipe={dish} onPress={() => router.push(`/recipe/${dish.id}`)} />
                ))}
              </View>
            ))}
            {history.hasNextPage ? (
              <Button
                title="Show earlier dinners"
                variant="secondary"
                loading={history.isFetchingNextPage}
                onPress={() => history.fetchNextPage()}
              />
            ) : null}
          </>
        )}
      </Animated.View>
    </Screen>
  );
}

/** Two days' worth of placeholders, the same proportions as a real day. */
function DinnersSkeleton() {
  return (
    <View accessible accessibilityLabel="Loading your dinners" style={styles.stack}>
      {[0, 1].map((i) => (
        <View key={i} style={styles.day}>
          <Skeleton style={styles.dateLine} />
          <Skeleton style={styles.card} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.lg, marginTop: Spacing.md },
  empty: { marginTop: Spacing.sm },
  day: { gap: Spacing.md },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateLine: { width: '35%', height: 16, borderRadius: 7 },
  card: { width: '100%', height: 320, borderRadius: Radius.xl },
});
