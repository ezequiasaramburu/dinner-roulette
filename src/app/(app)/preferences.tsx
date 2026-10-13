import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { ALLERGENS, DIETS, DISLIKES } from '@/constants/food';
import { useCouple } from '@/hooks/use-couple';
import {
  EMPTY_PREFERENCES,
  useCuisineOptions,
  usePreferences,
  useSavePreferences,
  type Preferences,
} from '@/hooks/use-preferences';

export default function PreferencesScreen() {
  const prefs = usePreferences();
  const cuisines = useCuisineOptions();

  if (prefs.isPending || cuisines.isPending) {
    return (
      <Screen>
        <ActivityIndicator style={{ marginTop: Spacing.six }} />
      </Screen>
    );
  }
  if (prefs.isError || cuisines.isError) {
    return (
      <Screen>
        <ThemedText>We couldn&apos;t load your preferences.</ThemedText>
        <Button
          title="Try again"
          onPress={() => {
            prefs.refetch();
            cuisines.refetch();
          }}
        />
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
    <Screen>
      <ThemedText type="subtitle">{isOnboarding ? 'What do you like to eat?' : 'Your preferences'}</ThemedText>
      <ThemedText themeColor="textSecondary">
        Only you set these. We&apos;ll combine them with your partner&apos;s to pick dinners you can both enjoy.
      </ThemedText>

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

      <Section title="Allergies" hint="We never show dishes with these. Always double-check the ingredient list.">
        {ALLERGENS.map((o) => (
          <Chip
            key={o.id}
            label={o.label}
            emoji={o.emoji}
            selected={prefs.allergens.includes(o.id)}
            onPress={() => setPrefs({ ...prefs, allergens: toggle(prefs.allergens, o.id) })}
          />
        ))}
      </Section>

      <Section title="Favourite cuisines" hint="Pick any, or none to be open to everything.">
        {cuisineOptions.map((country) => (
          <Chip
            key={country}
            label={country}
            selected={prefs.cuisines.includes(country)}
            onPress={() => setPrefs({ ...prefs, cuisines: toggle(prefs.cuisines, country) })}
          />
        ))}
      </Section>

      <Section title="Not for me" hint="Things you'd rather avoid.">
        {DISLIKES.map((o) => (
          <Chip
            key={o.id}
            label={o.label}
            emoji={o.emoji}
            selected={prefs.disliked.includes(o.id)}
            onPress={() => setPrefs({ ...prefs, disliked: toggle(prefs.disliked, o.id) })}
          />
        ))}
      </Section>

      <Button title={isOnboarding ? 'Save and continue' : 'Save'} onPress={onSave} loading={save.isPending} />
      {!isOnboarding ? (
        <Button title="Cancel" variant="secondary" onPress={() => router.back()} />
      ) : null}
    </Screen>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">{title}</ThemedText>
      {hint ? (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two, marginTop: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one },
});
