/**
 * What a RevenueCat webhook event means for us: until when does this person's couple have paid access?
 * Pure on purpose (no Deno or Supabase here) so it runs under node in the tests.
 */
export const ENTITLEMENT = 'dinner_roulette_pro';

export type SubscriptionUpdate = { userId: string; productId: string; until: string; eventAt: string };

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

  // shortcut: no lifetime plan is sold, so an event without an expiry is ignored instead of unlocking for ever; handle it by product id if one is added.
  const expires = event.expiration_at_ms;
  if (typeof expires !== 'number' || !Number.isFinite(expires)) return null;
  const until = new Date(expires).toISOString();

  // Each product keeps its own expiry; the couple is unlocked until the latest of them.
  const productId = typeof event.product_id === 'string' && event.product_id ? event.product_id : 'unknown';

  return { userId, productId, until, eventAt: new Date(stamp).toISOString() };
}

/** Compares two secrets without stopping at the first difference, so the time taken says nothing about how close a guess was. */
export function safeEqual(a: string | null, b: string): boolean {
  if (a === null) return false;
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a.charCodeAt(i) || 0) ^ b.charCodeAt(i);
  return diff === 0;
}
