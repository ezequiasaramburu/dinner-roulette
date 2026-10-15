-- Instant mode: the early reveal is offered once BOTH of you have swiped half of the dishes you can swipe.
--
-- Replaces the flat "15 swipes" of 0030. Half is worked out per person for the current round: the dishes swiped in
-- this round must be at least as many as the ones still waiting (swiped >= left means swiped >= half of the total).
-- Hidden and unpublished dishes, and in round two the first round's dishes, are not part of "the dishes you can swipe".
-- The feed says when the offer is open (`can_reveal_now`); reveal_now() refuses with 'swipe_more' until then.

create or replace function public.reveal_now_ready(p_deck_id uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  with d as (select * from public.daily_decks where id = p_deck_id),
  done as (
    select count(*) as n from public.swipes s, d
    where s.deck_id = d.id and s.user_id = p_user and s.swiped_at >= coalesce(d.round_started_at, '-infinity')
  ),
  waiting as (
    select count(*) as n
    from d cross join lateral unnest(d.recipe_ids) as t(rid)
    where t.rid <> all (d.first_reveal_ids)
      and not exists (select 1 from public.swipes s where s.deck_id = d.id and s.user_id = p_user and s.recipe_id = t.rid)
      and t.rid <> all (public.couple_hidden_recipes(d.couple_id))
      and exists (select 1 from public.recipes r where r.id = t.rid and r.status = 'approved')
  )
  select done.n > 0 and done.n >= waiting.n from done, waiting;
$$;

create or replace function public.reveal_offer_ready(p_deck_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from public.daily_decks d
    join public.couple_members m on m.couple_id = d.couple_id
    where d.id = p_deck_id and not public.reveal_now_ready(d.id, m.user_id)
  );
$$;

revoke all on function public.reveal_now_ready(uuid, uuid), public.reveal_offer_ready(uuid) from public, anon, authenticated;

create or replace function public.get_swipe_feed() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_couple uuid;
  v_tz text;
  v_reveal time;
  v_mode text;
  v_deck public.daily_decks;
  v_next uuid[];
  v_status text;
  v_hidden uuid[];
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select m.couple_id, c.timezone, c.reveal_time, c.reveal_mode
  into v_couple, v_tz, v_reveal, v_mode
  from public.couple_members m join public.couples c on c.id = m.couple_id
  where m.user_id = v_user;
  if v_couple is null then raise exception 'couple_not_ready'; end if;

  v_deck := public.ensure_deck(v_couple, public.cycle_date(v_tz));
  v_hidden := public.couple_hidden_recipes(v_couple);

  v_status := case
    when public.deck_revealed(v_deck.id) then (case when v_mode = 'scheduled' and v_deck.round = 1 then 'closed' else 'goal_reached' end)
    when public.close_if_goal_reached(v_deck.id) then 'goal_reached'
    else 'ready'
  end;

  select coalesce(array_agg(q.rid order by q.ord), '{}') into v_next
  from (
    select t.rid, t.ord
    from unnest(v_deck.recipe_ids) with ordinality as t(rid, ord)
    where not exists (
      select 1 from public.swipes s where s.deck_id = v_deck.id and s.user_id = v_user and s.recipe_id = t.rid
    )
      -- A queue is built once per cycle, so recipes hidden or unpublished since then are dropped here.
      and t.rid <> all (v_hidden)
      and t.rid <> all (v_deck.first_reveal_ids)
      and exists (select 1 from public.recipes r where r.id = t.rid and r.status = 'approved')
    order by t.ord
    limit 6
  ) q;

  if v_status = 'ready' and coalesce(array_length(v_next, 1), 0) = 0 then v_status := 'exhausted'; end if;

  return jsonb_build_object(
    'deck_id', v_deck.id,
    'cycle_date', v_deck.deck_date,
    'status', v_status,
    'round', v_deck.round,
    'has_swiped', exists (
      select 1 from public.swipes s
      where s.deck_id = v_deck.id and s.user_id = v_user and s.swiped_at >= coalesce(v_deck.round_started_at, '-infinity')
    ),
    'can_reveal_now', public.reveal_offer_ready(v_deck.id),
    'dishes', case when v_status = 'ready' then public.dish_json(v_next) else '[]'::jsonb end
  );
end;
$$;

create or replace function public.reveal_now() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_couple uuid;
  v_tz text;
  v_mode text;
  v_deck public.daily_decks;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select m.couple_id, c.timezone, c.reveal_mode into v_couple, v_tz, v_mode
  from public.couple_members m join public.couples c on c.id = m.couple_id
  where m.user_id = v_user;
  if v_couple is null then raise exception 'couple_not_ready'; end if;

  v_deck := public.ensure_deck(v_couple, public.cycle_date(v_tz));
  if v_mode <> 'instant' and v_deck.round = 1 then raise exception 'not_instant'; end if;
  if not exists (
    select 1 from public.swipes
    where deck_id = v_deck.id and user_id = v_user and swiped_at >= coalesce(v_deck.round_started_at, '-infinity')
  ) then
    raise exception 'nothing_swiped';
  end if;
  if not public.reveal_offer_ready(v_deck.id) then raise exception 'swipe_more'; end if;
  update public.daily_decks set revealed_at = now() where id = v_deck.id and revealed_at is null;
end;
$$;
