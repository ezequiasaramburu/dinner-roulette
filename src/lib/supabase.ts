import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const rawUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!rawUrl || !anonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local.',
  );
}

// Inside the Android emulator, localhost is the emulator itself; the host machine is 10.0.2.2.
// This lets one .env.local (http://127.0.0.1:54321) work on both the iOS simulator and Android emulator.
const url =
  Platform.OS === 'android' ? rawUrl.replace(/\/\/(127\.0\.0\.1|localhost)\b/, '//10.0.2.2') : rawUrl;

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Only refresh tokens while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

/**
 * Realtime reuses a channel that has the same name, and removeChannel finishes asynchronously. When a screen's effect
 * re-runs straight away (hidden screens coming back, fast refresh) the new subscription would land on the old,
 * already-subscribed channel and throw. A fresh name per subscription avoids that.
 */
export function uniqueSuffix() {
  return Math.random().toString(36).slice(2, 8);
}
