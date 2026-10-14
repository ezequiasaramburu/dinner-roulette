import { Image } from 'expo-image';
import { Redirect, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Accent, Avatar, Button, Card, Pill, Screen, Text } from '@/components/ui';
import { Fonts, Spacing } from '@/constants/theme';
import { useCouple } from '@/hooks/use-couple';
import { thumbnail, useTodayDeck } from '@/hooks/use-deck';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

function greeting(hour: number) {
  if (hour < 5) return 'Late night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

// Placeholder home. Next up: the daily deck and swiping.
export default function Home() {
  const router = useRouter();
  const theme = useTheme();
  const { data: profile } = useProfile();
  const { data: couple, refetch } = useCouple();
  const partnerReady = !!couple?.partner?.ready;
  const deck = useTodayDeck(partnerReady && !!couple?.me_ready);

  // We can't see the partner's preferences (by design), so poll for their "ready" flag.
  useEffect(() => {
    if (!couple?.me_ready || partnerReady) return;
    const id = setInterval(() => refetch(), 15_000);
    return () => clearInterval(id);
  }, [couple?.me_ready, partnerReady, refetch]);

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Could not sign out', error.message);
  }

  // Everyone chooses their food preferences before seeing the home screen.
  if (couple && !couple.me_ready) return <Redirect href="/preferences" />;

  const me = profile?.display_name ?? 'You';
  const partner = couple?.partner?.display_name ?? 'Your partner';

  return (
    <Screen
      footer={
        <>
          <Button title="Edit my preferences" variant="secondary" onPress={() => router.push('/preferences')} />
          <Button title="Sign out" variant="ghost" onPress={signOut} />
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
        <Card>
          <View style={styles.coupleRow}>
            <View style={styles.avatars}>
              <Avatar name={me} size={60} colorIndex={0} />
              <View style={styles.second}>
                <Avatar name={partner} size={60} colorIndex={1} />
              </View>
            </View>
            <View style={styles.coupleText}>
              <Text variant="heading">
                {me} &amp; {partner}
              </Text>
              {partnerReady ? (
                <Pill label="You're both set" tone="success" />
              ) : (
                <Pill label={`Waiting for ${partner}`} tone="warning" pulse />
              )}
            </View>
          </View>
          {!partnerReady ? (
            <Text variant="caption" tone="secondary" style={styles.note}>
              We&apos;ll start as soon as {partner} chooses their food preferences.
            </Text>
          ) : null}
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).duration(500)}>
        <Card tone="muted">
          <Text variant="overline" tone="tertiary">
            Daily reveal
          </Text>
          <View style={styles.revealRow}>
            <Text style={[styles.time, { color: theme.text }]}>{couple?.reveal_time}</Text>
            <Text variant="caption" tone="secondary" style={styles.tz}>
              {couple?.timezone?.replace('_', ' ')}
            </Text>
          </View>
          <Text variant="caption" tone="secondary">
            That&apos;s when you both find out what&apos;s for dinner.
          </Text>
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300).duration(500)}>
        {deck.data ? (
          <Card tone="accent" padding="lg">
            <Text variant="overline" tone="tertiary">
              Tonight&apos;s deck
            </Text>
            <View style={styles.thumbs}>
              {deck.data.recipes.slice(0, 5).map((recipe, i) => (
                <Image
                  key={recipe.id}
                  source={thumbnail(recipe.image_url)}
                  accessibilityLabel={recipe.title}
                  contentFit="cover"
                  transition={250}
                  style={[styles.thumb, { borderColor: theme.surface, backgroundColor: theme.surfaceMuted }, i > 0 && styles.thumbOverlap]}
                />
              ))}
              {deck.data.recipes.length > 5 ? (
                <View style={[styles.thumb, styles.thumbOverlap, styles.more, { borderColor: theme.surface, backgroundColor: theme.surface }]}>
                  <Text variant="label">+{deck.data.recipes.length - 5}</Text>
                </View>
              ) : null}
            </View>
            <Text variant="bodyStrong">
              {deck.data.recipes.length} dishes picked for the two of you
            </Text>
            <Text variant="caption" tone="secondary">
              {deck.data.recipes.length < 12
                ? `Only ${deck.data.recipes.length} dishes fit both your preferences today.`
                : deck.data.repeat_count > 0
                  ? 'A few favourites are back because your preferences narrow the menu.'
                  : 'Swiping opens in the next update. Same dishes for both of you.'}
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
                  {deck.isError
                    ? "We couldn't load tonight's deck. Pull down to try again soon."
                    : 'Your daily swipe deck starts once you are both set.'}
                </Text>
              </View>
            </View>
          </Card>
        )}
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.sm, marginTop: Spacing.lg },
  coupleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  second: { marginLeft: -16 },
  coupleText: { flex: 1, gap: Spacing.sm },
  note: { marginTop: Spacing.lg },
  revealRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.md, marginVertical: Spacing.sm },
  time: { fontFamily: Fonts.display, fontSize: 56, lineHeight: 62, letterSpacing: -1.5 },
  tz: { flexShrink: 1 },
  soonRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  soonEmoji: { fontSize: 30, lineHeight: 36 },
  soonText: { flex: 1, gap: 2 },
  thumbs: { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.md },
  thumb: { width: 56, height: 56, borderRadius: 28, borderWidth: 3 },
  thumbOverlap: { marginLeft: -14 },
  more: { alignItems: 'center', justifyContent: 'center' },
});
