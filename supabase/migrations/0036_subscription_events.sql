-- Subscription events from RevenueCat unlock the couple.
--
-- The webhook (supabase/functions/revenuecat-webhook) calls apply_subscription_event() with the service role only.
-- `p_until` is when the paid access ends ('infinity' for a lifetime purchase; a past date after an expiry or refund).
-- Events can arrive out of order, so an older one never overwrites a newer one (paid_event_at).
-- The buyer is found by their user id (the app tells RevenueCat the Supabase user id); the couple they belong to gets
-- the access, so the partner is covered too. A buyer without a couple is ignored.

alter table public.couples add column paid_event_at timestamptz;

create function public.apply_subscription_event(p_user uuid, p_until timestamptz, p_event_at timestamptz) returns void
language sql security definer set search_path = '' as $$
  update public.couples c
  set paid_until = p_until, paid_event_at = p_event_at
  where c.id = (select m.couple_id from public.couple_members m where m.user_id = p_user)
    and (c.paid_event_at is null or c.paid_event_at <= p_event_at);
$$;

revoke all on function public.apply_subscription_event(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_subscription_event(uuid, timestamptz, timestamptz) to service_role;
