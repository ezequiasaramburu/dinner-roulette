import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export default function Welcome() {
  const router = useRouter();

  return (
    <Screen>
      <View style={styles.hero}>
        <ThemedText style={styles.emoji}>🎰🍝</ThemedText>
        <ThemedText type="title">Dinner Roulette</ThemedText>
        <ThemedText themeColor="textSecondary">
          Swipe on tonight&apos;s options together. At the reveal, you both find out what&apos;s for
          dinner.
        </ThemedText>
      </View>

      <View style={styles.actions}>
        <Button title="Continue with email" onPress={() => router.push('/email')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, justifyContent: 'center', gap: Spacing.three, paddingVertical: Spacing.six },
  emoji: { fontSize: 56, lineHeight: 64 },
  actions: { gap: Spacing.three },
});
