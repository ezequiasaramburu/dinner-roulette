-- Swipe again: when nobody matched, the couple gets one more round with a new set from the rest of the queue.
--
-- A reveal that is only "closest" or "we picked for you" can be followed, once, by a second round. The dishes that
-- were just shown are set aside (first_reveal_ids), the reveal is reopened and the swipe screen comes back. The second
-- round reveals the instant way (match goal reached, both through everything, or "Reveal with what we have"), whatever
-- the couple's reveal mode, and uses the same fallback ladder.
--
-- Also: a dish the couple swiped now comes back after 7 days instead of 30 (it was only ever demoted, never excluded).

alter table public.daily_decks
  add column round smallint not null default 1,
  add column first_reveal_ids uuid[] not null default '{}';

-- What a reveal shows: the dishes you both liked, else ones one of you liked, else the best fit from the queue.
-- In a second round, the dishes shown in the first one are left out.
create function public.reveal_pick(p_deck_id uuid) returns table (kind text, ids uuid[])
language plpgsql stable security definer set search_path = '' as $$
declare
  v_deck public.daily_decks;
  v_goal int;
begin
  select * into v_deck from public.daily_decks where id = p_deck_id;
  select match_goal into v_goal from public.couples where id = v_deck.couple_id;

  return query
  with likes as (
    select s.recipe_id, count(*) as n from public.swipes s where s.deck_id = p_deck_id and s.liked group by s.recipe_id
  ),
  ranked as (
    select t.rid, coalesce(l.n, 0) as n, t.ord
    from unnest(v_deck.recipe_ids) with ordinality as t(rid, ord)
    left join likes l on l.recipe_id = t.rid
    where t.rid <> all (v_deck.first_reveal_ids)
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
    end;
end;
$$;

revoke all on function public.reveal_pick(uuid) from public, anon, authenticated;

create or replace function public.out_of_dishes(p_deck_id uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1
    from public.daily_decks d
    cross join lateral unnest(d.recipe_ids) as t(rid)
    where d.id = p_deck_id
      and t.rid <> all (d.first_reveal_ids)
      and not exists (select 1 from public.swipes s where s.deck_id = d.id and s.user_id = p_user and s.recipe_id = t.rid)
      and t.rid <> all (public.couple_hidden_recipes(d.couple_id))
      and exists (select 1 from public.recipes r where r.id = t.rid and r.status = 'approved')
  );
$$;

create or replace function public.close_if_goal_reached(p_deck_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_deck public.daily_decks;
  v_goal int;
  v_mode text;
  v_reached boolean;
  v_done boolean;
begin
  select * into v_deck from public.daily_decks where id = p_deck_id;
  select match_goal, reveal_mode into v_goal, v_mode from public.couples where id = v_deck.couple_id;

  v_reached := public.deck_match_count(p_deck_id) >= v_goal;

  if (v_mode = 'instant' or v_deck.round > 1) and v_deck.revealed_at is null then
    -- Nothing left to swipe for either of them: reveal with what we have.
    v_done := v_reached or not exists (
      select 1 from public.couple_members m
      where m.couple_id = v_deck.couple_id and not public.out_of_dishes(p_deck_id, m.user_id)
    );
    if v_done then
      update public.daily_decks set revealed_at = now() where id = p_deck_id and revealed_at is null;
      return true;
    end if;
  end if;
  return v_reached or v_deck.revealed_at is not null;
end;
$$;

create or replace function public.deck_revealed(p_deck_id uuid) returns boolean
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
  if v_mode = 'instant' or v_deck.round > 1 then
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

create or replace function public.ensure_deck(p_couple uuid, p_date date) returns public.daily_decks
language plpgsql security definer set search_path = '' as $$
declare
  v_prefs jsonb[];
  v_deck public.daily_decks;
  v_recent jsonb;
begin
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

  -- "Recent" means dishes the couple actually swiped in the last 7 days, not everything that was queued.
  select coalesce(jsonb_object_agg(rid::text, last_date), '{}') into v_recent
  from (
    select s.recipe_id as rid, max(d.deck_date) as last_date
    from public.swipes s join public.daily_decks d on d.id = s.deck_id
    where d.couple_id = p_couple and d.deck_date > p_date - 7
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
    'has_swiped', exists (select 1 from public.swipes s where s.deck_id = v_deck.id and s.user_id = v_user),
    'dishes', case when v_status = 'ready' then public.dish_json(v_next) else '[]'::jsonb end
  );
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
  v_round smallint;
  v_can boolean;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select m.couple_id, c.timezone, c.reveal_time, c.reveal_mode, c.match_goal
  into v_couple, v_tz, v_reveal, v_mode, v_goal
  from public.couple_members m join public.couples c on c.id = m.couple_id
  where m.user_id = v_user;
  if v_couple is null then raise exception 'couple_not_ready'; end if;

  v_today := (now() at time zone v_tz)::date;
  select d.round into v_round from public.daily_decks d where d.couple_id = v_couple and d.deck_date = v_today;
  v_round := coalesce(v_round, 1);

  -- A second round ("swipe again") reveals the way instant mode does, whatever the mode.
  if v_mode = 'instant' or v_round > 1 then
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

  select p.kind, p.ids into v_kind, v_ids from public.reveal_pick(v_deck.id) p;

  -- One more try, once, and only when nobody matched and there is still something new to swipe.
  v_can := v_deck.round = 1 and v_kind in ('closest', 'surprise') and exists (
    select 1 from public.couple_members m where m.couple_id = v_couple and not public.out_of_dishes(v_deck.id, m.user_id)
  );

  return jsonb_build_object(
    'status', 'revealed',
    'reveal_at', v_reveal_at,
    'deck_id', v_deck.id,
    'kind', v_kind,
    'round', v_deck.round,
    'can_swipe_again', v_can,
    'seen', exists (select 1 from public.reveal_views rv where rv.deck_id = v_deck.id and rv.user_id = v_user),
    'dishes', public.recipe_json(coalesce(v_ids, '{}'))
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
  if not exists (select 1 from public.swipes where deck_id = v_deck.id and user_id = v_user) then
    raise exception 'nothing_swiped';
  end if;
  update public.daily_decks set revealed_at = now() where id = v_deck.id and revealed_at is null;
end;
$$;

-- "Swipe again": one more round after a reveal where nobody matched.
create function public.swipe_again() returns void
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
  set round = 2, first_reveal_ids = v_pick.ids, revealed_at = null
  where id = v_deck.id;
  -- The new reveal plays its animation again.
  delete from public.reveal_views where deck_id = v_deck.id;
end;
$$;

revoke all on function public.swipe_again() from public, anon;
grant execute on function public.swipe_again() to authenticated;
