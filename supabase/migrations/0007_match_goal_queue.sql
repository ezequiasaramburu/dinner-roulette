-- Endless swipe queue + match goal.
--
-- Instead of a fixed deck of 12, each couple gets one ranked queue per dinner cycle that both partners walk
-- through at their own pace. A "match" is a dish both liked. When the couple reaches its match goal
-- (default 2) swiping stops for both until the reveal; the matches themselves stay hidden until then.
--
-- A cycle runs from one reveal to the next: swipe at 20:00 (after tonight's reveal) and it counts toward
-- tomorrow's dinner.

-- Pre-release: the old fixed-size decks and their swipes are incompatible with queues, so start clean.
delete from public.daily_decks where true;

alter table public.couples add column match_goal int not null default 2 check (match_goal between 1 and 5);

drop function public.get_or_create_today_deck();
drop function public.deck_json(uuid);
drop function public.record_swipe(uuid, uuid, boolean);
drop function public.undo_last_swipe(uuid);
drop function public.swipe_guard(uuid);

-- The dinner date a swipe made right now counts toward, in the couple's timezone.
create function public.cycle_date(p_tz text, p_reveal time) returns date
language sql stable set search_path = '' as $$
  select case
    when (now() at time zone p_tz)::time < p_reveal then (now() at time zone p_tz)::date
    else (now() at time zone p_tz)::date + 1
  end;
$$;

-- Light dish payload for swipe cards, in the order of the given ids. Ingredients and steps stay hidden.
create function public.dish_json(p_ids uuid[]) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id, 'title', r.title, 'image_url', r.image_url, 'country', r.country,
      'category', r.category, 'dish_type', r.dish_type, 'tags', r.tags,
      'allergens', r.allergens, 'diet_flags', r.diet_flags
    ) order by t.ord
  ), '[]'::jsonb)
  from unnest(p_ids) with ordinality as t(rid, ord)
  join public.recipes r on r.id = t.rid;
$$;

