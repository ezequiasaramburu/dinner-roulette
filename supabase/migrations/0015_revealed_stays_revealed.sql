-- A revealed dinner stays revealed.
--
-- Until now a scheduled reveal was only "the reveal time has passed", so moving the reveal time later after the
-- reveal took the dinner away and reopened swiping. Now the reveal is stamped on the deck (daily_decks.revealed_at)
-- the first time anyone looks after the reveal time, and again right before the reveal time is changed. Once
-- stamped it never changes, for either mode: a later reveal time only affects tomorrow.

-- Is this deck revealed? Stamps it the first time the answer is yes.
--   scheduled: the reveal moment has passed (stamped with that moment, not with "now")
--   instant:   the goal was reached (stamped by close_if_goal_reached)
create function public.deck_revealed(p_deck_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_deck public.daily_decks;
  v_tz text;
  v_reveal time;
  v_mode text;
  v_at timestamptz;
begin
  select * into v_deck from public.daily_decks where id = p_deck_id;
  if v_deck.revealed_at is not null then return true; end if;

  select timezone, reveal_time, reveal_mode into v_tz, v_reveal, v_mode from public.couples where id = v_deck.couple_id;
  if v_mode = 'instant' then
    return public.close_if_goal_reached(p_deck_id) and exists (
      select 1 from public.daily_decks where id = p_deck_id and revealed_at is not null
    );
  end if;

  v_at := (v_deck.deck_date + v_reveal) at time zone v_tz;
  if now() >= v_at then
    update public.daily_decks set revealed_at = v_at where id = p_deck_id and revealed_at is null;
    return true;
  end if;
  return false;
end;
$$;

-- Stamp today's reveal if its time has passed, building the deck first if nobody opened the app yet.
create function public.settle_todays_reveal(p_couple uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_tz text;
  v_reveal time;
  v_mode text;
  v_deck public.daily_decks;
begin
  select timezone, reveal_time, reveal_mode into v_tz, v_reveal, v_mode from public.couples where id = p_couple;
  if v_mode <> 'scheduled' or not public.reveal_time_passed(v_tz, v_reveal, v_mode) then return; end if;

  begin
    v_deck := public.ensure_deck(p_couple, public.cycle_date(v_tz));
  exception when others then
    return; -- the couple isn't ready (no preferences yet): there is no dinner to reveal
  end;
  perform public.deck_revealed(v_deck.id);
end;
$$;

revoke all on function public.deck_revealed(uuid), public.settle_todays_reveal(uuid) from public, anon, authenticated;

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
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select m.couple_id, c.timezone, c.reveal_time, c.reveal_mode
  into v_couple, v_tz, v_reveal, v_mode
  from public.couple_members m join public.couples c on c.id = m.couple_id
  where m.user_id = v_user;
  if v_couple is null then raise exception 'couple_not_ready'; end if;

  v_deck := public.ensure_deck(v_couple, public.cycle_date(v_tz));

  v_status := case
    when public.deck_revealed(v_deck.id) then (case when v_mode = 'scheduled' then 'closed' else 'goal_reached' end)
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
    order by t.ord
    limit 6
  ) q;

  if v_status = 'ready' and coalesce(array_length(v_next, 1), 0) = 0 then v_status := 'exhausted'; end if;

  return jsonb_build_object(
    'deck_id', v_deck.id,
    'cycle_date', v_deck.deck_date,
    'status', v_status,
    'has_swiped', exists (select 1 from public.swipes s where s.deck_id = v_deck.id and s.user_id = v_user),
    'dishes', case when v_status = 'ready' then public.dish_json(v_next) else '[]'::jsonb end
  );
end;
$$;

create or replace function public.swipe_guard(p_deck_id uuid) returns uuid[]
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_deck public.daily_decks;
  v_tz text;
  v_reveal time;
  v_mode text;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select d.* into v_deck from public.daily_decks d
  join public.couple_members m on m.couple_id = d.couple_id and m.user_id = v_user
  where d.id = p_deck_id;
  if not found then raise exception 'deck_not_found'; end if;

  select timezone, reveal_time, reveal_mode into v_tz, v_reveal, v_mode from public.couples where id = v_deck.couple_id;
  if v_deck.deck_date <> public.cycle_date(v_tz) then raise exception 'deck_closed'; end if;
  if public.deck_revealed(p_deck_id) then raise exception 'deck_closed'; end if;
  if public.close_if_goal_reached(p_deck_id) then raise exception 'deck_closed'; end if;

  return v_deck.recipe_ids;
end;
$$;

create or replace function public.mark_reveal_seen(p_deck_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_deck public.daily_decks;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select d.* into v_deck from public.daily_decks d
  join public.couple_members m on m.couple_id = d.couple_id and m.user_id = v_user
  where d.id = p_deck_id;
  if not found then raise exception 'deck_not_found'; end if;

  if not public.deck_revealed(p_deck_id) then return; end if;

  insert into public.reveal_views (deck_id, user_id) values (p_deck_id, v_user) on conflict do nothing;
end;
$$;

create or replace function public.update_couple_settings(
  p_match_goal int default null,
  p_reveal_mode text default null,
  p_reveal_time time default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_couple uuid;
  v_partner uuid;
  v_old int;
  v_from int;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_match_goal is not null and p_match_goal not between 1 and 5 then raise exception 'invalid_match_goal'; end if;
  if p_reveal_mode is not null and p_reveal_mode not in ('scheduled', 'instant') then raise exception 'invalid_reveal_mode'; end if;

  select m.couple_id, c.match_goal into v_couple, v_old
  from public.couple_members m join public.couples c on c.id = m.couple_id
  where m.user_id = v_user;
  if v_couple is null then raise exception 'couple_not_ready'; end if;

  -- If today's reveal time has already passed, today's dinner is revealed for good: moving the time later must not
  -- take it back or reopen swiping. The new time then applies from tomorrow.
  perform public.settle_todays_reveal(v_couple);

  update public.couples set
    match_goal = coalesce(p_match_goal, match_goal),
    reveal_mode = coalesce(p_reveal_mode, reveal_mode),
    reveal_time = coalesce(p_reveal_time, reveal_time)
  where id = v_couple;

  if p_match_goal is not null and p_match_goal <> v_old then
    -- Acting on the goal means I have seen what my partner did to it.
    delete from public.notices where recipient_id = v_user and kind = 'match_goal_changed';

    select user_id into v_partner from public.couple_members where couple_id = v_couple and user_id <> v_user;
    if v_partner is not null then
      v_from := v_old;
      delete from public.notices
      where recipient_id = v_partner and kind = 'match_goal_changed'
      returning from_value into v_from;
      v_from := coalesce(v_from, v_old);

      if v_from <> p_match_goal then
        insert into public.notices (recipient_id, kind, from_value, to_value)
        values (v_partner, 'match_goal_changed', v_from, p_match_goal);
      end if;
    end if;
  end if;
end;
$$;

create or replace function public.get_reveal() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_couple uuid;
  v_tz text;
  v_reveal time;
  v_mode text;
  v_goal int;
  v_today date;
  v_reveal_at timestamptz;
  v_deck public.daily_decks;
  v_kind text;
  v_ids uuid[];
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select m.couple_id, c.timezone, c.reveal_time, c.reveal_mode, c.match_goal
  into v_couple, v_tz, v_reveal, v_mode, v_goal
  from public.couple_members m join public.couples c on c.id = m.couple_id
  where m.user_id = v_user;
  if v_couple is null then raise exception 'couple_not_ready'; end if;

  v_today := (now() at time zone v_tz)::date;

  if v_mode = 'instant' then
    select * into v_deck from public.daily_decks where couple_id = v_couple and deck_date = v_today;
    if found then perform public.close_if_goal_reached(v_deck.id); end if;
    select * into v_deck from public.daily_decks
    where couple_id = v_couple and deck_date = v_today and revealed_at is not null;
    if not found then
      return jsonb_build_object('status', 'pending', 'reveal_at', null::timestamptz);
    end if;
    v_reveal_at := v_deck.revealed_at;
  else
    -- Already stamped: the dinner was revealed earlier today, even if the reveal time was moved later since.
    select * into v_deck from public.daily_decks
    where couple_id = v_couple and deck_date = v_today and revealed_at is not null;
    if found then
      v_reveal_at := v_deck.revealed_at;
    else
      v_reveal_at := (v_today + v_reveal) at time zone v_tz;
      if now() < v_reveal_at then
        return jsonb_build_object('status', 'pending', 'reveal_at', v_reveal_at);
      end if;
      v_deck := public.ensure_deck(v_couple, v_today);
      perform public.deck_revealed(v_deck.id);
    end if;
  end if;

  with likes as (
    select recipe_id, count(*) as n from public.swipes where deck_id = v_deck.id and liked group by recipe_id
  ),
  ranked as (
    select t.rid, coalesce(l.n, 0) as n, t.ord
    from unnest(v_deck.recipe_ids) with ordinality as t(rid, ord)
    left join likes l on l.recipe_id = t.rid
  )
  select
    case
      when exists (select 1 from ranked where n >= 2) then 'match'
      when exists (select 1 from ranked where n = 1) then 'closest'
      when exists (select 1 from ranked) then 'surprise'
      else 'none'
    end,
    case
      when exists (select 1 from ranked where n >= 2)
        then (select array_agg(rid order by ord) from ranked where n >= 2)
      when exists (select 1 from ranked where n = 1)
        then (select array_agg(rid order by ord) from (select rid, ord from ranked where n = 1 order by ord limit v_goal) c)
      else (select array_agg(rid order by ord) from (select rid, ord from ranked order by ord limit 1) s)
    end
  into v_kind, v_ids;

  return jsonb_build_object(
    'status', 'revealed',
    'reveal_at', v_reveal_at,
    'deck_id', v_deck.id,
    'kind', v_kind,
    'seen', exists (select 1 from public.reveal_views rv where rv.deck_id = v_deck.id and rv.user_id = v_user),
    'dishes', public.recipe_json(coalesce(v_ids, '{}'))
  );
end;
$$;
