import { StyleSheet, View } from 'react-native';

import { Skeleton } from '@/components/ui/skeleton';
import { Radius, Spacing, elevation } from '@/constants/theme';
import { useScheme, useTheme } from '@/hooks/use-theme';

/** What a swipe card looks like before its dish arrives. Same frame and rough proportions as DishCard, so nothing jumps. */
export function DishCardSkeleton() {
  const theme = useTheme();
  const scheme = useScheme();

  return (
    <View
      accessible
      accessibilityLabel="Loading dishes"
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, elevation(scheme, 2)]}>
      <Skeleton style={styles.image} />
      <View style={styles.body}>
        <Skeleton style={[styles.line, { width: '32%', height: 14 }]} />
        <View style={styles.title}>
          <Skeleton style={[styles.line, { width: '88%', height: 22 }]} />
          <Skeleton style={[styles.line, { width: '58%', height: 22 }]} />
        </View>
        <Skeleton style={[styles.line, { width: '92%', height: 14 }]} />
        <Skeleton style={[styles.line, { width: '70%', height: 14 }]} />
        <Skeleton style={styles.pill} />
      </View>
    </View>
  );
}

// Mirrors the frame of DishCard (card, image, body spacing).
const styles = StyleSheet.create({
  card: { flex: 1, borderRadius: Radius.xl, borderWidth: 1, overflow: 'hidden' },
  image: { flex: 1, minHeight: 200, borderRadius: 0 },
  body: { padding: Spacing.lg, gap: Spacing.sm },
  title: { minHeight: 56, gap: Spacing.sm, justifyContent: 'center' },
  line: { borderRadius: 7 },
  pill: { width: 92, height: 26, borderRadius: Radius.pill },
});
