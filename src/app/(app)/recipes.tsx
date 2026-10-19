import { useRouter } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { DishImage } from '@/components/dish/dish-image';
import { Accent, BackButton, Button, Card, Pill, Screen, Skeleton, Text } from '@/components/ui';
import { countryFlag } from '@/constants/countries';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { enter, exit, reflow } from '@/hooks/use-motion';
import { useAddRecipePath } from '@/hooks/use-add-recipe-path';
import { useDeleteRecipe, useMyRecipes, type MyRecipe } from '@/hooks/use-recipes';
import { friendlyError } from '@/lib/errors';

const STATUS: Record<MyRecipe['status'], { label: string; tone: 'success' | 'warning' | 'neutral'; note: string }> = {
  pending: { label: 'In review', tone: 'warning', note: "We'll publish it once it's been checked." },
  approved: { label: 'Published', tone: 'success', note: 'Other couples can find it in their dinner queue.' },
  rejected: { label: 'Not published', tone: 'neutral', note: "This one didn't make it." },
};

export default function Recipes() {
  const router = useRouter();
  const recipes = useMyRecipes();
  const remove = useDeleteRecipe();
  const addRecipePath = useAddRecipePath();

  function confirmDelete(recipe: MyRecipe) {
    Alert.alert('Delete this recipe?', `"${recipe.title}" will be removed for good.`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => remove.mutate(recipe, { onError: (e) => Alert.alert('Could not delete', friendlyError(e)) }),
      },
    ]);
  }

  return (
    <Screen footer={<Button title="Add a recipe" onPress={() => router.push(addRecipePath)} />}>
      <BackButton />
      <Animated.View entering={enter()} style={styles.stack}>
        <Text variant="overline" tone="primary">
          Your kitchen
        </Text>
        <Text variant="title">
          Your <Accent>recipes</Accent>
        </Text>

        {recipes.isPending ? (
          <RecipeCardsSkeleton />
        ) : recipes.isError && !recipes.data ? (
          <Card tone="muted">
            <Text tone="secondary">We couldn&apos;t load your recipes.</Text>
            <Button title="Try again" variant="secondary" onPress={() => recipes.refetch()} />
          </Card>
        ) : recipes.data.length === 0 ? (
          <Card tone="accent">
            <Text variant="heading">Share a dish you love</Text>
            <Text tone="secondary" style={styles.empty}>
              Recipes you add are checked, then shared with every couple on Dinner Roulette. Yours could be tonight&apos;s
              dinner for someone.
            </Text>
          </Card>
        ) : (
          recipes.data.map((recipe) => {
            const status = STATUS[recipe.status];
            return (
              <Animated.View key={recipe.id} exiting={exit} layout={reflow}>
                <Card padding="lg">
                  {recipe.image_url ? (
                    <DishImage url={recipe.image_url} size="large" label={recipe.title} style={styles.photo} />
                  ) : null}
                  <Text variant="overline" tone="primary">
                    {countryFlag(recipe.country)}  {recipe.country}
                  </Text>
                  <Text variant="heading" style={styles.title}>
                    {recipe.title}
                  </Text>
                  <View style={styles.statusRow}>
                    <Pill label={status.label} tone={status.tone} dot={false} />
                  </View>
                  <Text variant="caption" tone="secondary">
                    {recipe.review_note ?? status.note}
                  </Text>
                  <Button title="Delete" variant="ghost" onPress={() => confirmDelete(recipe)} />
                </Card>
              </Animated.View>
            );
          })
        )}
      </Animated.View>
    </Screen>
  );
}

/** Three recipe cards' worth of placeholders, the same proportions as the real ones. */
function RecipeCardsSkeleton() {
  return (
    <View accessible accessibilityLabel="Loading your recipes" style={styles.stack}>
      {[0, 1, 2].map((i) => (
        <Card key={i} padding="lg">
          <Skeleton style={styles.photo} />
          <Skeleton style={[styles.line, { width: '30%', height: 14 }]} />
          <Skeleton style={[styles.line, styles.title, { width: '70%', height: 24 }]} />
          <View style={styles.statusRow}>
            <Skeleton style={styles.pill} />
          </View>
          <Skeleton style={[styles.line, { width: '85%', height: 14 }]} />
          <View style={styles.deleteSlot}>
            <Skeleton style={[styles.line, { width: 64, height: 16 }]} />
          </View>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.lg, marginTop: Spacing.md },
  line: { borderRadius: 7 },
  pill: { width: 84, height: 26, borderRadius: Radius.pill },
  deleteSlot: { minHeight: ControlHeight, alignItems: 'center', justifyContent: 'center' },
  empty: { marginTop: Spacing.sm },
  title: { marginTop: Spacing.xs },
  photo: { width: '100%', height: 160, borderRadius: Radius.lg, marginBottom: Spacing.md },
  statusRow: { flexDirection: 'row', marginVertical: Spacing.md },
});
