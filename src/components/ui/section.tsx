import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';

type Props = { title: string; hint?: string; count?: number; children: ReactNode };

/** A titled group of controls (e.g. a set of chips), with an optional "N selected" count. */
export function Section({ title, hint, count, children }: Props) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text variant="heading">{title}</Text>
        {count ? (
          <Text variant="label" tone="primary">
            {count} selected
          </Text>
        ) : null}
      </View>
      {hint ? (
        <Text variant="caption" tone="secondary">
          {hint}
        </Text>
      ) : null}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.xs, marginTop: Spacing.lg },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  content: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md },
});
