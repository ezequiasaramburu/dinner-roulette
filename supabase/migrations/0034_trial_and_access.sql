-- Access groundwork for the paywall: a 7-day free trial, then a paid period.
--
-- A couple has access while `now() < trial_ends_at` or `now() < paid_until`. The trial starts when the couple is
-- created (existing couples get 7 days from this migration). `paid_until` is empty until a subscription exists; the
-- payment provider's server-side hook will be the only thing that writes it (the app has no update policy on couples).
-- When access is over, ensure_deck() refuses with 'subscription_required', which blocks swiping, reveals and new
-- queues for both partners. Nothing is deleted: preferences, history and recipes are kept, and paying restores everything.

alter table public.couples
  add column trial_ends_at timestamptz not null default now() + interval '7 days',
  add column paid_until timestamptz;

create function public.couple_has_access(p_couple uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(now() < c.trial_ends_at or now() < c.paid_until, false)
  from public.couples c where c.id = p_couple;
$$;

revoke all on function public.couple_has_access(uuid) from public, anon, authenticated;

create or replace function public.ensure_deck(p_couple uuid, p_date date) returns public.daily_decks
language plpgsql security definer set search_path = '' as $$
declare
  v_prefs jsonb[];
  v_deck public.daily_decks;
  v_recent jsonb;
begin
  -- Locked couples get nothing new: every swipe, reveal and queue goes through here.
  if not public.couple_has_access(p_couple) then raise exception 'subscription_required'; end if;

  select array_agg(
    jsonb_build_object(
      'diet', p.diet, 'allergens', p.allergens, 'cuisines', p.cuisines, 'disliked', p.disliked,
      'custom_terms', to_jsonb(p.custom_allergens || p.custom_dislikes)
    )
    order by p.user_id
  ) into v_prefs
  from public.couple_members m join public.preferences p on p.user_id = m.user_id
  where m.couple_id = p_couple;
  if coalesce(array_length(v_prefs, 1), 0) < 2 then raise exception 'couple_not_ready'; end if;

  -- Serialize concurrent first requests (both partners opening the app at once).
  perform pg_advisory_xact_lock(hashtext(p_couple::text));

  select * into v_deck from public.daily_decks where couple_id = p_couple and deck_date = p_date;
  if found then return v_deck; end if;

  -- "Recent" means dishes the couple actually swiped, not everything that was queued: a dish only ever passed on
  -- stays out for 3 days (it is a no, and the catalog is small), a dish someone liked for 7.
  select coalesce(jsonb_object_agg(rid::text, last_date), '{}') into v_recent
  from (
    select s.recipe_id as rid, max(d.deck_date) as last_date
    from public.swipes s join public.daily_decks d on d.id = s.deck_id
    where d.couple_id = p_couple and d.deck_date > p_date - (case when s.liked then 7 else 3 end)
    group by s.recipe_id
  ) r;

  -- Blocks and reports, couple-wide like allergies. A block never applies to the couple's own members.
  v_prefs[1] := v_prefs[1] || jsonb_build_object(
    'blocked_authors', (
      select coalesce(jsonb_agg(distinct b.blocked_id), '[]'::jsonb) from public.author_blocks b
      where b.blocker_id in (select user_id from public.couple_members where couple_id = p_couple)
        and b.blocked_id not in (select user_id from public.couple_members where couple_id = p_couple)
    ),
    'hidden_recipes', (
      select coalesce(jsonb_agg(distinct rr.recipe_id), '[]'::jsonb) from public.recipe_reports rr
      where rr.reporter_id in (select user_id from public.couple_members where couple_id = p_couple)
    )
  );

  -- One ranked list for the whole cycle, so partners swiping at different times see the same order.
  insert into public.daily_decks (couple_id, deck_date, recipe_ids, pool_size, repeat_count)
  select p_couple, p_date,
         coalesce(array_agg(b.recipe_id order by b.pos), '{}'),
         coalesce(max(b.pool_size), 0),
         count(*) filter (where b.is_repeat)
  from public.build_deck(v_prefs[1], v_prefs[2], v_recent, 100) b
  returning * into v_deck;

  return v_deck;
end;
$$;


create or replace function public.get_couple_state() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'couple_id', c.id,
    'role', me.role,
    'timezone', c.timezone,
    'reveal_time', to_char(c.reveal_time, 'HH24:MI'),
    'reveal_mode', c.reveal_mode,
    'match_goal', c.match_goal,
    'has_access', public.couple_has_access(c.id),
    'trial_ends_at', c.trial_ends_at,
    'me_ready', exists (select 1 from public.preferences where user_id = auth.uid()),
    'partner', (
      select jsonb_build_object(
        'id', p.id,
        'display_name', p.display_name,
        'ready', exists (select 1 from public.preferences where user_id = p.id)
      )
      from public.couple_members pm
      join public.profiles p on p.id = pm.user_id
      where pm.couple_id = c.id and pm.user_id <> auth.uid()
    )
  )
  from public.couple_members me
  join public.couples c on c.id = me.couple_id
  where me.user_id = auth.uid();
$$;
