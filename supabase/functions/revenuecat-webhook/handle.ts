import { safeEqual, toSubscriptionUpdate } from './parse.ts';

export type Env = { secret?: string; url?: string; key?: string };

/** The webhook itself, with its settings and `fetch` passed in so the tests can run it under node. */
export async function handle(request: Request, env: Env, send: typeof fetch = fetch): Promise<Response> {
  // Without a secret nobody can be trusted, so refuse everything rather than accept anyone.
  if (!env.secret || !safeEqual(request.headers.get('Authorization'), env.secret)) return new Response('Unauthorized', { status: 401 });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const update = toSubscriptionUpdate(body);
  if (!update) return new Response('Ignored', { status: 200 });

  if (!env.url || !env.key) return new Response('Server not configured', { status: 500 });

  const result = await send(`${env.url}/rest/v1/rpc/apply_subscription_event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.key, Authorization: `Bearer ${env.key}` },
    body: JSON.stringify({ p_user: update.userId, p_product: update.productId, p_until: update.until, p_event_at: update.eventAt }),
  });
  // A non-2xx makes RevenueCat retry later, which is what we want for a temporary failure.
  return new Response(result.ok ? 'OK' : 'Failed', { status: result.ok ? 200 : 500 });
}
