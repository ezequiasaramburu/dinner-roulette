import { Image } from 'expo-image';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Accent, Avatar, Button, Card, MenuButton, MenuItem, Pill, Screen, SideMenu, Text } from '@/components/ui';
import { Fonts, Spacing } from '@/constants/theme';
import { useCouple, useDinnerRealtime } from '@/hooks/use-couple';
import { thumbnail, useSwipeFeed } from '@/hooks/use-swipe-feed';
import { useDismissNotice, useNotices } from '@/hooks/use-notices';
import { useProfile } from '@/hooks/use-profile';
import { useReveal } from '@/hooks/use-reveal';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

function greeting(hour: number) {
  if (hour < 5) return 'Late night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function revealedTitle(titles: string[]) {
  if (titles.length === 0) return "Open tonight's dinner";
  if (titles.length === 1) return titles[0];
  return `${titles[0]} and ${titles.length - 1} more`;
}

export default function Home() {
  const router = useRouter();
  const theme = useTheme();
  const { data: profile } = useProfile();
  const { data: couple, refetch } = useCouple();
  const [menuOpen, setMenuOpen] = useState(false);
  const partnerReady = !!couple?.partner?.ready;
  useDinnerRealtime(couple?.couple_id);
  const bothReady = partnerReady && !!couple?.me_ready;
  const feed = useSwipeFeed(bothReady);
  const reveal = useReveal(bothReady);
  const notices = useNotices(bothReady);
  const dismissNotice = useDismissNotice();
  const refetchReveal = reveal.refetch;
  const revealAt = reveal.data?.reveal_at;
  const revealed = reveal.data?.status === 'revealed' ? reveal.data : undefined;

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

  // The reveal opens by itself: wait for the reveal moment (the timer is capped, so long waits re-check hourly),
  // then fetch the result and tomorrow's queue.
  const refetchFeedNow = feed.refetch;
  useEffect(() => {
    if (!revealAt || reveal.data?.status !== 'pending') return;
    const wait = Math.min(Math.max(new Date(revealAt).getTime() - Date.now(), 0) + 1000, 3_600_000);
    const id = setTimeout(() => {
      refetchReveal();
      refetchFeedNow();
    }, wait);
    return () => clearTimeout(id);
  }, [revealAt, reveal.data?.status, refetchReveal, refetchFeedNow]);

  // Coming back to the app after the reveal time: check straight away.
  useFocusEffect(
    useCallback(() => {
      if (bothReady) refetchReveal();
    }, [bothReady, refetchReveal]),
  );

  function go(path: '/preferences' | '/settings') {
    setMenuOpen(false);
    router.push(path);
  }

  async function signOut() {
    setMenuOpen(false);
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Could not sign out', error.message);
  }

  // Everyone chooses their food preferences before seeing the home screen.
  if (couple && !couple.me_ready) return <Redirect href="/preferences" />;

  const me = profile?.display_name ?? 'You';
  const partner = couple?.partner?.display_name ?? 'Your partner';
  const instant = couple?.reveal_mode === 'instant';
  const findOut = instant ? 'as soon as you match' : `what matched at ${couple?.reveal_time ?? 'the reveal'}`;
  const forToday = feed.data?.for_today ?? true;

  return (
    <Screen
      footer={
        status === 'ready' ? (
          <Button
            title={feed.data?.has_swiped ? 'Keep swiping' : 'Start swiping'}
            onPress={() => router.push('/swipe')}
          />
        ) : undefined
      }>
      <MenuButton onPress={() => setMenuOpen(true)} />

      <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
        <Text variant="overline" tone="primary">
          {greeting(new Date().getHours())}
        </Text>
        <Text variant="title">
          {me}, <Accent>dinner awaits.</Accent>
        </Text>
      </Animated.View>

      {notices.data?.map((notice) => (
        <Animated.View key={notice.id} entering={FadeInDown.duration(400)}>
          <Card tone="muted" padding="lg">
            <Text variant="bodyStrong">
              {partner} changed matches per day from {notice.from_value} to {notice.to_value}
            </Text>
            <Text variant="caption" tone="secondary" style={styles.noticeText}>
              You&apos;ll keep swiping until you&apos;ve both liked{' '}
              {notice.to_value === 1 ? 'a dish' : `${notice.to_value} of the same dishes`}. You can change it in
              Settings.
            </Text>
            <Button title="Got it" variant="secondary" onPress={() => dismissNotice.mutate(notice.id)} />
          </Card>
        </Animated.View>
      ))}

      {revealed ? (
        <Animated.View entering={FadeInDown.delay(60).duration(500)}>
          <Card
            tone="accent"
            padding="lg"
            onPress={() => router.push('/reveal')}
            accessibilityLabel="Open tonight's dinner">
            <Pill
              label={revealed.seen ? 'Tonight' : 'New'}
              tone={revealed.seen ? 'neutral' : 'success'}
              dot={!revealed.seen}
            />
            <Text variant="heading" style={styles.sortedTitle}>
              {revealed.seen ? revealedTitle(revealed.dishes.map((d) => d.title)) : "Tonight's dinner is revealed"}
            </Text>
            <Text variant="caption" tone="secondary">
              {revealed.seen ? 'Tap to see the recipe.' : 'Tap to find out what you matched on.'}
            </Text>
          </Card>
        </Animated.View>
      ) : null}

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
                  style={[
                    styles.thumb,
                    {
                      borderColor: theme.surface,
                      backgroundColor: theme.surfaceMuted,
                    },
                    i > 0 && styles.thumbOverlap,
                  ]}
                />
              ))}
            </View>
            <Text variant="bodyStrong">{forToday ? "Find tonight's dinner" : "Find tomorrow's dinner"}</Text>
            <Text variant="caption" tone="secondary">
              Swipe a few dishes whenever you have a minute, as often as you like. You&apos;ll both find out {findOut}.
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
                ? instant
                  ? 'Nothing more to swipe today. New dishes tomorrow.'
                  : `Nothing more to swipe. You'll both find out what matched at ${couple?.reveal_time}.`
                : instant
                  ? 'Check back tomorrow for new dishes.'
                  : `We'll work with what you liked and reveal at ${couple?.reveal_time}.`}
            </Text>
          </Card>
        ) : (
          <Card tone="accent" padding="lg">
            <View style={styles.soonRow}>
              <Text style={styles.soonEmoji}>🍽️</Text>
              <View style={styles.soonText}>
                <Text variant="bodyStrong">
                  {partnerReady ? "Picking tonight's dishes…" : "Tonight's options are on their way"}
                </Text>
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
          {instant ? (
            <>
              <Text variant="overline" tone="tertiary">
                Reveal
              </Text>
              <Text variant="heading" style={styles.sortedTitle}>
                The moment you both match
              </Text>
              <Text variant="caption" tone="secondary">
                No waiting for a set time: as soon as you&apos;ve both liked{' '}
                {couple?.match_goal === 1 ? 'a dish' : `${couple?.match_goal ?? 2} of the same dishes`}, you both find
                out what&apos;s for dinner.
              </Text>
            </>
          ) : (
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
          )}
        </Card>
      </Animated.View>

      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)}>
        <View style={styles.menuHeader}>
          <Avatar name={me} size={56} colorIndex={0} />
          <View style={styles.menuHeaderText}>
            <Text variant="heading">{me}</Text>
            <Text variant="caption" tone="secondary">
              with {partner}
            </Text>
          </View>
        </View>
        <View style={styles.menuItems}>
          <MenuItem
            emoji="🥗"
            label="Food preferences"
            caption="Diet, allergies and tastes"
            onPress={() => go('/preferences')}
          />
          <MenuItem
            emoji="⚙️"
            label="Settings"
            caption="Matches per day and reveal time"
            onPress={() => go('/settings')}
          />
        </View>
        <View style={styles.menuSpacer} />
        <MenuItem emoji="👋" label="Sign out" onPress={signOut} />
      </SideMenu>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.sm },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  menuHeaderText: { flex: 1, gap: 2 },
  menuItems: { gap: Spacing.xs },
  menuSpacer: { flex: 1 },
  coupleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  second: { marginLeft: -14 },
  coupleText: { flex: 1, gap: Spacing.sm },
  revealRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.lg,
  },
  time: {
    fontFamily: Fonts.display,
    fontSize: 44,
    lineHeight: 50,
    letterSpacing: -1,
  },
  tz: { flex: 1, textAlign: 'right', paddingBottom: 6 },
  soonRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  soonEmoji: { fontSize: 30, lineHeight: 36 },
  soonText: { flex: 1, gap: 2 },
  thumbs: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  thumb: { width: 56, height: 56, borderRadius: 28, borderWidth: 3 },
  thumbOverlap: { marginLeft: -14 },
  more: { alignItems: 'center', justifyContent: 'center' },
  noticeText: { marginTop: Spacing.xs, marginBottom: Spacing.md },
  sortedTitle: { marginTop: Spacing.md },
});
