/**
 * RevenueCat, kept behind a few small functions. The native modules are loaded lazily inside a try/catch (like
 * haptics), so the app still runs on a dev build made before the SDK was added, or without an API key: everything
 * here then quietly does nothing and `purchasesAvailable()` says false.
 *
 * The server decides who has access (couples.paid_until, set by the RevenueCat webhook). The SDK only sells the
 * subscription and tells this phone what the store knows.
 */
import type { CustomerInfo } from 'react-native-purchases';

type Sdk = typeof import('react-native-purchases').default;
type Ui = typeof import('react-native-purchases-ui').default;

/** The entitlement the paid products unlock (monthly and yearly both grant it). */
export const ENTITLEMENT = 'dinner_roulette_pro';

const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;

let sdk: Sdk | null | undefined;
let ui: Ui | null | undefined;

function loadSdk(): Sdk | null {
  if (sdk === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy on purpose, see the note above
      sdk = API_KEY ? (require('react-native-purchases') as { default: Sdk }).default : null;
    } catch {
      sdk = null;
    }
  }
  return sdk;
}

function loadUi(): Ui | null {
  if (ui === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy on purpose, see the note above
      ui = (require('react-native-purchases-ui') as { default: Ui }).default;
    } catch {
      ui = null;
    }
  }
  return ui;
}

export const purchasesAvailable = () => !!loadSdk() && !!loadUi();

export const hasPro = (info: CustomerInfo) => info.entitlements.active[ENTITLEMENT] !== undefined;

let configured = false;

/** Tie the store customer to the signed-in user (the webhook finds the couple by this id). */
export async function signInPurchases(userId: string): Promise<void> {
  const purchases = loadSdk();
  if (!purchases || !API_KEY) return;
  try {
    if (!configured) {
      purchases.configure({ apiKey: API_KEY, appUserID: userId });
      configured = true;
    } else {
      await purchases.logIn(userId);
    }
  } catch {
    // Selling is optional for the rest of the app to work; the next sign-in tries again.
  }
}

export async function signOutPurchases(): Promise<void> {
  const purchases = loadSdk();
  if (!purchases || !configured) return;
  try {
    // logOut throws if the customer is already anonymous; there is nothing to undo then.
    await purchases.logOut();
  } catch {}
}

/** Calls back with whether this phone's customer owns the entitlement, now and on every change. Returns the unsubscribe. */
export function watchPro(onChange: (isPro: boolean) => void): () => void {
  const purchases = loadSdk();
  if (!purchases) return () => {};
  const listener = (info: CustomerInfo) => onChange(hasPro(info));
  try {
    purchases.getCustomerInfo().then(listener, () => {});
    purchases.addCustomerInfoUpdateListener(listener);
  } catch {
    return () => {};
  }
  return () => {
    try {
      purchases.removeCustomerInfoUpdateListener(listener);
    } catch {}
  };
}

export type PaywallOutcome = 'purchased' | 'restored' | 'closed' | 'unavailable';

/** Shows the paywall built in the RevenueCat dashboard (the current offering). */
export async function showPaywall(): Promise<PaywallOutcome> {
  const paywalls = loadUi();
  if (!paywalls || !loadSdk()) return 'unavailable';
  try {
    const result = await paywalls.presentPaywall();
    if (result === paywalls.PAYWALL_RESULT.PURCHASED) return 'purchased';
    if (result === paywalls.PAYWALL_RESULT.RESTORED) return 'restored';
    return result === paywalls.PAYWALL_RESULT.ERROR || result === paywalls.PAYWALL_RESULT.NOT_PRESENTED ? 'unavailable' : 'closed';
  } catch {
    return 'unavailable';
  }
}

/** Manage, cancel or restore from the RevenueCat Customer Center (configured in the dashboard). */
export async function showCustomerCenter(): Promise<boolean> {
  const paywalls = loadUi();
  if (!paywalls || !loadSdk()) return false;
  try {
    await paywalls.presentCustomerCenter();
    return true;
  } catch {
    return false;
  }
}
