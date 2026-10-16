import { Card, Pill, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import type { CoupleState } from '@/hooks/use-couple';

/** The free trial or the paid period is over: dinner is paused for both partners, nothing is lost. */
export function LockedCard({ couple }: { couple: CoupleState }) {
  const isPayer = couple.role === 'owner';
  const payer = couple.partner?.display_name ?? 'Your partner';

  return (
    <Card tone="accent" padding="lg">
      <Pill label="Paused" tone="warning" dot={false} />
      <Text variant="bodyStrong" style={{ marginTop: Spacing.md }}>
        {isPayer ? 'Your free trial has ended' : `${payer}'s free trial has ended`}
      </Text>
      <Text variant="caption" tone="secondary">
        {isPayer
          ? 'Subscribe to keep finding dinner together. Your preferences and history are saved, and everything comes back as soon as you do.'
          : `Dinner is paused until ${payer} subscribes. Your preferences and history are saved, and everything comes back as soon as they do.`}
      </Text>
    </Card>
  );
}
