import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet } from 'react-native';

import { Accent, Button, Chip, Screen, Section, TermsField, Text } from '@/components/ui';
import { ALLERGENS, DIETS, DISLIKES, countryFlag } from '@/constants/food';
import { Spacing } from '@/constants/theme';
import { useCouple } from '@/hooks/use-couple';
import {
  EMPTY_PREFERENCES,
  useCuisineOptions,
  usePreferences,
  useSavePreferences,
  type Preferences,
} from '@/hooks/use-preferences';
import { useTheme } from '@/hooks/use-theme';

export default function PreferencesScreen() {
  const theme = useTheme();
  const prefs = usePreferences();
  const cuisines = useCuisineOptions();

  if (prefs.isPending || cuisines.isPending) {
    return (
      <Screen scroll={false} contentStyle={styles.center}>
        <ActivityIndicator color={theme.primary} />
      </Screen>
    );
  }
  if (prefs.isError || cuisines.isError) {
    return (
      <Screen
        scroll={false}
        contentStyle={styles.center}
        footer={
          <Button
            title="Try again"
            onPress={() => {
              prefs.refetch();
              cuisines.refetch();
            }}
          />
        }>
        <Text variant="heading" align="center">
          We couldn&apos;t load your preferences
        </Text>
      </Screen>
    );
  }

  return (
    <PreferencesForm
      initial={prefs.data ?? EMPTY_PREFERENCES}
      cuisineOptions={cuisines.data.map((c) => c.country)}
    />
  );
}

function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function PreferencesForm({ initial, cuisineOptions }: { initial: Preferences; cuisineOptions: string[] }) {
  const router = useRouter();
  const { data: couple } = useCouple();
  const save = useSavePreferences();
  const [prefs, setPrefs] = useState<Preferences>(initial);
  const isOnboarding = !couple?.me_ready;

  async function onSave() {
    try {
      await save.mutateAsync(prefs);
      router.replace('/');
    } catch {
      Alert.alert('Could not save', 'Please check your connection and try again.');
    }
  }

  return (
    <Screen
      footer={
        <>
          <Button title={isOnboarding ? 'Save and continue' : 'Save changes'} onPress={onSave} loading={save.isPending} />
          {!isOnboarding ? <Button title="Cancel" variant="ghost" onPress={() => router.back()} /> : null}
        </>
      }>
      <Text variant="overline" tone="primary" style={styles.top}>
        Your taste
      </Text>
      <Text variant="title">
        {isOnboarding ? (
          <>
            What do you like <Accent>to eat?</Accent>
          </>
        ) : (
          <>
            Your <Accent>preferences</Accent>
          </>
        )}
      </Text>
      <Text tone="secondary">
        Only you set these. We combine them with your partner&apos;s to find dinners you&apos;ll both enjoy.
      </Text>

      <Section title="Diet">
        {DIETS.map((o) => (
          <Chip
            key={o.id}
            label={o.label}
            emoji={o.emoji}
            selected={prefs.diet === o.id}
            onPress={() => setPrefs({ ...prefs, diet: o.id as Preferences['diet'] })}
          />
        ))}
      </Section>

      <Section
        title="Allergies"
        hint="We never show dishes with these. Always double-check the ingredient list."
        count={prefs.allergens.length + prefs.custom_allergens.length}>
        {ALLERGENS.map((o) => (
          <Chip
            key={o.id}
            label={o.label}
            emoji={o.emoji}
            selected={prefs.allergens.includes(o.id)}
            onPress={() => setPrefs({ ...prefs, allergens: toggle(prefs.allergens, o.id) })}
          />
        ))}
        <TermsField
          label="Anything else you're allergic to?"
          placeholder="e.g. kiwi, mustard, celery"
          terms={prefs.custom_allergens}
          onChange={(custom_allergens) => setPrefs({ ...prefs, custom_allergens })}
        />
      </Section>

      <Section
        title="Favourite cuisines"
        hint="Pick any, or none to be open to everything."
        count={prefs.cuisines.length}>
        {cuisineOptions.map((country) => (
          <Chip
            key={country}
            label={country}
            emoji={countryFlag(country)}
            selected={prefs.cuisines.includes(country)}
            onPress={() => setPrefs({ ...prefs, cuisines: toggle(prefs.cuisines, country) })}
          />
        ))}
      </Section>

      <Section
        title="Not for me"
        hint="Things you'd rather avoid."
        count={prefs.disliked.length + prefs.custom_dislikes.length}>
        {DISLIKES.map((o) => (
          <Chip
            key={o.id}
            label={o.label}
            emoji={o.emoji}
            selected={prefs.disliked.includes(o.id)}
            onPress={() => setPrefs({ ...prefs, disliked: toggle(prefs.disliked, o.id) })}
          />
        ))}
        <TermsField
          label="Anything else you don't like?"
          placeholder="e.g. anchovies, blue cheese"
          terms={prefs.custom_dislikes}
          onChange={(custom_dislikes) => setPrefs({ ...prefs, custom_dislikes })}
        />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  top: { marginTop: Spacing.lg },
});
