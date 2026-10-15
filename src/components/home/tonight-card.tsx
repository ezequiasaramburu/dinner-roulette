import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { DishImage } from '@/components/dish/dish-image';
import { RevealNowButton } from '@/components/reveal-now-button';
import { Card, Pill, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import type { CoupleState } from '@/hooks/use-couple';
import type { SwipeFeed } from '@/hooks/use-swipe-feed';
import { useTheme } from '@/hooks/use-theme';

type Props = { feed: SwipeFeed | undefined; isError: boolean; couple: CoupleState | null | undefined };

/** The home screen's main card: what state tonight's swiping is in. */
export function TonightCard({ feed, isError, couple }: Props) {
  if (feed?.status === 'ready') return <ReadyCard feed={feed} couple={couple} />;
  if (feed?.status === 'closed') return <ClosedCard />;
  if (feed) return <DoneCard feed={feed} couple={couple} />;
  return <WaitingCard isError={isError} couple={couple} />;
}

/** After "swipe again" the second round reveals the instant way, whatever the couple's mode. */
const revealsInstantly = (feed: SwipeFeed, couple: CoupleState | null | undefined) =>
  couple?.reveal_mode === 'instant' || feed.round > 1;

function ReadyCard({ feed, couple }: { feed: SwipeFeed; couple: CoupleState | null | undefined }) {
  const router = useRouter();
  const theme = useTheme();
  const instant = revealsInstantly(feed, couple);
  const findOut = instant ? 'as soon as you match' : `what matched at ${couple?.reveal_time ?? 'the reveal'}`;

  return (
    <Card tone="accent" padding="lg">
      <Text variant="overline" tone="tertiary">
        Tonight
      </Text>
      <View style={styles.thumbs}>
        {feed.dishes.slice(0, 5).map((dish, i) => (
          <DishImage
            key={dish.id}
            url={dish.image_url}
            label={dish.title}
            style={[styles.thumb, { borderColor: theme.surface }, i > 0 && styles.thumbOverlap]}
          />
        ))}
      </View>
      <Text variant="bodyStrong">Find tonight&apos;s dinner</Text>
      <Text variant="caption" tone="secondary">
        Swipe a few dishes whenever you have a minute, as often as you like. You&apos;ll both find out {findOut}.
      </Text>
      {instant && feed.has_swiped ? (
        <RevealNowButton
          partner={couple?.partner?.display_name ?? 'Your partner'}
          onKeepSwiping={() => router.push('/swipe')}
        />
      ) : null}
    </Card>
  );
}

function ClosedCard() {
  return (
    <Card tone="accent" padding="lg">
      <Pill label="Dinner is sorted" tone="success" dot={false} />
      <Text variant="bodyStrong" style={styles.title}>
        Swiping is closed for today
      </Text>
      <Text variant="caption" tone="secondary">
        Today&apos;s dinner has been revealed. New dishes open tomorrow.
      </Text>
    </Card>
  );
}

/** Nothing left to swipe today: either the goal was reached or the queue ran out. */
function DoneCard({ feed, couple }: { feed: SwipeFeed; couple: CoupleState | null | undefined }) {
  const instant = revealsInstantly(feed, couple);
  const sorted = feed.status === 'goal_reached';
  const partner = couple?.partner?.display_name ?? 'your partner';

  let caption: string;
  if (sorted) {
    caption = instant
      ? 'Nothing more to swipe today. New dishes tomorrow.'
      : `Nothing more to swipe. You'll both find out what matched at ${couple?.reveal_time}.`;
  } else {
    caption = instant
      ? `Once ${partner} is through too, you'll both see tonight's dinner. Or reveal it now.`
      : `We'll work with what you liked and reveal at ${couple?.reveal_time}.`;
  }

  return (
    <Card tone="accent" padding="lg">
      <Pill label={sorted ? 'Dinner is sorted' : 'All swiped for now'} tone={sorted ? 'success' : 'neutral'} dot={false} />
      <Text variant="bodyStrong" style={styles.title}>
        {sorted ? 'You found your match' : "You've seen everything for now"}
      </Text>
      <Text variant="caption" tone="secondary">
        {caption}
      </Text>
      {instant && feed.status === 'exhausted' ? (
        <RevealNowButton partner={couple?.partner?.display_name ?? 'Your partner'} />
      ) : null}
    </Card>
  );
}

function WaitingCard({ isError, couple }: { isError: boolean; couple: CoupleState | null | undefined }) {
  const partnerReady = !!couple?.partner?.ready;
  const partner = couple?.partner?.display_name ?? 'Your partner';
  const caption = isError
    ? "We couldn't load your dishes. Check your connection and reopen the app."
    : partnerReady
      ? 'Hang on a second.'
      : `We'll start as soon as ${partner} chooses their food preferences.`;

  return (
    <Card tone="accent" padding="lg">
      <View style={styles.waitingRow}>
        <Text style={styles.emoji}>🍽️</Text>
        <View style={styles.waitingText}>
          <Text variant="bodyStrong">
            {partnerReady ? "Picking tonight's dishes…" : "Tonight's options are on their way"}
          </Text>
          <Text variant="caption" tone="secondary">
            {caption}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: Spacing.md },
  thumbs: { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.md },
  thumb: { width: 56, height: 56, borderRadius: 28, borderWidth: 3 },
  thumbOverlap: { marginLeft: -14 },
  waitingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  emoji: { fontSize: 30, lineHeight: 36 },
  waitingText: { flex: 1, gap: 2 },
});
