import { StyleSheet, View } from 'react-native';

import { DishImage } from '@/components/dish/dish-image';
import { Card, Text } from '@/components/ui';
import { Fonts, Spacing } from '@/constants/theme';
import type { Reveal } from '@/hooks/use-reveal';
import { useTheme } from '@/hooks/use-theme';

type Revealed = Extract<Reveal, { status: 'revealed' }>;

/** Today's dinner has been revealed: a gift until you open it, then the dish itself. */
export function RevealedCard({ revealed, onPress }: { revealed: Revealed; onPress: () => void }) {
  const theme = useTheme();
  const first = revealed.dishes[0];
  const action = !revealed.seen
    ? 'Reveal dinner'
    : revealed.dishes.length > 1
      ? `See all ${revealed.dishes.length} dishes`
      : 'See the recipe';

  return (
    <Card
      padding="lg"
      onPress={onPress}
      accessibilityLabel={revealed.seen ? "Open tonight's recipe" : "Open tonight's dinner"}
      style={{ borderColor: theme.primary, borderWidth: 1.5 }}>
      <View style={styles.row}>
        {revealed.seen && first ? (
          <DishImage url={first.image_url} label={first.title} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.mystery, { backgroundColor: theme.primarySoft }]}>
            <Text style={styles.gift}>🎁</Text>
          </View>
        )}
        <View style={styles.text}>
          <Text variant="overline" tone="primary">
            {revealed.seen ? "Tonight's dinner" : 'New'}
          </Text>
          <Text variant="heading" numberOfLines={2}>
            {revealed.seen ? (first?.title ?? "Tonight's dinner") : "It's time to find out"}
          </Text>
          <Text variant="label" tone="primary">
            {action}
          </Text>
        </View>
        <View style={[styles.chevron, { backgroundColor: theme.primary }]}>
          <Text style={[styles.chevronText, { color: theme.onPrimary }]}>›</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  thumb: { width: 72, height: 72, borderRadius: 20 },
  mystery: { alignItems: 'center', justifyContent: 'center' },
  gift: { fontSize: 30, lineHeight: 36 },
  text: { flex: 1, gap: 2 },
  chevron: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  chevronText: { fontFamily: Fonts.medium, fontSize: 26, lineHeight: 30, marginTop: -2, marginLeft: 2 },
});
