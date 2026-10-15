import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { SwipeAgainNotice } from '@/components/notice-card';
import { HomeMenu, type MenuPath } from '@/components/home/home-menu';
import { RevealedCard } from '@/components/home/revealed-card';
import { TonightCard } from '@/components/home/tonight-card';
import { Accent, Avatar, Button, Card, MenuButton, Pill, Screen, Text } from '@/components/ui';
import { Fonts, Spacing } from '@/constants/theme';
import { enter, exit, reflow } from '@/hooks/use-motion';
import { useCouple, useDinnerRealtime } from '@/hooks/use-couple';
import { useSwipeFeed } from '@/hooks/use-swipe-feed';
import { useDismissNotice, useNotices } from '@/hooks/use-notices';
import { useProfile } from '@/hooks/use-profile';
import { useReminders } from '@/hooks/use-reveal-reminder';
import { useReveal } from '@/hooks/use-reveal';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

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
  const [menuOpen, setMenuOpen] = useState(false);
  const partnerReady = !!couple?.partner?.ready;
  useDinnerRealtime(couple?.couple_id);
  const bothReady = partnerReady && !!couple?.me_ready;
  const feed = useSwipeFeed(bothReady);
  const reveal = useReveal(bothReady);
  const notices = useNotices(bothReady);
  const { permission, request: requestReminders } = useReminders();
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
  useEffect(() => {
    if (!revealAt || reveal.data?.status !== 'pending') return;
    const wait = Math.min(Math.max(new Date(revealAt).getTime() - Date.now(), 0) + 1000, 3_600_000);
    const id = setTimeout(() => {
      refetchReveal();
      refetchFeed();
    }, wait);
    return () => clearTimeout(id);
  }, [revealAt, reveal.data?.status, refetchReveal, refetchFeed]);

  // Coming back to the app after the reveal time: check straight away.
  useFocusEffect(
    useCallback(() => {
      if (bothReady) refetchReveal();
    }, [bothReady, refetchReveal]),
  );

  function go(path: MenuPath) {
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

      <Animated.View entering={enter()} style={styles.header}>
        <Text variant="overline" tone="primary">
          {greeting(new Date().getHours())}
        </Text>
        <Text variant="title">
          {me}, <Accent>dinner awaits.</Accent>
        </Text>
      </Animated.View>

      {notices.data?.filter((n) => n.kind === 'match_goal_changed').map((notice) => (
        <Animated.View key={notice.id} entering={enter()} exiting={exit}>
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

      {notices.data?.filter((n) => n.kind === 'swipe_again_started').map((notice) => (
        <SwipeAgainNotice key={notice.id} notice={notice} />
      ))}

      {revealed ? (
        <Animated.View entering={enter(1)} layout={reflow}>
          <RevealedCard revealed={revealed} onPress={() => router.push('/reveal')} />
        </Animated.View>
      ) : null}

      <Animated.View entering={enter(2)} layout={reflow}>
        <TonightCard feed={feed.data} isError={feed.isError} couple={couple} />
      </Animated.View>

      {/* Only useful while we wait for the partner; once you're both set there is nothing to say. */}
      {!partnerReady ? (
        <Animated.View entering={enter(3)} layout={reflow}>
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
                <Pill label={`Waiting for ${partner}`} tone="warning" pulse />
              </View>
            </View>
          </Card>
        </Animated.View>
      ) : null}

      <Animated.View entering={enter(4)} layout={reflow}>
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
          {!instant && permission === 'undetermined' ? (
            <Button
              title={`Remind me at ${couple?.reveal_time}`}
              variant="secondary"
              onPress={requestReminders}
              style={styles.remind}
            />
          ) : null}
        </Card>
      </Animated.View>

      <HomeMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onNavigate={go}
        onSignOut={signOut}
        me={me}
        partner={partner}
        matchGoal={couple?.match_goal ?? 2}
        revealLabel={instant ? 'When you match' : `At ${couple?.reveal_time ?? '17:00'}`}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.sm },
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
  remind: { marginTop: Spacing.lg },
  noticeText: { marginTop: Spacing.xs, marginBottom: Spacing.md },
  sortedTitle: { marginTop: Spacing.md },
});
