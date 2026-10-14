import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Accent, BackButton, Button, Card, Pill, Screen, Text } from '@/components/ui';
import { countryFlag } from '@/constants/countries';
import { Spacing } from '@/constants/theme';
import { useDeleteRecipe, useMyRecipes, type MyRecipe } from '@/hooks/use-recipes';
import { useTheme } from '@/hooks/use-theme';
import { friendlyError } from '@/lib/errors';

const STATUS: Record<MyRecipe['status'], { label: string; tone: 'success' | 'warning' | 'neutral'; note: string }> = {
  pending: { label: 'In review', tone: 'warning', note: "We'll publish it once it's been checked." },
  approved: { label: 'Published', tone: 'success', note: 'Other couples can find it in their dinner queue.' },
  rejected: { label: 'Not published', tone: 'neutral', note: "This one didn't make it." },
};

export default function Recipes() {
  const router = useRouter();
  const theme = useTheme();
  const recipes = useMyRecipes();
  const remove = useDeleteRecipe();

  function confirmDelete(recipe: MyRecipe) {
    Alert.alert('Delete this recipe?', `"${recipe.title}" will be removed for good.`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => remove.mutate(recipe.id, { onError: (e) => Alert.alert('Could not delete', friendlyError(e)) }),
      },
    ]);
  }

  return (
    <Screen footer={<Button title="Add a recipe" onPress={() => router.push('/add-recipe')} />}>
      <BackButton />
      <Animated.View entering={FadeInDown.duration(500)} style={styles.stack}>
        <Text variant="overline" tone="primary">
          Your kitchen
        </Text>
        <Text variant="title">
          Your <Accent>recipes</Accent>
        </Text>

        {recipes.isPending ? (
          <ActivityIndicator color={theme.primary} style={styles.loading} />
        ) : recipes.isError ? (
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
              <Card key={recipe.id} padding="lg">
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
            );
          })
        )}
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.lg, marginTop: Spacing.md },
  loading: { marginTop: Spacing.xl },
  empty: { marginTop: Spacing.sm },
  title: { marginTop: Spacing.xs },
  statusRow: { flexDirection: 'row', marginVertical: Spacing.md },
});
