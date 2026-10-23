// RevenueCat -> Supabase. Set this URL (and the Authorization header value) in the RevenueCat dashboard:
// Integrations (left menu) -> Webhooks -> Add new configuration. See the README, "Subscriptions (RevenueCat)".
import { handle } from './handle.ts';

Deno.serve((request) =>
  handle(request, {
    secret: Deno.env.get('REVENUECAT_WEBHOOK_SECRET'),
    url: Deno.env.get('SUPABASE_URL'),
    key: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  }),
);
