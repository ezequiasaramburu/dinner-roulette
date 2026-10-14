import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { SwipeDeck, type SwipeDeckHandle } from '@/components/dish/swipe-deck';
import { Accent, BackButton, Button, Pill, Screen, Text } from '@/components/ui';
import { Fonts, Spacing } from '@/constants/theme';
import { useCouple } from '@/hooks/use-couple';
import { thumbnail, useRecordSwipe, useTodayDeck, useUndoSwipe, type DeckRecipe } from '@/hooks/use-deck';
import { useTheme } from '@/hooks/use-theme';

export default function Swipe() {
  const router = useRouter();
  const theme = useTheme();
  const { data: couple } = useCouple();
  const deck = useTodayDeck(true);
  const record = useRecordSwipe();
  const undo = useUndoSwipe();
  const deckRef = useRef<SwipeDeckHandle>(null);

  const data = deck.data;
  const total = data?.recipes.length ?? 0;
  const remaining = useMemo<DeckRecipe[]>(
    () => (data ? data.recipes.filter((r) => !(r.id in data.my_swipes)) : []),
    [data],
  );
  const swiped = total - remaining.length;
  const likes = data ? Object.values(data.my_swipes).filter(Boolean).length : 0;

  // Warm the next few photos so cards never appear blank.
  useEffect(() => {
    const urls = remaining.slice(0, 4).map((r) => thumbnail(r.image_url, 'large'));
    if (urls.length) Image.prefetch(urls);
  }, [remaining]);

  function onSwipe(recipe: DeckRecipe, liked: boolean) {
    if (!data) return;
    record.mutate(
      { deckId: data.deck_id, recipeId: recipe.id, liked },
      { onError: () => Alert.alert("Couldn't save that swipe", 'Please check your connection. The dish is back in your deck.') },
    );
  }

  function onUndo() {
    if (!data || undo.isPending) return;
    undo.mutate(data.deck_id, { onError: () => Alert.alert("Couldn't undo", 'Please try again.') });
  }

  if (deck.isPending) {
    return (
      <Screen scroll={false} contentStyle={styles.center}>
        <ActivityIndicator color={theme.primary} />
      </Screen>
    );
  }

  if (deck.isError || !data) {
    return (
      <Screen scroll={false} contentStyle={styles.center} footer={<Button title="Try again" onPress={() => deck.refetch()} />}>
        <Text variant="heading" align="center">
          We couldn&apos;t load tonight&apos;s deck
        </Text>
      </Screen>
    );
  }

  const partner = couple?.partner?.display_name ?? 'your partner';
  const done = remaining.length === 0;

  return (
    <Screen
      scroll={false}
      contentStyle={styles.screen}
      footer={
        done ? (
          <>
            <Button title="Back home" onPress={() => router.back()} />
            {swiped > 0 ? <Button title="Undo last swipe" variant="ghost" onPress={onUndo} loading={undo.isPending} /> : null}
          </>
        ) : undefined
      }>
      <View style={styles.header}>
        <BackButton />
        <View style={styles.progress}>
          <Text variant="label" tone="secondary" align="center">
            {done ? 'All swiped' : `${swiped + 1} of ${total}`}
          </Text>
          <View style={[styles.track, { backgroundColor: theme.surfaceMuted }]}>
            <View style={[styles.fill, { backgroundColor: theme.primary, width: `${total ? (swiped / total) * 100 : 0}%` }]} />
          </View>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {done ? (
        <Animated.View entering={FadeInDown.duration(500)} style={styles.doneBody}>
          <Text variant="overline" tone="primary">
            {likes} of {total} liked
          </Text>
          <Text variant="title">
            That&apos;s the lot. <Accent>Now we wait.</Accent>
          </Text>
          <Text tone="secondary">
            Your picks are locked in and hidden from {partner}. You both find out what&apos;s for dinner at{' '}
            {couple?.reveal_time ?? 'the reveal'}.
          </Text>
          <Pill
            label={
              data.partner_swiped >= total
                ? `${partner} is done too`
                : `${partner} has swiped ${data.partner_swiped} of ${total}`
            }
            tone={data.partner_swiped >= total ? 'success' : 'warning'}
            pulse={data.partner_swiped < total}
          />
        </Animated.View>
      ) : (
        <>
          <View style={styles.deck}>
            <SwipeDeck ref={deckRef} recipes={remaining} onSwipe={onSwipe} />
          </View>
          <View style={styles.actions}>
            <View style={styles.actionSide}>
              <RoundButton label="Undo last swipe" glyph="↺" size={52} disabled={swiped === 0 || undo.isPending} onPress={onUndo} />
            </View>
            <View style={styles.actionMain}>
              <RoundButton label="Pass" glyph="✕" size={76} onPress={() => deckRef.current?.swipe(false)} />
              <RoundButton label="Yum" glyph="♥" size={76} filled onPress={() => deckRef.current?.swipe(true)} />
            </View>
            <View style={styles.actionSide} />
          </View>
        </>
      )}
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
    <Pressable
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
        pressed && { transform: [{ scale: 0.94 }] },
      ]}>
      <Text style={{ fontFamily: Fonts.medium, fontSize: size * 0.4, lineHeight: size * 0.5, color: filled ? theme.onPrimary : theme.text }}>
        {glyph}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: Spacing.lg, paddingBottom: Spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  headerSpacer: { width: 44 },
  progress: { flex: 1, gap: Spacing.sm },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  deck: { flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  actionSide: { flex: 1, alignItems: 'flex-start' },
  actionMain: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xl },
  round: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  doneBody: { flex: 1, justifyContent: 'center', gap: Spacing.md },
});
