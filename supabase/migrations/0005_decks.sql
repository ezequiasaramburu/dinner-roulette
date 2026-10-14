-- Phase 6: daily decks. One deck per couple per local day; both partners see the same dishes.
--
-- Filter tiers (see build_deck):
--   HARD  never relaxed: diet (strictest of the two), allergens (union), meats and specific ingredients
--         the couple dislikes.
--   SOFT  ingredients that appear in a large share of recipes (onions, tomatoes, chili: each is in >25% of
--         the catalog, so a hard filter would gut the pool). Such dishes go to the back of the queue, behind
--         even repeated dishes, and are only used when there aren't enough alternatives.
--   BOOST cuisines either partner likes rank higher; ones both like rank highest. Never a restriction.

-- Dish family (soup, pie, rice, curry, ...), derived from the title by the importer. Decks cap each family
-- so three rice dishes or three pies never land in one day.
alter table public.recipes add column dish_type text not null default 'other';

create table public.dislike_rules (
  id text primary key, -- matches preferences.disliked ids
  tier text not null check (tier in ('hard', 'soft')),
  include_pattern text, -- POSIX regex, case-insensitive, matched against each ingredient name
  exclude_pattern text, -- ingredient names matching this are ignored (e.g. "olive oil" for olives)
  categories text[] not null default '{}', -- recipe categories that count as a hit
  allergen_hits text[] not null default '{}' -- recipe allergen tags that count as a hit
);

alter table public.dislike_rules enable row level security; -- internal: no policies, read by definer functions

insert into public.dislike_rules (id, tier, include_pattern, exclude_pattern, categories, allergen_hits) values
  ('beef', 'hard', '\y(beef|brisket|veal|oxtail|sirloin|ribeye|rump steak|fillet steak|t-bone)\y', null, '{Beef}', '{}'),
  ('pork', 'hard', '\y(pork|bacon|ham|gammon|sausages?|chorizo|pancetta|prosciutto|salami|lard|pepperoni)\y', null, '{Pork}', '{}'),
  ('lamb', 'hard', '\y(lamb|mutton)\y', null, '{Lamb,Goat}', '{}'),
  ('chicken', 'hard', '\ychicken\y', null, '{Chicken}', '{}'),
  ('seafood', 'hard', null, null, '{Seafood}', '{fish,shellfish}'),
  ('mushrooms', 'hard', '\y(mushrooms?|shiitake|porcini|chanterelles?|portobello|cremini)\y', null, '{}', '{}'),
  ('olives', 'hard', '\yolives?\y', 'olive oil', '{}', '{}'),
  ('cilantro', 'hard', '\y(cilantro|coriander)\y', '(ground|seeds?|powder|dried) coriander|coriander (seeds?|powder)', '{}', '{}'),
  ('bell_peppers', 'hard', '\y(bell peppers?|capsicum|(red|green|yellow|orange) peppers?)\y', 'flakes|chill?i|cayenne', '{}', '{}'),
  ('eggplant', 'hard', '\y(eggplants?|aubergines?)\y', null, '{}', '{}'),
  ('coconut', 'hard', '\ycoconut\y', null, '{}', '{}'),
  ('tofu', 'hard', '\ytofu\y', null, '{}', '{}'),
  ('beets', 'hard', '\y(beets?|beetroots?)\y', null, '{}', '{}'),
  ('onions', 'soft', '\y(onions?|shallots?|scallions?)\y', 'onion (powder|salt)', '{}', '{}'),
  ('tomatoes', 'soft', '\y(tomato(es)?|passata|ketchup)\y', null, '{}', '{}'),
  ('chili', 'soft', '\y(chill?i(es)?|cayenne|jalape[nñ]os?|scotch bonnet|harissa|sriracha|habanero)\y', null, '{}', '{}');

-- Which dislike ids each recipe triggers.
create view public.recipe_dislike_hits with (security_invoker = false) as
select r.id as recipe_id, d.id as dislike_id
from public.recipes r
join public.dislike_rules d on (
  r.category = any (d.categories)
  or d.allergen_hits && r.allergens
  or (
    d.include_pattern is not null
    and exists (
      select 1 from unnest(r.ingredient_names) n
      where n ~* d.include_pattern and (d.exclude_pattern is null or n !~* d.exclude_pattern)
    )
  )
);

revoke all on public.recipe_dislike_hits from public, anon, authenticated;

