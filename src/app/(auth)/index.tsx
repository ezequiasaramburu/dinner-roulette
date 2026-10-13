import { useRouter } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { signInWithApple } from '@/lib/apple-auth';

export default function Welcome() {
  const router = useRouter();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

  async function onApple() {
    setAppleLoading(true);
    try {
      await signInWithApple();
    } catch (e) {
      Alert.alert('Sign in failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setAppleLoading(false);
    }
  }

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
        {appleAvailable ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={14}
            style={styles.apple}
            onPress={appleLoading ? () => {} : onApple}
          />
        ) : null}
        <Button
          title="Continue with email"
          variant={appleAvailable ? 'secondary' : 'primary'}
          onPress={() => router.push('/email')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, justifyContent: 'center', gap: Spacing.three, paddingVertical: Spacing.six },
  emoji: { fontSize: 56, lineHeight: 64 },
  actions: { gap: Spacing.three },
  apple: { height: 52, width: '100%' },
});
