import { Pressable, StyleSheet, View } from 'react-native';

import { Pill, Text } from '@/components/ui';
import { countryFlag, dishTypeLabel } from '@/constants/food';
import { Radius, Spacing, elevation } from '@/constants/theme';
import type { Recipe } from '@/hooks/use-reveal';
import { CommunityBadge } from '@/components/dish/community-badge';
import { DishImage } from '@/components/dish/dish-image';
import { useCouple } from '@/hooks/use-couple';
import { useScheme, useTheme } from '@/hooks/use-theme';

/** A revealed dish as a tappable card: photo on top, name and cuisine below. Opens the full recipe. */
export function DishRow({ recipe, onPress }: { recipe: Recipe; onPress: () => void }) {
  const theme = useTheme();
  const scheme = useScheme();
  const { data: couple } = useCouple();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${recipe.title}. Open recipe`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
        elevation(scheme, 2),
        pressed && { opacity: 0.92 },
      ]}>
      <DishImage url={recipe.image_url} size="large" label={recipe.title} style={styles.image} />
      <View style={styles.body}>
        <Text variant="overline" tone="primary">
          {countryFlag(recipe.country)}  {recipe.country}
        </Text>
        <Text variant="heading">{recipe.title}</Text>
        <CommunityBadge dish={recipe} partnerName={couple?.partner?.display_name} />
        <View style={styles.meta}>
          <Pill label={dishTypeLabel(recipe.dish_type)} tone="neutral" dot={false} />
          <Text variant="label" tone="primary">
            See the recipe ›
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.xl, borderWidth: 1, overflow: 'hidden' },
  image: { width: '100%', height: 200 },
  body: { padding: Spacing.lg, gap: Spacing.sm },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.xs },
});
