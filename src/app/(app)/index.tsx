import { Image } from 'expo-image';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Accent, Avatar, Button, Card, Pill, Screen, Text } from '@/components/ui';
import { Fonts, Spacing } from '@/constants/theme';
import { useCouple } from '@/hooks/use-couple';
import { thumbnail, useSwipeFeed } from '@/hooks/use-swipe-feed';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';

function greeting(hour: number) {
  if (hour < 5) return 'Late night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Home() {
  const router = useRouter();
  const theme = useTheme();
  const { data: profile } = useProfile();
  const { data: couple, refetch } = useCouple();
  const partnerReady = !!couple?.partner?.ready;
  const feed = useSwipeFeed(partnerReady && !!couple?.me_ready);

  // We can't see the partner's preferences (by design), so poll for their "ready" flag.
  useEffect(() => {
    if (!couple?.me_ready || partnerReady) return;
    const id = setInterval(() => refetch(), 15_000);
    return () => clearInterval(id);
  }, [couple?.me_ready, partnerReady, refetch]);

  // While the home screen is showing, check now and then whether the couple has reached its match goal.
  const refetchFeed = feed.refetch;
  const status = feed.data?.status;
  useFocusEffect(
    useCallback(() => {
      if (status !== 'ready') return;
      const id = setInterval(() => refetchFeed(), 30_000);
      return () => clearInterval(id);
    }, [status, refetchFeed]),
  );

  // Everyone chooses their food preferences before seeing the home screen.
  if (couple && !couple.me_ready) return <Redirect href="/preferences" />;

  const me = profile?.display_name ?? 'You';
  const partner = couple?.partner?.display_name ?? 'Your partner';
  const revealTime = couple?.reveal_time ?? 'the reveal';
  const forToday = feed.data?.for_today ?? true;

  return (
    <Screen
      footer={
        <>
          {status === 'ready' ? (
            <Button title={feed.data?.has_swiped ? 'Keep swiping' : 'Start swiping'} onPress={() => router.push('/swipe')} />
          ) : null}
          <Button title="Settings" variant={status === 'ready' ? 'ghost' : 'secondary'} onPress={() => router.push('/settings')} />
        </>
      }>
      <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
        <Text variant="overline" tone="primary">
          {greeting(new Date().getHours())}
        </Text>
        <Text variant="title">
          {me}, <Accent>dinner awaits.</Accent>
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(100).duration(500)}>
        {feed.data && feed.data.status === 'ready' ? (
          <Card tone="accent" padding="lg">
            <Text variant="overline" tone="tertiary">
              {forToday ? 'Tonight' : 'For tomorrow'}
            </Text>
            <View style={styles.thumbs}>
              {feed.data.dishes.slice(0, 5).map((dish, i) => (
                <Image
                  key={dish.id}
                  source={thumbnail(dish.image_url)}
                  accessibilityLabel={dish.title}
                  contentFit="cover"
                  transition={250}
                  style={[styles.thumb, { borderColor: theme.surface, backgroundColor: theme.surfaceMuted }, i > 0 && styles.thumbOverlap]}
                />
              ))}
            </View>
            <Text variant="bodyStrong">{forToday ? "Find tonight's dinner" : "Find tomorrow's dinner"}</Text>
            <Text variant="caption" tone="secondary">
              Swipe a few dishes whenever you have a minute, as often as you like. You&apos;ll both find out what matched at{' '}
              {revealTime}.
            </Text>
          </Card>
        ) : feed.data ? (
          <Card tone="accent" padding="lg">
            <Pill
              label={feed.data.status === 'goal_reached' ? 'Dinner is sorted' : 'All swiped for now'}
              tone={feed.data.status === 'goal_reached' ? 'success' : 'neutral'}
              dot={false}
            />
            <Text variant="bodyStrong" style={styles.sortedTitle}>
              {feed.data.status === 'goal_reached' ? 'You found your match' : "You've seen everything for now"}
            </Text>
            <Text variant="caption" tone="secondary">
              {feed.data.status === 'goal_reached'
                ? `Nothing more to swipe. You'll both find out what matched at ${revealTime}.`
                : `We'll work with what you liked and reveal at ${revealTime}.`}
            </Text>
          </Card>
        ) : (
          <Card tone="accent" padding="lg">
            <View style={styles.soonRow}>
              <Text style={styles.soonEmoji}>🍽️</Text>
              <View style={styles.soonText}>
                <Text variant="bodyStrong">{partnerReady ? "Picking tonight's dishes…" : "Tonight's options are on their way"}</Text>
                <Text variant="caption" tone="secondary">
                  {feed.isError
                    ? "We couldn't load your dishes. Check your connection and reopen the app."
                    : partnerReady
                      ? 'Hang on a second.'
                      : `We'll start as soon as ${partner} chooses their food preferences.`}
                </Text>
              </View>
            </View>
          </Card>
        )}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).duration(500)}>
        <Card>
          <View style={styles.coupleRow}>
            <View style={styles.avatars}>
              <Avatar name={me} size={52} colorIndex={0} />
              <View style={styles.second}>
                <Avatar name={partner} size={52} colorIndex={1} />
              </View>
            </View>
            <View style={styles.coupleText}>
              <Text variant="bodyStrong">
                {me} &amp; {partner}
              </Text>
              {partnerReady ? (
                <Pill label="You're both set" tone="success" />
              ) : (
                <Pill label={`Waiting for ${partner}`} tone="warning" pulse />
              )}
            </View>
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300).duration(500)}>
        <Card tone="muted" padding="lg">
          <View style={styles.revealRow}>
            <View>
              <Text variant="overline" tone="tertiary">
                Daily reveal
              </Text>
              <Text style={[styles.time, { color: theme.text }]}>{couple?.reveal_time}</Text>
            </View>
            <Text variant="caption" tone="secondary" style={styles.tz}>
              {couple?.timezone?.replace('_', ' ')}
              {'\n'}You both find out what&apos;s for dinner.
            </Text>
          </View>
        </Card>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.sm, marginTop: Spacing.sm },
  coupleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  second: { marginLeft: -14 },
  coupleText: { flex: 1, gap: Spacing.sm },
  revealRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: Spacing.lg },
  time: { fontFamily: Fonts.display, fontSize: 44, lineHeight: 50, letterSpacing: -1 },
  tz: { flex: 1, textAlign: 'right', paddingBottom: 6 },
  soonRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  soonEmoji: { fontSize: 30, lineHeight: 36 },
  soonText: { flex: 1, gap: 2 },
  thumbs: { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.md },
  thumb: { width: 56, height: 56, borderRadius: 28, borderWidth: 3 },
  thumbOverlap: { marginLeft: -14 },
  more: { alignItems: 'center', justifyContent: 'center' },
  sortedTitle: { marginTop: Spacing.md },
});
