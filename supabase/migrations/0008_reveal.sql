-- Phase 8: the reveal.
--
-- At the couple's reveal time, the cycle that has just ended is opened. The couple sees the dishes they both
-- liked, with the full recipe. If nothing matched, they get the dishes that came closest, and if nobody swiped at
-- all, the best fit from the queue: the reveal always ends with a dinner.

-- Building the cycle's queue moves out of get_swipe_feed so the reveal can use it too.
create function public.ensure_deck(p_couple uuid, p_date date) returns public.daily_decks
language plpgsql security definer set search_path = '' as $$
declare
  v_prefs jsonb[];
  v_deck public.daily_decks;
  v_recent jsonb;
begin
  select array_agg(
    jsonb_build_object('diet', p.diet, 'allergens', p.allergens, 'cuisines', p.cuisines, 'disliked', p.disliked)
    order by p.user_id
  ) into v_prefs
  from public.couple_members m join public.preferences p on p.user_id = m.user_id
  where m.couple_id = p_couple;
  if coalesce(array_length(v_prefs, 1), 0) < 2 then raise exception 'couple_not_ready'; end if;

  -- Serialize concurrent first requests (both partners opening the app at once).
  perform pg_advisory_xact_lock(hashtext(p_couple::text));

  select * into v_deck from public.daily_decks where couple_id = p_couple and deck_date = p_date;
  if found then return v_deck; end if;

  -- "Recent" means dishes the couple actually swiped in the last 30 days, not everything that was queued.
  select coalesce(jsonb_object_agg(rid::text, last_date), '{}') into v_recent
  from (
    select s.recipe_id as rid, max(d.deck_date) as last_date
    from public.swipes s join public.daily_decks d on d.id = s.deck_id
    where d.couple_id = p_couple and d.deck_date > p_date - 30
    group by s.recipe_id
  ) r;

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

revoke all on function public.ensure_deck(uuid, date) from public, anon, authenticated;

create or replace function public.get_swipe_feed() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_couple uuid;
  v_tz text;
  v_reveal time;
  v_goal int;
  v_deck public.daily_decks;
  v_next uuid[];
  v_status text;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select m.couple_id, c.timezone, c.reveal_time, c.match_goal
  into v_couple, v_tz, v_reveal, v_goal
  from public.couple_members m join public.couples c on c.id = m.couple_id
  where m.user_id = v_user;
  if v_couple is null then raise exception 'couple_not_ready'; end if;

  v_deck := public.ensure_deck(v_couple, public.cycle_date(v_tz, v_reveal));

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

-- Who has opened their reveal, so the big moment plays once and the home screen can tell "new" from "seen".
create table public.reveal_views (
  deck_id uuid not null references public.daily_decks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (deck_id, user_id)
);

alter table public.reveal_views enable row level security;

create policy "reveal_views_select_own" on public.reveal_views
  for select using (auth.uid() = user_id);

-- Full recipes (ingredients, steps, links) in the order of the given ids. Only used once a reveal has happened.
create function public.recipe_json(p_ids uuid[]) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id, 'title', r.title, 'image_url', r.image_url, 'country', r.country,
      'category', r.category, 'dish_type', r.dish_type, 'tags', r.tags,
      'allergens', r.allergens, 'diet_flags', r.diet_flags,
      'ingredients', r.ingredients, 'steps', r.steps,
      'youtube_url', r.youtube_url, 'source_url', r.source_url
    ) order by t.ord
  ), '[]'::jsonb)
  from unnest(p_ids) with ordinality as t(rid, ord)
  join public.recipes r on r.id = t.rid;
$$;

revoke all on function public.recipe_json(uuid[]) from public, anon, authenticated;

-- Today's dinner, once the couple's reveal time has passed.
--   { status: 'pending', reveal_at }                          the reveal is still ahead today
--   { status: 'revealed', reveal_at, deck_id, kind, seen, dishes }
-- where kind says how the dinner was found:
--   match     dishes you both liked
--   closest   no shared like, so the dishes one of you liked (up to the match goal)
--   surprise  nobody liked anything, so the best fit from the queue
--   none      there was nothing to pick from (a pool that small should not happen)
-- Swipes made after the reveal belong to tomorrow's queue, so a revealed result never changes.
create function public.get_reveal() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_couple uuid;
  v_tz text;
  v_reveal time;
  v_goal int;
  v_today date;
  v_reveal_at timestamptz;
  v_deck public.daily_decks;
  v_kind text;
  v_ids uuid[];
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select m.couple_id, c.timezone, c.reveal_time, c.match_goal
  into v_couple, v_tz, v_reveal, v_goal
  from public.couple_members m join public.couples c on c.id = m.couple_id
  where m.user_id = v_user;
  if v_couple is null then raise exception 'couple_not_ready'; end if;

  v_today := (now() at time zone v_tz)::date;
  v_reveal_at := (v_today + v_reveal) at time zone v_tz;

  if now() < v_reveal_at then
    return jsonb_build_object('status', 'pending', 'reveal_at', v_reveal_at);
  end if;

  v_deck := public.ensure_deck(v_couple, v_today);

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

-- Remember that I opened this reveal. Does nothing before the reveal time, or for someone else's deck.
create function public.mark_reveal_seen(p_deck_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_deck public.daily_decks;
  v_tz text;
  v_reveal time;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select d.* into v_deck from public.daily_decks d
  join public.couple_members m on m.couple_id = d.couple_id and m.user_id = v_user
  where d.id = p_deck_id;
  if not found then raise exception 'deck_not_found'; end if;

  select timezone, reveal_time into v_tz, v_reveal from public.couples where id = v_deck.couple_id;
  if now() < (v_deck.deck_date + v_reveal) at time zone v_tz then return; end if;

  insert into public.reveal_views (deck_id, user_id) values (p_deck_id, v_user) on conflict do nothing;
end;
$$;

revoke all on function public.get_reveal(), public.mark_reveal_seen(uuid) from public, anon;
grant execute on function public.get_reveal(), public.mark_reveal_seen(uuid) to authenticated;
