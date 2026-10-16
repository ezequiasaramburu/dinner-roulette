/**
 * What a RevenueCat webhook event means for us: until when does this person's couple have paid access?
 * Pure on purpose (no Deno or Supabase here) so it runs under node in the tests.
 */
export const ENTITLEMENT = 'dinner_roulette_pro';

export type SubscriptionUpdate = { userId: string; until: string; eventAt: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Anything that is not about a purchase, renewal, change or end of access changes nothing.
const IGNORED = new Set(['TEST', 'TRANSFER', 'SUBSCRIBER_ALIAS', 'SUBSCRIPTION_PAUSED', 'INVOICE_ISSUANCE', 'VIRTUAL_CURRENCY_TRANSACTION']);

export function toSubscriptionUpdate(body: unknown): SubscriptionUpdate | null {
  const event = (body as { event?: Record<string, unknown> } | null)?.event;
  if (!event || typeof event.type !== 'string' || IGNORED.has(event.type)) return null;

  // Anonymous store customers ($RCAnonymousID:...) have no Supabase user to unlock.
  const userId = event.app_user_id;
  if (typeof userId !== 'string' || !UUID.test(userId)) return null;

  // The app sells one entitlement; if the event lists entitlements, ours must be one of them.
  const ids = event.entitlement_ids;
  if (Array.isArray(ids) && ids.length > 0 && !ids.includes(ENTITLEMENT)) return null;

  const stamp = event.event_timestamp_ms;
  if (typeof stamp !== 'number' || !Number.isFinite(stamp)) return null;

  // No expiry on the event means a lifetime purchase.
  const expires = event.expiration_at_ms;
  const until = typeof expires === 'number' && Number.isFinite(expires) ? new Date(expires).toISOString() : 'infinity';

  return { userId, until, eventAt: new Date(stamp).toISOString() };
}
