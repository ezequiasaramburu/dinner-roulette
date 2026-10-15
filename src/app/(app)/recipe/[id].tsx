import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { BackButton, Button, Card, Pill, PressableScale, Screen, Text } from '@/components/ui';
import { allergenLabel, countryFlag, dishTypeLabel } from '@/constants/food';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { enter } from '@/hooks/use-motion';
import { useReveal } from '@/hooks/use-reveal';
import { CommunityActions } from '@/components/dish/community-actions';
import { CommunityBadge } from '@/components/dish/community-badge';
import { DishImage } from '@/components/dish/dish-image';
import { useCouple } from '@/hooks/use-couple';
import { useTheme } from '@/hooks/use-theme';

/** The full recipe for one revealed dish: ingredients to tick off, numbered steps, and the source's video. */
export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const reveal = useReveal(true);
  const { data: couple } = useCouple();
  const [have, setHave] = useState<Set<number>>(new Set());

  const recipe = reveal.data?.status === 'revealed' ? reveal.data.dishes.find((d) => d.id === id) : undefined;

  if (!recipe) {
    return (
      <Screen>
        <BackButton />
        <Text variant="heading">{reveal.isPending ? 'Loading…' : 'This recipe is no longer available'}</Text>
        {!reveal.isPending ? <Text tone="secondary">Recipes are available once the reveal has happened.</Text> : null}
      </Screen>
    );
  }

  const contains = recipe.allergens.map(allergenLabel);

  function toggle(i: number) {
    setHave((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <Screen>
      <BackButton />

      <Animated.View entering={enter()} style={styles.stack}>
        <DishImage url={recipe.image_url} size="large" label={recipe.title} style={styles.image} />
        <View style={styles.header}>
          <Text variant="overline" tone="primary">
            {countryFlag(recipe.country)}  {recipe.country}
          </Text>
          <Text variant="title">{recipe.title}</Text>
          <CommunityBadge dish={recipe} partnerName={couple?.partner?.display_name} />
          <View style={styles.tags}>
            <Pill label={dishTypeLabel(recipe.dish_type)} tone="neutral" dot={false} />
            {recipe.diet_flags.includes('vegan') ? (
              <Pill label="Vegan" tone="success" dot={false} />
            ) : recipe.diet_flags.includes('vegetarian') ? (
              <Pill label="Vegetarian" tone="success" dot={false} />
            ) : recipe.diet_flags.includes('pescatarian') ? (
              <Pill label="Pescatarian" tone="success" dot={false} />
            ) : null}
          </View>
        </View>

        <Card tone="muted" padding="lg">
          <Text variant="overline" tone="tertiary">
            Allergens
          </Text>
          <Text variant="bodyStrong" style={styles.allergenLine}>
            {contains.length ? `Contains ${contains.join(', ').toLowerCase()}` : 'No common allergens found'}
          </Text>
          <Text variant="caption" tone="secondary">
            This is worked out automatically from the ingredient list and can be wrong. Always check the ingredients
            and product labels yourself before cooking.
          </Text>
        </Card>

        {recipe.swaps.length ? (
          <Card tone="accent" padding="lg">
            <Text variant="overline" tone="tertiary">
              Easy swap
            </Text>
            {recipe.swaps.map((swap) => (
              <Text key={swap.from} variant="bodyStrong" style={styles.allergenLine}>
                Use {swap.to} instead of {swap.from}
              </Text>
            ))}
            <Text variant="caption" tone="secondary">
              The original uses meat stock. With this swap the dish suits a vegetarian diet.
            </Text>
          </Card>
        ) : null}

        <View style={styles.section}>
          <Text variant="heading">Ingredients</Text>
          <View>
            {recipe.ingredients.map((ing, i) => {
              const done = have.has(i);
              return (
                <PressableScale
                  haptic="select"
                  key={`${ing.name}-${i}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: done }}
                  accessibilityLabel={`${ing.measure} ${ing.name}`.trim()}
                  onPress={() => toggle(i)}
                  style={[styles.ingredient, { borderBottomColor: theme.border }]}>
                  <View
                    style={[
                      styles.box,
                      { borderColor: done ? theme.success : theme.borderStrong, backgroundColor: done ? theme.success : 'transparent' },
                    ]}>
                    {done ? <Text style={[styles.tick, { color: theme.surface }]}>✓</Text> : null}
                  </View>
                  <Text style={[styles.ingredientName, done && { color: theme.textTertiary, textDecorationLine: 'line-through' }]}>
                    {ing.name}
                  </Text>
                  <Text variant="caption" tone="secondary" style={styles.measure}>
                    {ing.measure}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text variant="heading">Method</Text>
          {recipe.steps.map((step, i) => (
            <View key={i} style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: theme.primarySoft }]}>
                <Text style={[styles.stepNumberText, { color: theme.primary }]}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        {recipe.youtube_url || recipe.source_url ? (
          <View style={styles.links}>
            {recipe.youtube_url ? (
              <Button title="Watch the video" variant="secondary" onPress={() => Linking.openURL(recipe.youtube_url!)} />
            ) : null}
            {recipe.source_url ? (
              <Button title="Original recipe" variant="ghost" onPress={() => Linking.openURL(recipe.source_url!)} />
            ) : null}
          </View>
        ) : null}

        <CommunityActions dish={recipe} />
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.xl },
  image: { width: '100%', height: 240, borderRadius: Radius.xl },
  header: { gap: Spacing.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  allergenLine: { marginTop: Spacing.xs, marginBottom: Spacing.xs },
  section: { gap: Spacing.md },
  ingredient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 48,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  box: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  tick: { fontFamily: Fonts.semibold, fontSize: 13, lineHeight: 16 },
  ingredientName: { flex: 1 },
  measure: { maxWidth: '40%', textAlign: 'right' },
  step: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  stepNumber: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumberText: { fontFamily: Fonts.semibold, fontSize: 14, lineHeight: 18 },
  stepText: { flex: 1 },
  links: { gap: Spacing.sm },
});
