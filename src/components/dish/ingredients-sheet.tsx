import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { CommunityActions } from '@/components/dish/community-actions';
import { CommunityBadge } from '@/components/dish/community-badge';
import { DishImage } from '@/components/dish/dish-image';
import { useCouple } from '@/hooks/use-couple';
import type { Dish } from '@/hooks/use-swipe-feed';
import { useTheme } from '@/hooks/use-theme';
import { ingredientList } from '@/lib/main-ingredients';

/** What's in a dish: ingredient names only. Amounts and steps stay hidden until the dinner is revealed. */
export function IngredientsSheet({ dish, onClose }: { dish: Dish | null; onClose: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data: couple } = useCouple();

  return (
    <Modal transparent visible={!!dish} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.scrim, { backgroundColor: theme.overlay }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={onClose} />
        {dish ? (
          <View
            style={[
              styles.sheet,
              { backgroundColor: theme.background, borderColor: theme.border, paddingBottom: insets.bottom + Spacing.lg },
            ]}>
            <View style={[styles.grabber, { backgroundColor: theme.borderStrong }]} />
            <View style={styles.header}>
              <DishImage url={dish.image_url} size="small" label={dish.title} style={styles.thumb} />
              <View style={styles.headerText}>
                <Text variant="overline" tone="primary">
                  What&apos;s in it
                </Text>
                <Text variant="heading" numberOfLines={2}>
                  {dish.title}
                </Text>
                <CommunityBadge dish={dish} partnerName={couple?.partner?.display_name} />
              </View>
            </View>
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {ingredientList(dish.ingredient_names).map((name) => (
                <View key={name} style={[styles.row, { borderBottomColor: theme.border }]}>
                  <View style={[styles.dot, { backgroundColor: theme.primary }]} />
                  <Text>{name}</Text>
                </View>
              ))}
            </ScrollView>
            <Text variant="caption" tone="tertiary" align="center" style={styles.note}>
              Amounts and steps come with the reveal.
            </Text>
            <Button title="Back to swiping" variant="secondary" onPress={onClose} />
            <CommunityActions dish={dish} onDone={onClose} />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '75%',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: Spacing.xs },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  thumb: { width: 56, height: 56, borderRadius: Radius.md },
  headerText: { flex: 1, gap: 2 },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  note: { marginTop: Spacing.xs },
});
