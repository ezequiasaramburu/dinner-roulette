-- A couple's paid access is the LATEST expiry across its subscription products, not whatever event came last.
--
-- 0036 let the newest event overwrite paid_until. With two products running side by side (monthly still renewing
-- while a yearly was bought), a late monthly renewal shortened access to the monthly expiry. Now each product keeps its
-- own row (the newest event per product wins) and couples.paid_until is the maximum over them. A refund or expiry on one
-- product still ends that product's access; the other keeps the couple unlocked.

create table public.couple_subscriptions (
  couple_id uuid not null references public.couples (id) on delete cascade,
  product_id text not null,
  until timestamptz not null,
  event_at timestamptz not null,
  primary key (couple_id, product_id)
);

alter table public.couple_subscriptions enable row level security;
revoke all on public.couple_subscriptions from anon, authenticated;

drop function public.apply_subscription_event(uuid, timestamptz, timestamptz);

create function public.apply_subscription_event(p_user uuid, p_product text, p_until timestamptz, p_event_at timestamptz)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_couple uuid;
begin
  select m.couple_id into v_couple from public.couple_members m where m.user_id = p_user;
  if v_couple is null then return; end if;

  insert into public.couple_subscriptions (couple_id, product_id, until, event_at)
  values (v_couple, p_product, p_until, p_event_at)
  on conflict (couple_id, product_id) do update
    set until = excluded.until, event_at = excluded.event_at
    where public.couple_subscriptions.event_at <= excluded.event_at;

  update public.couples c
  set paid_until = (select max(s.until) from public.couple_subscriptions s where s.couple_id = c.id),
      paid_event_at = greatest(coalesce(c.paid_event_at, p_event_at), p_event_at)
  where c.id = v_couple;
end;
$$;

revoke all on function public.apply_subscription_event(uuid, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_subscription_event(uuid, text, timestamptz, timestamptz) to service_role;
