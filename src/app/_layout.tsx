import { Fraunces_600SemiBold, Fraunces_600SemiBold_Italic } from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Button, Screen, Text } from '@/components/ui';
import { Fonts } from '@/constants/theme';
import { useScheme, useTheme } from '@/hooks/use-theme';
import { AuthProvider, useAuth } from '@/providers/auth-provider';

SplashScreen.preventAutoHideAsync();

/** A screen crashed: say so kindly and let the person try again, instead of a blank or red screen. */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <Screen scroll={false} contentStyle={{ alignItems: 'center', justifyContent: 'center', gap: 16 }} footer={<Button title="Try again" onPress={retry} />}>
      <Text variant="heading" align="center">
        Something went wrong
      </Text>
      <Text tone="secondary" align="center">
        Sorry about that. Try again, and if it keeps happening, close and reopen the app.
      </Text>
    </Screen>
  );
}

function RootNavigator() {
  const { session, loading } = useAuth();
  const theme = useTheme();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null;

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: theme.background } }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Screen name="legal/[doc]" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const scheme = useScheme();
  const theme = useTheme();
  // One retry is enough: on a dead connection a failure should show up quickly, and the screens have a Try again button.
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, retryDelay: 1000 } } }));

  // React Native has no "window focus": tell React Query when the app comes back, so what went stale while it was away
  // (or while the connection was down) is fetched again.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
    return () => sub.remove();
  }, []);

  const [fontsLoaded, fontError] = useFonts({
    [Fonts.display]: Fraunces_600SemiBold,
    [Fonts.displayItalic]: Fraunces_600SemiBold_Italic,
    [Fonts.body]: Inter_400Regular,
    [Fonts.medium]: Inter_500Medium,
    [Fonts.semibold]: Inter_600SemiBold,
  });

  // Navigation chrome (backgrounds behind screens, transitions) follows our palette, not the default white/black.
  const navTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: theme.primary,
        background: theme.background,
        card: theme.background,
        text: theme.text,
        border: theme.border,
        notification: theme.primary,
      },
    };
  }, [scheme, theme]);

  // Keep the splash up until fonts are ready; if loading fails we still start (system font fallback).
  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={navTheme}>
        <StatusBar style="auto" />
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
