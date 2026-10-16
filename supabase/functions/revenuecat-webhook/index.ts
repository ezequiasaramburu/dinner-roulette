// RevenueCat -> Supabase. Set this URL (and the Authorization header value) in the RevenueCat dashboard:
// Integrations (left menu) -> Webhooks -> Add new configuration. See the README, "Subscriptions (RevenueCat)".
import { toSubscriptionUpdate } from './parse.ts';

Deno.serve(async (request) => {
  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  // Without a secret nobody can be trusted, so refuse everything rather than accept anyone.
  if (!secret || request.headers.get('Authorization') !== secret) return new Response('Unauthorized', { status: 401 });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const update = toSubscriptionUpdate(body);
  if (!update) return new Response('Ignored', { status: 200 });

  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return new Response('Server not configured', { status: 500 });

  const result = await fetch(`${url}/rest/v1/rpc/apply_subscription_event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify({ p_user: update.userId, p_product: update.productId, p_until: update.until, p_event_at: update.eventAt }),
  });
  // A non-2xx makes RevenueCat retry later, which is what we want for a temporary failure.
  return new Response(result.ok ? 'OK' : 'Failed', { status: result.ok ? 200 : 500 });
});
