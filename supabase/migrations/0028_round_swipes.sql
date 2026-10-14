-- Swipe again: "have I swiped?" counts from the start of the new round.
--
-- After swiping again, the home screen still treated both of you as having swiped (from round one) and offered
-- "Reveal with what we have" before anyone had swiped a single new dish.

alter table public.daily_decks add column round_started_at timestamptz;

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
  update public.daily_decks set revealed_at = now() where id = v_deck.id and revealed_at is null;
end;
$$;

create or replace function public.swipe_again() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_couple uuid;
  v_tz text;
  v_deck public.daily_decks;
  v_pick record;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select m.couple_id, c.timezone into v_couple, v_tz
  from public.couple_members m join public.couples c on c.id = m.couple_id
  where m.user_id = v_user;
  if v_couple is null then raise exception 'couple_not_ready'; end if;

  v_deck := public.ensure_deck(v_couple, public.cycle_date(v_tz));
  perform pg_advisory_xact_lock(hashtext(v_couple::text));
  select * into v_deck from public.daily_decks where id = v_deck.id for update;

  if not public.deck_revealed(v_deck.id) then raise exception 'not_revealed'; end if;
  if v_deck.round > 1 then raise exception 'swipe_again_used'; end if;

  select * into v_pick from public.reveal_pick(v_deck.id);
  if v_pick.kind = 'match' then raise exception 'already_matched'; end if;
  if v_pick.kind = 'none' or not exists (
    select 1 from public.couple_members m where m.couple_id = v_couple and not public.out_of_dishes(v_deck.id, m.user_id)
  ) then
    raise exception 'nothing_left';
  end if;

  update public.daily_decks
  set round = 2, first_reveal_ids = v_pick.ids, revealed_at = null, round_started_at = now()
  where id = v_deck.id;
  -- The new reveal plays its animation again.
  delete from public.reveal_views where deck_id = v_deck.id;
end;
$$;
