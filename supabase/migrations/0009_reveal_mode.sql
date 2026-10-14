-- Reveal mode: a couple either reveals at a set time ('scheduled', the default) or the moment the match goal is
-- reached ('instant').
--
-- Instant mode: swipes always count toward today's dinner (the couple's local date), the reveal opens as soon as the
-- goal is reached, and swiping stays closed until tomorrow. Whoever makes the last match sees it right away; the
-- partner sees it the next time the app checks (a push notification for them comes later).
--
-- Settings are changed through one function: update_couple_settings(match_goal, reveal_mode, reveal_time).

alter table public.couples add column reveal_mode text not null default 'scheduled'
  check (reveal_mode in ('scheduled', 'instant'));

-- Set when an instant reveal opens. It makes the reveal stick even if the goal is changed afterwards.
alter table public.daily_decks add column revealed_at timestamptz;

drop function public.cycle_date(text, time);

-- The dinner date a swipe made right now counts toward. Scheduled: a cycle runs reveal to reveal. Instant: today.
create function public.cycle_date(p_tz text, p_reveal time, p_mode text) returns date
language sql stable set search_path = '' as $$
  select case
    when p_mode = 'instant' then (now() at time zone p_tz)::date
    when (now() at time zone p_tz)::time < p_reveal then (now() at time zone p_tz)::date
    else (now() at time zone p_tz)::date + 1
  end;
$$;

revoke all on function public.cycle_date(text, time, text) from public, anon, authenticated;

-- Has this deck reached its match goal? In instant mode this is also the moment the reveal opens.
create function public.close_if_goal_reached(p_deck_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_deck public.daily_decks;
  v_goal int;
  v_mode text;
  v_reached boolean;
begin
  select * into v_deck from public.daily_decks where id = p_deck_id;
  select match_goal, reveal_mode into v_goal, v_mode from public.couples where id = v_deck.couple_id;

  v_reached := public.deck_match_count(p_deck_id) >= v_goal;
  if v_reached and v_mode = 'instant' and v_deck.revealed_at is null then
    update public.daily_decks set revealed_at = now() where id = p_deck_id;
  end if;
  return v_reached or v_deck.revealed_at is not null;
end;
$$;

revoke all on function public.close_if_goal_reached(uuid) from public, anon, authenticated;

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

  v_deck := public.ensure_deck(v_couple, public.cycle_date(v_tz, v_reveal, v_mode));

  v_status := case when public.close_if_goal_reached(v_deck.id) then 'goal_reached' else 'ready' end;

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
    'for_today', v_deck.deck_date = (now() at time zone v_tz)::date,
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
  if v_deck.deck_date <> public.cycle_date(v_tz, v_reveal, v_mode) then raise exception 'deck_closed'; end if;
  if public.close_if_goal_reached(p_deck_id) then raise exception 'deck_closed'; end if;

  return v_deck.recipe_ids;
end;
$$;

create or replace function public.record_swipe(p_deck_id uuid, p_recipe_id uuid, p_liked boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not (p_recipe_id = any (public.swipe_guard(p_deck_id))) then raise exception 'recipe_not_in_deck'; end if;

  insert into public.swipes (deck_id, user_id, recipe_id, liked)
  values (p_deck_id, auth.uid(), p_recipe_id, p_liked)
  on conflict (deck_id, user_id, recipe_id) do update set liked = excluded.liked, swiped_at = now();

  return jsonb_build_object(
    'status', case when public.close_if_goal_reached(p_deck_id) then 'goal_reached' else 'ready' end
  );
end;
$$;

-- Today's dinner. Scheduled: once the reveal time has passed. Instant: once the couple has reached its goal.
--   { status: 'pending', reveal_at }   (reveal_at is null in instant mode: there is no set time)
--   { status: 'revealed', reveal_at, deck_id, kind, seen, dishes }
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
    v_reveal_at := (v_today + v_reveal) at time zone v_tz;
    if now() < v_reveal_at then
      return jsonb_build_object('status', 'pending', 'reveal_at', v_reveal_at);
    end if;
    v_deck := public.ensure_deck(v_couple, v_today);
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

create or replace function public.mark_reveal_seen(p_deck_id uuid) returns void
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
  if v_mode = 'instant' then
    if v_deck.revealed_at is null then return; end if;
  elsif now() < (v_deck.deck_date + v_reveal) at time zone v_tz then
    return;
  end if;

  insert into public.reveal_views (deck_id, user_id) values (p_deck_id, v_user) on conflict do nothing;
end;
$$;

-- One function for every couple-wide setting; pass only what changes. Either partner can use it.
drop function public.update_couple_settings(int);

create function public.update_couple_settings(
  p_match_goal int default null,
  p_reveal_mode text default null,
  p_reveal_time time default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_match_goal is not null and p_match_goal not between 1 and 5 then raise exception 'invalid_match_goal'; end if;
  if p_reveal_mode is not null and p_reveal_mode not in ('scheduled', 'instant') then raise exception 'invalid_reveal_mode'; end if;

  update public.couples set
    match_goal = coalesce(p_match_goal, match_goal),
    reveal_mode = coalesce(p_reveal_mode, reveal_mode),
    reveal_time = coalesce(p_reveal_time, reveal_time)
  where id = (select couple_id from public.couple_members where user_id = auth.uid());

  if not found then raise exception 'couple_not_ready'; end if;
end;
$$;

revoke all on function public.update_couple_settings(int, text, time) from public, anon;
grant execute on function public.update_couple_settings(int, text, time) to authenticated;

create or replace function public.get_couple_state() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'couple_id', c.id,
    'role', me.role,
    'timezone', c.timezone,
    'reveal_time', to_char(c.reveal_time, 'HH24:MI'),
    'reveal_mode', c.reveal_mode,
    'match_goal', c.match_goal,
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
