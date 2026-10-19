import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { DishImage } from '@/components/dish/dish-image';
import { Accent, BackButton, Button, Card, CountryField, PressableScale, Screen, Text, TextField } from '@/components/ui';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { enter } from '@/hooks/use-motion';
import { useProfile } from '@/hooks/use-profile';
import { useSubmitRecipe } from '@/hooks/use-recipes';
import { useTheme } from '@/hooks/use-theme';
import { friendlyError } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { pickRecipePhoto, type PickedPhoto } from '@/lib/recipe-photo';

type Ingredient = { id: number; name: string; measure: string };
type Step = { id: number; text: string };
type Errors = { title?: string; country?: string; ingredients?: string; steps?: string; photo?: string; terms?: string };

const MIN_INGREDIENTS = 3;
const MAX_INGREDIENTS = 30;
const MAX_STEPS = 25;
const LINK = /(https?:|www\.)/i;

export default function AddRecipe() {
  const router = useRouter();
  const theme = useTheme();
  const { data: profile } = useProfile();
  const submit = useSubmitRecipe();
  const nextId = useRef(100);
  const id = () => nextId.current++;

  const [title, setTitle] = useState('');
  const [country, setCountry] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { id: 1, name: '', measure: '' },
    { id: 2, name: '', measure: '' },
    { id: 3, name: '', measure: '' },
  ]);
  const [steps, setSteps] = useState<Step[]>([
    { id: 1, text: '' },
    { id: 2, text: '' },
  ]);
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  // Accepting the terms is asked once, with the first recipe.
  const needsTerms = !!profile && !profile.terms_accepted_at;

  const filledIngredients = ingredients
    .map((i) => ({ name: i.name.trim(), measure: i.measure.trim() }))
    .filter((i) => i.name);
  const filledSteps = steps.map((s) => s.text.trim()).filter(Boolean);

  function validate(): Errors {
    const found: Errors = {};
    const t = title.trim();
    if (t.length < 3 || t.length > 80) found.title = 'Give it a title of 3 to 80 characters';
    if (!country) found.country = 'Choose where the dish comes from';
    if (filledIngredients.length < MIN_INGREDIENTS) found.ingredients = `Add at least ${MIN_INGREDIENTS} ingredients`;
    else if (filledIngredients.some((i) => i.name.length > 60 || i.measure.length > 40))
      found.ingredients = 'Keep names under 60 characters and amounts under 40';
    if (filledSteps.length < 1) found.steps = 'Add at least one step';
    else if (filledSteps.some((s) => s.length < 3 || s.length > 600))
      found.steps = 'Each step needs a few words, and under 600 characters';
    const everything = [t, ...filledIngredients.flatMap((i) => [i.name, i.measure]), ...filledSteps].join(' ');
    if (LINK.test(everything)) found.steps = found.steps ?? "Links aren't allowed. Write it in your own words";
    if (!photo) found.photo = 'Add a photo of your dish';
    if (needsTerms && !accepted) found.terms = 'Please confirm to share your recipe';
    return found;
  }

  async function pickPhoto(source: 'camera' | 'library') {
    setPickingPhoto(true);
    try {
      const picked = await pickRecipePhoto(source);
      if (picked === 'denied') {
        Alert.alert('Camera access is off', 'Allow the camera for Dinner Roulette in your phone settings, or choose a photo from your library.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open settings', onPress: () => Linking.openSettings() },
        ]);
      } else if (picked) {
        setPhoto(picked);
      }
    } catch {
      Alert.alert("Couldn't use that photo", source === 'camera' ? "The camera isn't available. Try choosing a photo instead." : 'Please try another one.');
    } finally {
      setPickingPhoto(false);
    }
  }

  function addPhoto() {
    Alert.alert('Add a photo', 'Only share photos you took yourself.', [
      { text: 'Take a photo', onPress: () => pickPhoto('camera') },
      { text: 'Choose from library', onPress: () => pickPhoto('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function onSubmit() {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;

    try {
      await submit.mutateAsync({
        title: title.trim(),
        country,
        ingredients: filledIngredients,
        steps: filledSteps,
        photoUri: photo?.uri ?? null,
        acceptTerms: accepted || !needsTerms,
      });
      haptics.success();
      Alert.alert('Thank you!', "Your recipe is in review. We'll publish it once it's checked, and you can follow it in Your recipes.");
      router.replace('/recipes');
    } catch (e) {
      Alert.alert("Couldn't share your recipe", friendlyError(e));
    }
  }

  const updateIngredient = (rowId: number, patch: Partial<Ingredient>) =>
    setIngredients((rows) => rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
  const updateStep = (rowId: number, text: string) =>
    setSteps((rows) => rows.map((r) => (r.id === rowId ? { ...r, text } : r)));

  // The button waits until every rule above passes, so the errors only matter if something slips past it.
  const canSubmit = Object.keys(validate()).length === 0;

  return (
    <Screen
      footer={<Button title="Submit for review" onPress={onSubmit} loading={submit.isPending} disabled={!canSubmit} />}>
      <BackButton />

      <Animated.View entering={enter()} style={styles.stack}>
        <Text variant="overline" tone="primary">
          Share a dish
        </Text>
        <Text variant="title">
          Add a <Accent>recipe</Accent>
        </Text>
        <Text tone="secondary">
          Write it in your own words. We check every recipe before anyone sees it, and everyone&apos;s allergies and
          diets are applied automatically from the ingredients you list.
        </Text>

        <TextField
          label="Recipe title"
          placeholder="e.g. Grandma's lentil soup"
          value={title}
          onChangeText={setTitle}
          error={errors.title}
          maxLength={80}
          autoCapitalize="sentences"
          returnKeyType="next"
        />

        <CountryField label="Where is it from?" value={country} onChange={setCountry} error={errors.country} />

        <View style={styles.group}>
          <Text variant="heading">Ingredients</Text>
          <Text variant="caption" tone="secondary">
            At least {MIN_INGREDIENTS}. List the amount if you like, e.g. &quot;2 cups&quot; or &quot;200 g&quot;.
          </Text>
          {ingredients.map((row, index) => (
            <View key={row.id} style={styles.ingredientRow}>
              <View style={styles.ingredientName}>
                <TextField
                  label={`Ingredient ${index + 1}`}
                  hideLabel
                  placeholder="Ingredient"
                  value={row.name}
                  onChangeText={(name) => updateIngredient(row.id, { name })}
                  maxLength={60}
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.ingredientAmount}>
                <TextField
                  label={`Amount ${index + 1}`}
                  hideLabel
                  placeholder="Amount"
                  value={row.measure}
                  onChangeText={(measure) => updateIngredient(row.id, { measure })}
                  maxLength={40}
                  autoCapitalize="none"
                />
              </View>
              {ingredients.length > MIN_INGREDIENTS ? (
                <RemoveButton
                  label={`Remove ingredient ${index + 1}`}
                  onPress={() => setIngredients((rows) => rows.filter((r) => r.id !== row.id))}
                />
              ) : (
                <View style={styles.removeSpace} />
              )}
            </View>
          ))}
          {errors.ingredients ? (
            <Text variant="caption" tone="danger">
              {errors.ingredients}
            </Text>
          ) : null}
          {ingredients.length < MAX_INGREDIENTS ? (
            <Button
              title="Add an ingredient"
              variant="secondary"
              onPress={() => setIngredients((rows) => [...rows, { id: id(), name: '', measure: '' }])}
            />
          ) : null}
        </View>

        <View style={styles.group}>
          <Text variant="heading">Steps</Text>
          <Text variant="caption" tone="secondary">
            One short step at a time, in order.
          </Text>
          {steps.map((row, index) => (
            <View key={row.id} style={styles.stepRow}>
              <View style={[styles.stepNumber, { backgroundColor: theme.primarySoft }]}>
                <Text variant="label" tone="primary">
                  {index + 1}
                </Text>
              </View>
              <View style={styles.stepText}>
                <TextField
                  label={`Step ${index + 1}`}
                  hideLabel
                  placeholder="What to do"
                  value={row.text}
                  onChangeText={(text) => updateStep(row.id, text)}
                  multiline
                  maxLength={600}
                  style={styles.multiline}
                />
              </View>
              {steps.length > 1 ? (
                <RemoveButton
                  label={`Remove step ${index + 1}`}
                  onPress={() => setSteps((rows) => rows.filter((r) => r.id !== row.id))}
                />
              ) : (
                <View style={styles.removeSpace} />
              )}
            </View>
          ))}
          {errors.steps ? (
            <Text variant="caption" tone="danger">
              {errors.steps}
            </Text>
          ) : null}
          {steps.length < MAX_STEPS ? (
            <Button
              title="Add a step"
              variant="secondary"
              onPress={() => setSteps((rows) => [...rows, { id: id(), text: '' }])}
            />
          ) : null}
        </View>

        <View style={styles.group}>
          <Text variant="heading">Photo</Text>
          <Text variant="caption" tone="secondary">
            Required. A good photo makes people want to cook it. Only share photos you took yourself.
          </Text>
          {photo ? (
            <>
              <DishImage url={photo.uri} size="large" label="Your photo" style={styles.photo} />
              <View style={styles.photoActions}>
                <Button title="Change photo" variant="secondary" onPress={addPhoto} loading={pickingPhoto} style={styles.photoButton} />
                <Button title="Remove" variant="ghost" onPress={() => setPhoto(null)} style={styles.photoButton} />
              </View>
            </>
          ) : (
            <Button title="Add a photo" variant="secondary" onPress={addPhoto} loading={pickingPhoto} />
          )}
        </View>

        {needsTerms ? (
          <Card tone="muted" padding="lg">
            <PressableScale
              haptic="select"
              accessibilityRole="checkbox"
              accessibilityState={{ checked: accepted }}
              onPress={() => setAccepted((v) => !v)}
              style={styles.terms}>
              <View
                style={[
                  styles.box,
                  { borderColor: errors.terms ? theme.danger : theme.borderStrong },
                  accepted && { backgroundColor: theme.primary, borderColor: theme.primary },
                ]}>
                {accepted ? (
                  <Text variant="label" style={{ color: theme.onPrimary }}>
                    ✓
                  </Text>
                ) : null}
              </View>
              <Text variant="caption" style={styles.termsText}>
                I wrote this recipe myself, any photo is mine, and I agree to the{' '}
                <Text variant="caption" tone="primary" onPress={() => router.push('/legal/terms')}>
                  Terms of Use
                </Text>
                .
              </Text>
            </PressableScale>
            {errors.terms ? (
              <Text variant="caption" tone="danger" style={styles.termsError}>
                {errors.terms}
              </Text>
            ) : null}
          </Card>
        ) : null}
      </Animated.View>
    </Screen>
  );
}

function RemoveButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.remove, { backgroundColor: pressed ? theme.surfaceMuted : 'transparent' }]}>
      <Text tone="tertiary">✕</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.lg, marginTop: Spacing.md },
  group: { gap: Spacing.md, marginTop: Spacing.md },
  ingredientRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  ingredientName: { flex: 3 },
  ingredientAmount: { flex: 2 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  stepNumber: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  stepText: { flex: 1 },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: Radius.lg },
  photoActions: { flexDirection: 'row', gap: Spacing.md },
  photoButton: { flex: 1 },
  multiline: { minHeight: 80, paddingTop: Spacing.md, textAlignVertical: 'top' },
  remove: { width: 36, height: ControlHeight, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md },
  removeSpace: { width: 36 },
  terms: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  termsText: { flex: 1 },
  termsError: { marginTop: Spacing.sm },
});
