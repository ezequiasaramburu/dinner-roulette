import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import type { Dish } from '@/hooks/use-swipe-feed';
import { useTheme } from '@/hooks/use-theme';

/** Marks a recipe a person wrote, and says whose it is when it's yours or your partner's. Nothing for catalogue dishes. */
export function CommunityBadge({ dish, partnerName }: { dish: Pick<Dish, 'community' | 'authored_by'>; partnerName?: string | null }) {
  const theme = useTheme();
  if (!dish.community) return null;

  const label =
    dish.authored_by === 'me'
      ? 'Your recipe'
      : dish.authored_by === 'partner'
        ? `${partnerName ?? 'Your partner'}'s recipe`
        : 'Community recipe';

  return (
    <View style={[styles.badge, { backgroundColor: theme.primarySoft }]}>
      <Text variant="label" tone="primary" style={styles.text}>
        ✍️  {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 4 },
  text: { fontSize: 13, lineHeight: 18 },
});
