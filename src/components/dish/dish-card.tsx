import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Pill, Text } from '@/components/ui';
import { allergenLabel, countryFlag, dishTypeLabel } from '@/constants/food';
import { Radius, Spacing, elevation } from '@/constants/theme';
import { thumbnail, type DeckRecipe } from '@/hooks/use-deck';
import { useScheme, useTheme } from '@/hooks/use-theme';

const DIET_LABEL: Record<string, string> = { vegan: 'Vegan', vegetarian: 'Vegetarian', pescatarian: 'Pescatarian' };

/** The visual card for one dish: big photo, then name, cuisine and what to watch out for. */
export function DishCard({ recipe, style }: { recipe: DeckRecipe; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const scheme = useScheme();

  const diet = ['vegan', 'vegetarian', 'pescatarian'].find((d) => recipe.diet_flags.includes(d));
  const contains = recipe.allergens.map(allergenLabel);

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
        <View style={styles.tags}>
          <Pill label={dishTypeLabel(recipe.dish_type)} tone="neutral" dot={false} />
          {diet ? <Pill label={DIET_LABEL[diet]} tone="success" dot={false} /> : null}
        </View>
        {contains.length ? (
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            Contains {contains.join(', ').toLowerCase()}
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
