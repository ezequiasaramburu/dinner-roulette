-- Reporting and blocking take effect at once, not only when the next queue is built; dishes say who wrote them.

-- Recipes this couple no longer wants to see: ones either of them reported, and everything by authors either of them
-- blocked (never the couple's own members).
create function public.couple_hidden_recipes(p_couple uuid) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct x.id), '{}')
  from (
    select rr.recipe_id as id
    from public.recipe_reports rr
    where rr.reporter_id in (select user_id from public.couple_members where couple_id = p_couple)
    union
    select r.id
    from public.author_blocks b
    join public.recipes r on r.author_id = b.blocked_id
    where b.blocker_id in (select user_id from public.couple_members where couple_id = p_couple)
      and b.blocked_id not in (select user_id from public.couple_members where couple_id = p_couple)
  ) x;
$$;

revoke all on function public.couple_hidden_recipes(uuid) from public, anon, authenticated;

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
      -- A queue is built once per cycle, so recipes hidden or unpublished since then are dropped here.
      and t.rid <> all (v_hidden)
      and exists (select 1 from public.recipes r where r.id = t.rid and r.status = 'approved')
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


-- How many authors I have hidden (so Settings can offer to show them again).
create function public.blocked_authors_count() returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.author_blocks where blocker_id = auth.uid();
$$;

revoke all on function public.blocked_authors_count() from public, anon;
grant execute on function public.blocked_authors_count() to authenticated;

-- Dishes say who wrote them: 'me', 'partner', or null for the catalogue and for other people's recipes.
-- (Community recipes are the ones with community = true; authored_by tells the app not to offer Block on your own couple.)
create or replace function public.dish_json(p_ids uuid[]) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id, 'title', r.title, 'image_url', r.image_url, 'country', r.country,
      'category', r.category, 'dish_type', r.dish_type, 'tags', r.tags,
      'allergens', r.allergens, 'diet_flags', r.diet_flags, 'swaps', r.swaps,
      'ingredient_names', r.ingredient_names, 'community', r.author_id is not null,
      'authored_by', case
        when r.author_id is null then null
        when r.author_id = auth.uid() then 'me'
        when public.shares_couple_with(r.author_id) then 'partner'
      end
    ) order by t.ord
  ), '[]'::jsonb)
  from unnest(p_ids) with ordinality as t(rid, ord)
  join public.recipes r on r.id = t.rid;
$$;

create or replace function public.recipe_json(p_ids uuid[]) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id, 'title', r.title, 'image_url', r.image_url, 'country', r.country,
      'category', r.category, 'dish_type', r.dish_type, 'tags', r.tags,
      'allergens', r.allergens, 'diet_flags', r.diet_flags, 'swaps', r.swaps,
      'ingredient_names', r.ingredient_names, 'community', r.author_id is not null,
      'authored_by', case
        when r.author_id is null then null
        when r.author_id = auth.uid() then 'me'
        when public.shares_couple_with(r.author_id) then 'partner'
      end,
      'ingredients', r.ingredients, 'steps', r.steps,
      'youtube_url', r.youtube_url, 'source_url', r.source_url
    ) order by t.ord
  ), '[]'::jsonb)
  from unnest(p_ids) with ordinality as t(rid, ord)
  join public.recipes r on r.id = t.rid;
$$;
