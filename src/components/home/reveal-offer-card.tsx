import { StyleSheet } from 'react-native';

import { RevealNowButton } from '@/components/reveal-now-button';
import { Card, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';

/** Instant mode, both halfway through today's dishes with no match: offer to see what we have. */
export function RevealOfferCard({ partner }: { partner: string }) {
  return (
    <Card tone="muted" padding="lg">
      <Text variant="overline" tone="tertiary">
        No match yet
      </Text>
      <Text variant="bodyStrong" style={styles.title}>
        You&apos;ve swiped half of today&apos;s dishes with no match yet.
      </Text>
      <Text variant="caption" tone="secondary" style={styles.text}>
        Since you&apos;re finding out as soon as you match, do you want to see the best of what you liked now?
      </Text>
      <RevealNowButton partner={partner} />
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: Spacing.md },
  text: { marginTop: Spacing.xs, marginBottom: Spacing.md },
});