create table public.daily_decks (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  deck_date date not null, -- the couple's local date
  recipe_ids uuid[] not null, -- in display order
  pool_size int not null, -- recipes that passed every hard filter
  repeat_count int not null default 0, -- dishes reused from the last 30 days because the pool ran thin
  created_at timestamptz not null default now(),
  unique (couple_id, deck_date)
);

alter table public.daily_decks enable row level security;

create policy "daily_decks_select_member" on public.daily_decks
  for select using (public.is_couple_member(couple_id));

-- Pure deck builder, also used to review deck quality for test couples (service role only).
-- Preferences are jsonb: {"diet": "...", "allergens": [...], "cuisines": [...], "disliked": [...]}.
-- p_recent maps recipe id -> last date it appeared for this couple (last 30 days).
create function public.build_deck(p_a jsonb, p_b jsonb, p_recent jsonb default '{}', p_size int default 12)
returns table (recipe_id uuid, pos int, score numeric, pool_size int, is_repeat boolean)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_diet text;
  v_allergens text[];
  v_hard text[];
  v_soft text[];
  v_ca text[] := array(select jsonb_array_elements_text(coalesce(p_a -> 'cuisines', '[]')));
  v_cb text[] := array(select jsonb_array_elements_text(coalesce(p_b -> 'cuisines', '[]')));
  v_disliked text[] := array(
    select distinct jsonb_array_elements_text(coalesce(p_a -> 'disliked', '[]') || coalesce(p_b -> 'disliked', '[]'))
  );
  v_pool int;
  v_picked uuid[] := '{}';
  v_pos int := 0;
  v_countries jsonb := '{}';
  v_categories jsonb := '{}';
  v_types jsonb := '{}';
  v_cap int := 3;
  v_tier int;
  v_level int;
  c record;
begin
  select d into v_diet
  from unnest(array[coalesce(p_a ->> 'diet', 'none'), coalesce(p_b ->> 'diet', 'none')]) d
  order by case d when 'vegan' then 3 when 'vegetarian' then 2 when 'pescatarian' then 1 else 0 end desc
  limit 1;

  v_allergens := array(
    select distinct jsonb_array_elements_text(coalesce(p_a -> 'allergens', '[]') || coalesce(p_b -> 'allergens', '[]'))
  );
  v_hard := array(select id from public.dislike_rules where id = any (v_disliked) and tier = 'hard');
  v_soft := array(select id from public.dislike_rules where id = any (v_disliked) and tier = 'soft');

  create temporary table if not exists _deck_candidates (
    recipe_id uuid, country text, category text, dish_type text, score numeric, is_repeat boolean, last_seen date,
    soft_hits int, tier int
  ) on commit drop;
  truncate _deck_candidates;

  insert into _deck_candidates
  select r.id, r.country, r.category, r.dish_type,
    (
      case
        when r.country = any (v_ca) and r.country = any (v_cb) then 3
        when r.country = any (v_ca) or r.country = any (v_cb) then 1.5
        else 0
      end
      + random()
    )::numeric,
    p_recent ? r.id::text,
    (p_recent ->> r.id::text)::date,
    0, 0
  from public.recipes r
  where (v_diet = 'none' or v_diet = any (r.diet_flags))
    and not (r.allergens && v_allergens)
    and not exists (
      select 1 from public.recipe_dislike_hits h where h.recipe_id = r.id and h.dislike_id = any (v_hard)
    );

  -- Tiers: 0 clean+fresh, 1 clean+repeat, 2 soft-disliked+fresh, 3 soft-disliked+repeat.
  -- A stated dislike outranks variety and outranks seeing a dish again.
  -- (The API role runs with pg_safeupdate, which rejects an UPDATE without a WHERE clause, hence "where true".)
  update _deck_candidates c set
    soft_hits = (select count(*) from public.recipe_dislike_hits h where h.recipe_id = c.recipe_id and h.dislike_id = any (v_soft))
  where true;
  update _deck_candidates set tier = (case when soft_hits > 0 then 2 else 0 end) + (case when is_repeat then 1 else 0 end)
  where true;

  select count(*) into v_pool from _deck_candidates;

  -- For each tier in turn, pick best-first while relaxing the variety caps one at a time, least important
  -- first: level 0 enforces everything, 1 drops the category cap, 2 also drops the country cap, 3 drops the
  -- dish-family cap too. (A vegan pool only has two categories, so the category cap must go first.)
  for v_tier in 0..3 loop
    for v_level in 0..3 loop
      exit when v_pos >= p_size;
      for c in
        select * from _deck_candidates t
        where t.tier = v_tier
        order by case when t.is_repeat then t.last_seen end, t.soft_hits, t.score desc
      loop
        exit when v_pos >= p_size;
        continue when c.recipe_id = any (v_picked);
        if (v_level < 1 and coalesce((v_categories ->> c.category)::int, 0) >= v_cap)
           or (v_level < 2 and coalesce((v_countries ->> c.country)::int, 0) >= v_cap)
           or (v_level < 3 and coalesce((v_types ->> c.dish_type)::int, 0)
               >= (case when c.dish_type in ('meat', 'seafood', 'veg', 'other') then 4 else 2 end)) then
          continue;
        end if;
        v_picked := v_picked || c.recipe_id;
        v_pos := v_pos + 1;
        v_countries := jsonb_set(v_countries, array[c.country], to_jsonb(coalesce((v_countries ->> c.country)::int, 0) + 1));
        v_categories := jsonb_set(v_categories, array[c.category], to_jsonb(coalesce((v_categories ->> c.category)::int, 0) + 1));
        v_types := jsonb_set(v_types, array[c.dish_type], to_jsonb(coalesce((v_types ->> c.dish_type)::int, 0) + 1));
        recipe_id := c.recipe_id; pos := v_pos; score := c.score; pool_size := v_pool; is_repeat := c.is_repeat;
        return next;
      end loop;
    end loop;
  end loop;
