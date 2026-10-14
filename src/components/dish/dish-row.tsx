import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { Pill, Text } from '@/components/ui';
import { countryFlag, dishTypeLabel } from '@/constants/food';
import { Radius, Spacing, elevation } from '@/constants/theme';
import type { Recipe } from '@/hooks/use-reveal';
import { thumbnail } from '@/hooks/use-swipe-feed';
import { useScheme, useTheme } from '@/hooks/use-theme';

/** A revealed dish as a tappable card: photo on top, name and cuisine below. Opens the full recipe. */
export function DishRow({ recipe, onPress }: { recipe: Recipe; onPress: () => void }) {
  const theme = useTheme();
  const scheme = useScheme();

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
      <Image
        source={thumbnail(recipe.image_url, 'large')}
        accessibilityLabel={recipe.title}
        contentFit="cover"
        transition={250}
        style={[styles.image, { backgroundColor: theme.surfaceMuted }]}
      />
      <View style={styles.body}>
        <Text variant="overline" tone="primary">
          {countryFlag(recipe.country)}  {recipe.country}
        </Text>
        <Text variant="heading">{recipe.title}</Text>
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