-- Dishes both partners liked in this deck.
create function public.deck_match_count(p_deck_id uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int
  from public.swipes a
  join public.swipes b on b.deck_id = a.deck_id and b.recipe_id = a.recipe_id and b.user_id <> a.user_id
  where a.deck_id = p_deck_id and a.liked and b.liked and a.user_id < b.user_id;
$$;

revoke all on function public.cycle_date(text, time), public.dish_json(uuid[]), public.deck_match_count(uuid)
from public, anon, authenticated;

-- The caller's next dishes to swipe. Creates the couple's queue for the current cycle on first use.
-- Returns { deck_id, cycle_date, for_today, status, has_swiped, dishes }, where status is
--   ready         keep swiping (dishes has the next few, in order)
--   goal_reached  the couple has enough matches; swiping is over until the reveal
--   exhausted     the caller has been through every dish that fits both of you
-- It deliberately carries no counts and nothing about the partner's choices.
create function public.get_swipe_feed() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_couple uuid;
  v_tz text;
  v_reveal time;
  v_goal int;
  v_prefs jsonb[];
  v_date date;
  v_deck public.daily_decks;
  v_recent jsonb;
  v_next uuid[];
  v_status text;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select m.couple_id, c.timezone, c.reveal_time, c.match_goal
  into v_couple, v_tz, v_reveal, v_goal
  from public.couple_members m join public.couples c on c.id = m.couple_id
  where m.user_id = v_user;
  if v_couple is null then raise exception 'couple_not_ready'; end if;

  select array_agg(
    jsonb_build_object('diet', p.diet, 'allergens', p.allergens, 'cuisines', p.cuisines, 'disliked', p.disliked)
    order by p.user_id
  ) into v_prefs
  from public.couple_members m join public.preferences p on p.user_id = m.user_id
  where m.couple_id = v_couple;
  if coalesce(array_length(v_prefs, 1), 0) < 2 then raise exception 'couple_not_ready'; end if;

  v_date := public.cycle_date(v_tz, v_reveal);

  -- Serialize concurrent first requests (both partners opening the app at once).
  perform pg_advisory_xact_lock(hashtext(v_couple::text));

  select * into v_deck from public.daily_decks where couple_id = v_couple and deck_date = v_date;

  if not found then
    -- "Recent" means dishes the couple actually swiped in the last 30 days, not everything that was queued.
    select coalesce(jsonb_object_agg(rid::text, last_date), '{}') into v_recent
    from (
      select s.recipe_id as rid, max(d.deck_date) as last_date
      from public.swipes s join public.daily_decks d on d.id = s.deck_id
      where d.couple_id = v_couple and d.deck_date > v_date - 30
      group by s.recipe_id
    ) r;

    -- One ranked list for the whole cycle, so partners swiping at different times see the same order.
    insert into public.daily_decks (couple_id, deck_date, recipe_ids, pool_size, repeat_count)
    select v_couple, v_date,
           coalesce(array_agg(b.recipe_id order by b.pos), '{}'),
           coalesce(max(b.pool_size), 0),
           count(*) filter (where b.is_repeat)
    from public.build_deck(v_prefs[1], v_prefs[2], v_recent, 100) b
    returning * into v_deck;
  end if;

  v_status := case when public.deck_match_count(v_deck.id) >= v_goal then 'goal_reached' else 'ready' end;

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

-- Shared checks for swiping: the caller belongs to the deck's couple, it is the current cycle's deck, and the
-- couple hasn't already reached its match goal. Returns the deck's recipe ids.
create function public.swipe_guard(p_deck_id uuid) returns uuid[]
language plpgsql stable security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_deck public.daily_decks;
  v_tz text;
  v_reveal time;
  v_goal int;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select d.* into v_deck from public.daily_decks d
  join public.couple_members m on m.couple_id = d.couple_id and m.user_id = v_user
  where d.id = p_deck_id;
  if not found then raise exception 'deck_not_found'; end if;

  select timezone, reveal_time, match_goal into v_tz, v_reveal, v_goal from public.couples where id = v_deck.couple_id;
  if v_deck.deck_date <> public.cycle_date(v_tz, v_reveal) then raise exception 'deck_closed'; end if;
  if public.deck_match_count(p_deck_id) >= v_goal then raise exception 'deck_closed'; end if;

  return v_deck.recipe_ids;
end;
$$;

revoke all on function public.swipe_guard(uuid) from public, anon, authenticated;

-- Like or pass a dish. Changing your mind is fine until the goal is reached.
-- Returns { status: "ready" | "goal_reached" } so the app knows when swiping is over.
create function public.record_swipe(p_deck_id uuid, p_recipe_id uuid, p_liked boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_goal int;
begin
  if not (p_recipe_id = any (public.swipe_guard(p_deck_id))) then raise exception 'recipe_not_in_deck'; end if;

  insert into public.swipes (deck_id, user_id, recipe_id, liked)
  values (p_deck_id, auth.uid(), p_recipe_id, p_liked)
  on conflict (deck_id, user_id, recipe_id) do update set liked = excluded.liked, swiped_at = now();

  select c.match_goal into v_goal
  from public.daily_decks d join public.couples c on c.id = d.couple_id where d.id = p_deck_id;

  return jsonb_build_object(
    'status', case when public.deck_match_count(p_deck_id) >= v_goal then 'goal_reached' else 'ready' end
  );
end;
$$;

-- Take back your most recent swipe. Returns the dish it was for, or null if there was nothing to undo.
create function public.undo_last_swipe(p_deck_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_recipe uuid;
begin
  perform public.swipe_guard(p_deck_id);

  select recipe_id into v_recipe from public.swipes
  where deck_id = p_deck_id and user_id = auth.uid()
  order by swiped_at desc limit 1;

  if v_recipe is not null then
    delete from public.swipes
    where deck_id = p_deck_id and user_id = auth.uid() and recipe_id = v_recipe;
  end if;
  return v_recipe;
end;
$$;

-- Couple-wide settings, editable by either partner.
create function public.update_couple_settings(p_match_goal int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_match_goal is null or p_match_goal not between 1 and 5 then raise exception 'invalid_match_goal'; end if;

  update public.couples set match_goal = p_match_goal
  where id = (select couple_id from public.couple_members where user_id = auth.uid());

  if not found then raise exception 'couple_not_ready'; end if;
end;
$$;

revoke all on function public.get_swipe_feed(), public.record_swipe(uuid, uuid, boolean),
  public.undo_last_swipe(uuid), public.update_couple_settings(int) from public, anon;
grant execute on function public.get_swipe_feed(), public.record_swipe(uuid, uuid, boolean),
  public.undo_last_swipe(uuid), public.update_couple_settings(int) to authenticated;

-- The couple state now carries the match goal.
create or replace function public.get_couple_state() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'couple_id', c.id,
    'role', me.role,
    'timezone', c.timezone,
    'reveal_time', to_char(c.reveal_time, 'HH24:MI'),
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