end;
$$;

revoke all on function public.build_deck(jsonb, jsonb, jsonb, int) from public, anon, authenticated;

-- Light recipe fields for the swipe cards (ingredients and steps stay hidden until the reveal).
create function public.deck_json(p_deck_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'deck_id', d.id,
    'deck_date', d.deck_date,
    'pool_size', d.pool_size,
    'repeat_count', d.repeat_count,
    'recipes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', r.id, 'title', r.title, 'image_url', r.image_url,
          'country', r.country, 'category', r.category, 'dish_type', r.dish_type, 'tags', r.tags,
          'allergens', r.allergens, 'diet_flags', r.diet_flags
        ) order by t.ord
      )
      from unnest(d.recipe_ids) with ordinality as t(rid, ord)
      join public.recipes r on r.id = t.rid
    ), '[]'::jsonb)
  )
  from public.daily_decks d
  where d.id = p_deck_id;
$$;

revoke all on function public.deck_json(uuid) from public, anon, authenticated;

-- Today's deck for the caller's couple (their local date), created on first request.
create function public.get_or_create_today_deck() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_couple uuid;
  v_tz text;
  v_date date;
  v_deck uuid;
  v_prefs jsonb[];
  v_recent jsonb;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select m.couple_id, c.timezone into v_couple, v_tz
  from public.couple_members m join public.couples c on c.id = m.couple_id
  where m.user_id = v_user;
  if v_couple is null then raise exception 'couple_not_ready'; end if;

  -- Two people, both with finished preferences.
  select array_agg(
    jsonb_build_object('diet', p.diet, 'allergens', p.allergens, 'cuisines', p.cuisines, 'disliked', p.disliked)
    order by p.user_id
  ) into v_prefs
  from public.couple_members m join public.preferences p on p.user_id = m.user_id
  where m.couple_id = v_couple;
  if coalesce(array_length(v_prefs, 1), 0) < 2 then raise exception 'couple_not_ready'; end if;

  v_date := (now() at time zone v_tz)::date;

  -- Serialize concurrent first requests (both partners opening the app at once).
  perform pg_advisory_xact_lock(hashtext(v_couple::text));

  select id into v_deck from public.daily_decks where couple_id = v_couple and deck_date = v_date;
  if v_deck is not null then return public.deck_json(v_deck); end if;

  select coalesce(jsonb_object_agg(rid::text, last_date), '{}') into v_recent
  from (
    select rid, max(d.deck_date) as last_date
    from public.daily_decks d, unnest(d.recipe_ids) as rid
    where d.couple_id = v_couple and d.deck_date > v_date - 30
    group by rid
  ) s;

  insert into public.daily_decks (couple_id, deck_date, recipe_ids, pool_size, repeat_count)
  select v_couple, v_date,
         coalesce(array_agg(b.recipe_id order by b.pos), '{}'),
         coalesce(max(b.pool_size), 0),
         count(*) filter (where b.is_repeat)
  from public.build_deck(v_prefs[1], v_prefs[2], v_recent, 12) b
  returning id into v_deck;

  return public.deck_json(v_deck);
end;
$$;

revoke all on function public.get_or_create_today_deck() from public, anon;
grant execute on function public.get_or_create_today_deck() to authenticated;
