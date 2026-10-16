import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { DishCardSkeleton } from '@/components/dish/dish-card-skeleton';
import { SwipeDeck, type SwipeDeckHandle } from '@/components/dish/swipe-deck';
import { Accent, BackButton, Button, PressableScale, Screen, Text } from '@/components/ui';
import { Fonts, Spacing } from '@/constants/theme';
import { useCouple } from '@/hooks/use-couple';
import {
  thumbnail,
  useRecordSwipe,
  useSwipeFeed,
  useUndoAvailable,
  useUndoSwipe,
  type Dish,
} from '@/hooks/use-swipe-feed';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { timeInZoneToLocal } from '@/lib/zoned-time';

export default function Swipe() {
  const router = useRouter();
  const { data: couple } = useCouple();
  const feed = useSwipeFeed(true);
  const record = useRecordSwipe();
  const undo = useUndoSwipe();
  const canUndo = useUndoAvailable((s) => s.count > 0);
  const deckRef = useRef<SwipeDeckHandle>(null);

  const queryClient = useQueryClient();
  const data = feed.data;
  // After "swipe again" the second round reveals the instant way, whatever the couple's mode.
  const instant = couple?.reveal_mode === 'instant' || (data?.round ?? 1) > 1;
  const partnerName = couple?.partner?.display_name ?? 'your partner';
  const dishes = useMemo(() => data?.dishes ?? [], [data?.dishes]);

  // Warm the next photos so cards never appear blank.
  useEffect(() => {
    const urls = dishes.slice(0, 4).map((d) => thumbnail(d.image_url, 'large'));
    const photos = urls.filter((u): u is string => !!u);
    if (photos.length) Image.prefetch(photos);
  }, [dishes]);

  // Instant reveal: the moment the goal is reached the dinner is open, so go straight to the spinning wheel.
  const goalReached = data?.status === 'goal_reached';
  useEffect(() => {
    if (!instant || !goalReached) return;
    queryClient.invalidateQueries({ queryKey: ['reveal'] });
    router.replace('/reveal');
  }, [instant, goalReached, queryClient, router]);

  // The next batch is on its way (the queue is endless, so this is only ever a short wait).
  useEffect(() => {
    if (data?.status === 'ready' && dishes.length === 0 && !feed.isFetching) feed.refetch();
  }, [data?.status, dishes.length, feed]);

  function onSwipe(dish: Dish, liked: boolean) {
    if (!data) return;
    haptics.soft();
    record.mutate(
      { deckId: data.deck_id, dish, liked },
      {
        // The swipe that completes the match goal gets the success pulse.
        onSuccess: (result) => {
          if (result.status === 'goal_reached') haptics.success();
        },
        onError: (error) => {
          if (!String((error as { message?: string }).message).includes('deck_closed')) {
            Alert.alert("Couldn't save that swipe", 'Please check your connection. The dish is back in your queue.');
          }
        },
      },
    );
  }

  function onUndo() {
    if (!data || undo.isPending) return;
    haptics.soft();
    undo.mutate(data.deck_id, { onError: () => Alert.alert("Couldn't undo", 'Please try again.') });
  }

  // Keep the cards on screen if a refresh fails while some are left.
  if (feed.isError && !feed.data?.dishes.length) {
    return (
      <Screen
        scroll={false}
        contentStyle={styles.center}
        footer={<Button title="Try again" onPress={() => feed.refetch()} />}>
        <Text variant="heading" align="center">
          We couldn&apos;t load your dishes
        </Text>
      </Screen>
    );
  }

  // The reveal time is on the couple's clock; say it on this phone's.
  const revealTime = couple
    ? (() => {
        const { hour, minute } = timeInZoneToLocal(couple.reveal_time, couple.timezone);
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      })()
    : 'the reveal';

  // While the first batch loads there is no data yet: the screen shows its normal layout with a skeleton card.
  if (data && data.status !== 'ready') {
    const sorted = data.status === 'goal_reached';
    const closed = data.status === 'closed';
    return (
      <Screen
        scroll={false}
        contentStyle={styles.screen}
        footer={<Button title="Back home" onPress={() => router.back()} />}>
        <View style={styles.header}>
          <BackButton />
        </View>
        <Animated.View entering={FadeInDown.duration(500)} style={styles.endBody}>
          <Text variant="overline" tone="primary">
            {sorted ? 'Matched' : closed ? 'Revealed' : 'That’s everything'}
          </Text>
          <Text variant="title">
            {sorted ? (
              <>
                Dinner is <Accent>sorted.</Accent>
              </>
            ) : closed ? (
              <>
                Swiping is <Accent>closed.</Accent>
              </>
            ) : (
              <>
                You&apos;ve seen it all <Accent>for now.</Accent>
              </>
            )}
          </Text>
          <Text tone="secondary">
            {sorted
              ? `You both liked enough of the same dishes. We'll show you what matched at ${revealTime}.`
              : closed
                ? "Today's dinner has been revealed. New dishes open tomorrow."
                : instant
                  ? `You've been through every dish that fits you both. Once ${partnerName} is through too, you'll both see tonight's dinner.`
                  : `You've been through every dish that fits you both. We'll work with what you liked and reveal at ${revealTime}.`}
          </Text>
        </Animated.View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} contentStyle={styles.screen}>
      <View style={styles.header}>
        <BackButton />
        <Text variant="overline" tone="tertiary" align="center" style={styles.headerTitle}>
          Tonight
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.deck}>
        {dishes.length ? (
          <SwipeDeck ref={deckRef} recipes={dishes} onSwipe={onSwipe} />
        ) : (
          <DishCardSkeleton />
        )}
      </View>

      <View style={styles.actions}>
        <View style={styles.actionSide}>
          <RoundButton
            label="Undo last swipe"
            glyph="↺"
            size={52}
            disabled={!canUndo || undo.isPending}
            onPress={onUndo}
          />
        </View>
        <View style={styles.actionMain}>
          <RoundButton
            label={dishes[0] ? `Pass on ${dishes[0].title}` : "Pass"}
            glyph="✕"
            size={76}
            disabled={!dishes.length}
            onPress={() => deckRef.current?.swipe(false)}
          />
          <RoundButton
            label={dishes[0] ? `Yum, ${dishes[0].title}` : "Yum"}
            glyph="♥"
            size={76}
            filled
            disabled={!dishes.length}
            onPress={() => deckRef.current?.swipe(true)}
          />
        </View>
        <View style={styles.actionSide} />
      </View>
    </Screen>
  );
}

function RoundButton({
  label,
  glyph,
  size,
  filled,
  disabled,
  onPress,
}: {
  label: string;
  glyph: string;
  size: number;
  filled?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.round,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: filled ? theme.primary : theme.surface,
          borderColor: filled ? theme.primary : theme.borderStrong,
        },
        disabled && { opacity: 0.35 },
      ]}>
      <Text
        maxFontSizeMultiplier={1.2}
        style={{
          fontFamily: Fonts.medium,
          fontSize: size * 0.4,
          lineHeight: size * 0.5,
          color: filled ? theme.onPrimary : theme.text,
        }}>
        {glyph}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: Spacing.lg, paddingBottom: Spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  headerTitle: { flex: 1 },
  headerSpacer: { width: 44 },
  deck: { flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  actionSide: { flex: 1, alignItems: 'flex-start' },
  actionMain: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xl },
  round: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  endBody: { flex: 1, justifyContent: 'center', gap: Spacing.md },
});
