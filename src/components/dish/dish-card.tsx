import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Pill, Text } from '@/components/ui';
import { allergenLabel, countryFlag, dishTypeLabel } from '@/constants/food';
import { Radius, Spacing, elevation } from '@/constants/theme';
import { thumbnail, type Dish } from '@/hooks/use-swipe-feed';
import { useScheme, useTheme } from '@/hooks/use-theme';
import { ingredientLine, ingredientList, mainIngredients } from '@/lib/main-ingredients';

const DIET_LABEL: Record<string, string> = { vegan: 'Vegan', vegetarian: 'Vegetarian', pescatarian: 'Pescatarian' };

/** The visual card for one dish: big photo, then name, cuisine and what to watch out for. */
export function DishCard({ recipe, style }: { recipe: Dish; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const scheme = useScheme();

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
      <Image
        source={thumbnail(recipe.image_url, 'large')}
        accessibilityLabel={recipe.title}
        contentFit="cover"
        transition={200}
        style={[styles.image, { backgroundColor: theme.surfaceMuted }]}
      />
      <View style={styles.body}>
        <Text variant="overline" tone="primary">
          {countryFlag(recipe.country)}  {recipe.country}
        </Text>
        <Text variant="heading" numberOfLines={2} style={styles.title}>
          {recipe.title}
        </Text>
        {line ? (
          <Text variant="caption" tone="secondary" numberOfLines={2}>
            {line}
            {more > 0 ? <Text variant="caption" tone="primary">{`  +${more} more`}</Text> : null}
          </Text>
        ) : null}
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
  card: { flex: 1, borderRadius: Radius.xl, borderWidth: 1, overflow: 'hidden' },
  image: { flex: 1, minHeight: 200 },
  body: { padding: Spacing.lg, gap: Spacing.sm },
  title: { minHeight: 56 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
