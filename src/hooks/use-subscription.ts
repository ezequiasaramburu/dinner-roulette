import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import type { CoupleState } from '@/hooks/use-couple';
import { purchasesAvailable, showCustomerCenter, showPaywall, watchPro } from '@/lib/purchases';
import { useAuth } from '@/providers/auth-provider';

/** Whether this phone's store customer owns the paid entitlement (the server's `has_access` is what unlocks the app). */
export function useIsPro() {
  const [isPro, setIsPro] = useState(false);
  useEffect(() => watchPro(setIsPro), []);
  return isPro;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Open the paywall; after a purchase, wait for the server (the webhook) to unlock the couple. */
export function useSubscribe() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const key = ['couple', session?.user.id];
  const [busy, setBusy] = useState(false);

  async function subscribe() {
    if (!purchasesAvailable()) {
      Alert.alert('Subscriptions are not available yet', 'Please try again in a moment.');
      return;
    }
    const outcome = await showPaywall();
    if (outcome === 'unavailable') {
      Alert.alert("Couldn't open the plans", 'Please try again in a moment.');
      return;
    }
    if (outcome === 'closed') return;
    // The store knows right away; our server hears about it from RevenueCat a few seconds later.
    setBusy(true);
    for (let i = 0; i < 10; i++) {
      await queryClient.refetchQueries({ queryKey: key });
      if (queryClient.getQueryData<CoupleState | null>(key)?.has_access) break;
      await sleep(1500);
    }
    setBusy(false);
  }

  return { subscribe, busy, manage: showCustomerCenter };
}
