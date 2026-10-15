import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { DishRow } from '@/components/dish/dish-row';
import { Accent, BackButton, Button, RouletteWheel, Screen, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { enter } from '@/hooks/use-motion';
import { useCouple } from '@/hooks/use-couple';
import { useMarkRevealSeen, useReveal, useSwipeAgain } from '@/hooks/use-reveal';
import { friendlyError } from '@/lib/errors';

const SPIN_MS = 3000;

/** The big moment: the wheel spins once, then today's dinner appears. Opening it again skips straight to the dishes. */
export default function RevealScreen() {
  const router = useRouter();
  const { data: couple } = useCouple();
  const reveal = useReveal(true);
  const markSeen = useMarkRevealSeen();
  const swipeAgain = useSwipeAgain();
  const data = reveal.data?.status === 'revealed' ? reveal.data : undefined;

  // The wheel only spins the first time this person opens the reveal.
  const [playIntro] = useState(() => !data?.seen);
  const [spun, setSpun] = useState(false);
  const showDishes = !!data && (!playIntro || spun);

  useEffect(() => {
    if (!data || !playIntro) return;
    const id = setTimeout(() => setSpun(true), SPIN_MS);
    return () => clearTimeout(id);
  }, [data, playIntro]);

  const markSeenMutate = markSeen.mutate;
  const deckId = data?.deck_id;
  const seen = data?.seen;
  useEffect(() => {
    if (showDishes && deckId && !seen) markSeenMutate(deckId);
  }, [showDishes, deckId, seen, markSeenMutate]);

  // The reveal went away under us (your partner swiped again): back to the start, not a spinner.
  const reopened = reveal.data?.status === 'pending';
  const startedHere = swipeAgain.isPending || swipeAgain.isSuccess;
  useEffect(() => {
    if (reopened && !startedHere) router.dismissTo('/');
  }, [reopened, startedHere, router]);

  const partner = couple?.partner?.display_name ?? 'your partner';

  function onSwipeAgain() {
    Alert.alert(
      'Swipe again?',
      `You didn't match, so you get one more round with a new set of dishes. Tonight's dinner is replaced for both of you, and ${partner} will be asked to swipe too. You can do this once.`,
      [
        { text: 'Keep this dinner', style: 'cancel' },
        {
          text: 'Swipe again',
          onPress: () =>
            swipeAgain.mutate(undefined, {
              onSuccess: () => router.replace('/swipe'),
              onError: (e) => Alert.alert('Error', friendlyError(e)),
            }),
        },
      ],
    );
  }

  if (!data || !showDishes) {
    return (
      <Screen scroll={false} contentStyle={styles.center}>
        {reveal.isError ? (
          <>
            <Text variant="heading" align="center">
              We couldn&apos;t open the reveal
            </Text>
            <Text tone="secondary" align="center">
              Check your connection and try again.
            </Text>
            <Button title="Try again" onPress={() => reveal.refetch()} />
          </>
        ) : data ? (
          <>
            <RouletteWheel size={280} spin />
            <Text variant="heading" align="center" style={styles.spinning}>
              Spinning…
            </Text>
          </>
        ) : (
          <ActivityIndicator />
        )}
      </Screen>
    );
  }

  const copy = {
    match: {
      title: (
        <>
          You both said <Accent>yes.</Accent>
        </>
      ),
      caption:
        data.dishes.length > 1
          ? 'You each liked all of these. Pick whichever you feel like tonight.'
          : 'You each liked this one. Time to cook.',
    },
    closest: {
      title: (
        <>
          No perfect match, <Accent>but close.</Accent>
        </>
      ),
      caption: `You didn't like the same dish, so these are the ones one of you picked. Your turn to compromise with ${partner}.`,
    },
    surprise: {
      title: (
        <>
          We picked <Accent>for you.</Accent>
        </>
      ),
      caption: 'Nothing got a yes from either of you, so this is the best fit for both your tastes.',
    },
    none: {
      title: (
        <>
          Nothing to <Accent>cook</Accent> tonight
        </>
      ),
      caption: "We couldn't find a dish that suits you both. Check your food preferences and try again tomorrow.",
    },
  }[data.kind];

  return (
    <Screen
      footer={
        <>
          {data.can_swipe_again ? (
            <Button title="Not feeling it? Swipe again" onPress={onSwipeAgain} loading={swipeAgain.isPending} />
          ) : null}
          <Button title="Back home" variant="secondary" onPress={() => router.dismissTo('/')} />
        </>
      }>
      <BackButton />
      <Animated.View entering={enter()} style={styles.header}>
        <Text variant="overline" tone="primary">
          Tonight&apos;s dinner
        </Text>
        <Text variant="title">{copy.title}</Text>
        <Text tone="secondary">{copy.caption}</Text>
      </Animated.View>

      <View style={styles.list}>
        {data.dishes.map((recipe, i) => (
          <Animated.View key={recipe.id} entering={FadeIn.delay(300 + i * 200).duration(500)}>
            <DishRow recipe={recipe} onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: recipe.id } })} />
          </Animated.View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  spinning: { marginTop: Spacing.xl },
  header: { gap: Spacing.sm },
  list: { gap: Spacing.lg },
});
