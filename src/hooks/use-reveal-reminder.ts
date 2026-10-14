import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { create } from 'zustand';

import type { CoupleState } from '@/hooks/use-couple';
import { timeInZoneToLocal } from '@/lib/zoned-time';

/**
 * A daily reminder on this phone at the couple's reveal time. It is scheduled on the device, so it needs no server:
 * the time is the same every day and is known in advance. (Telling a partner about a match as it happens is
 * different and needs push from the server, which comes later.)
 */

const CHANNEL = 'reveal';
const ENABLED_KEY = 'reveal-reminder-enabled';

type Permission = 'unknown' | 'undetermined' | 'granted' | 'denied';

type ReminderStore = {
  permission: Permission;
  /** The user's switch for this phone (default on). It only matters once permission is granted. */
  enabled: boolean;
  /** Read the saved switch and the current permission. */
  load: () => Promise<void>;
  refreshPermission: () => Promise<void>;
  /** Ask the system for permission (shows the system prompt the first time). */
  request: () => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
};

async function readPermission(): Promise<Permission> {
  const p = await Notifications.getPermissionsAsync();
  if (p.granted) return 'granted';
  return p.status === Notifications.PermissionStatus.UNDETERMINED ? 'undetermined' : 'denied';
}

/** Android 13+ shows no permission prompt until a channel exists. */
async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Dinner reveal',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export const useReminders = create<ReminderStore>((set, get) => ({
  permission: 'unknown',
  enabled: true,
  load: async () => {
    const saved = await AsyncStorage.getItem(ENABLED_KEY).catch(() => null);
    set({ enabled: saved !== 'false' });
    await get().refreshPermission();
  },
  refreshPermission: async () => set({ permission: await readPermission() }),
  request: async () => {
    await ensureChannel();
    await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true } });
    await get().refreshPermission();
  },
  setEnabled: async (enabled) => {
    set({ enabled });
    await AsyncStorage.setItem(ENABLED_KEY, String(enabled)).catch(() => {});
  },
}));

/**
 * Keeps this phone's scheduled reminder in line with the couple's settings. Mount it once while signed in and paired.
 * It reschedules whenever the reveal time, timezone or mode change, and whenever the app comes back to the foreground
 * (the phone's timezone or daylight saving may have moved the local time).
 */
export function useRevealReminderSync(couple: CoupleState | null | undefined) {
  const { permission, enabled, load, refreshPermission } = useReminders();
  const [foregrounded, setForegrounded] = useState(0);

  useEffect(() => {
    load();
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      refreshPermission();
      setForegrounded((n) => n + 1);
    });
    return () => sub.remove();
  }, [load, refreshPermission]);

  const mode = couple?.reveal_mode;
  const time = couple?.reveal_time;
  const timeZone = couple?.timezone;

  useEffect(() => {
    if (!mode || !time || !timeZone || permission === 'unknown') return;
    let cancelled = false;

    (async () => {
      // This is the only scheduled notification the app uses, so clearing all of them is safe.
      await Notifications.cancelAllScheduledNotificationsAsync();
      if (cancelled || mode !== 'scheduled' || !enabled || permission !== 'granted') return;

      await ensureChannel();
      const { hour, minute } = timeInZoneToLocal(time, timeZone);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Your dinner is revealed 🍽️',
          body: 'Open Dinner Roulette to see what you matched on.',
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: CHANNEL },
      });
    })().catch(() => {
      // A failed schedule must never break the app; it is retried the next time the app opens.
    });

    return () => {
      cancelled = true;
    };
  }, [mode, time, timeZone, permission, enabled, foregrounded]);
}
