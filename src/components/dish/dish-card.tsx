import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Pill, Text } from '@/components/ui';
import { allergenLabel, countryFlag, dishTypeLabel } from '@/constants/food';
import { Radius, Spacing, elevation } from '@/constants/theme';
import { CommunityBadge } from '@/components/dish/community-badge';
import { DishImage } from '@/components/dish/dish-image';
import { useCouple } from '@/hooks/use-couple';
import type { Dish } from '@/hooks/use-swipe-feed';
import { useScheme, useTheme } from '@/hooks/use-theme';
import { ingredientLine, ingredientList, mainIngredients } from '@/lib/main-ingredients';

const DIET_LABEL: Record<string, string> = { vegan: 'Vegan', vegetarian: 'Vegetarian', pescatarian: 'Pescatarian' };

/** The visual card for one dish: big photo, then name, cuisine and what to watch out for. */
export function DishCard({ recipe, style }: { recipe: Dish; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const scheme = useScheme();
  const { data: couple } = useCouple();

  const diet = ['vegan', 'vegetarian', 'pescatarian'].find((d) => recipe.diet_flags.includes(d));
  const contains = recipe.allergens.map(allergenLabel);
  const line = ingredientLine(recipe.ingredient_names);
  const more = ingredientList(recipe.ingredient_names).length - mainIngredients(recipe.ingredient_names).length;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
        elevation(scheme, 2),
        style,
      ]}>
      <DishImage url={recipe.image_url} size="large" label={recipe.title} style={styles.image} />
      <View style={styles.body}>
        <View style={styles.countryRow}>
          <Text variant="overline" tone="primary" numberOfLines={1} style={styles.country}>
            {countryFlag(recipe.country)}  {recipe.country}
          </Text>
          {recipe.has_video ? (
            <View accessible accessibilityLabel="Has a video" style={[styles.video, { backgroundColor: theme.primarySoft }]}>
              <Ionicons name="play-circle" size={14} color={theme.primary} />
              <Text variant="overline" tone="primary">
                Video
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="heading" numberOfLines={2} style={styles.title}>
          {recipe.title}
        </Text>
        {line ? (
          <Text variant="caption" tone="secondary" numberOfLines={2}>
            {line}
            {more > 0 ? <Text variant="caption" tone="primary">{`  +${more} more`}</Text> : null}
          </Text>
        ) : null}
        <CommunityBadge dish={recipe} partnerName={couple?.partner?.display_name} />
        <View style={styles.tags}>
          <Pill label={dishTypeLabel(recipe.dish_type)} tone="neutral" dot={false} />
          {diet ? <Pill label={DIET_LABEL[diet]} tone="success" dot={false} /> : null}
        </View>
        {contains.length ? (
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            Contains {contains.join(', ').toLowerCase()}
          </Text>
        ) : null}
        {recipe.swaps.length ? (
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            Easy swap: {recipe.swaps[0].to} for {recipe.swaps[0].from}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, borderRadius: Radius.xl, borderWidth: 1 },
  image: { flex: 1, minHeight: 200, borderTopLeftRadius: Radius.xl - 1, borderTopRightRadius: Radius.xl - 1 },
  body: { padding: Spacing.lg, gap: Spacing.sm },
  title: { minHeight: 56 },
  countryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  country: { flexShrink: 1 },
  video: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.pill },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
