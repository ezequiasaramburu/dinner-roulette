-- Free-text exclusions: anything a person is allergic to or doesn't want that our fixed lists don't cover
-- (kiwi, mustard, celery...). Nothing is stored on recipes: each term is matched against a recipe's ingredient
-- names when the deck is built, so it also works for recipes added later. Both lists exclude outright; they are
-- kept apart so the app can word them differently and treat them differently later.

alter table public.preferences
  add column custom_allergens text[] not null default '{}',
  add column custom_dislikes text[] not null default '{}';

-- Lower-case, letters/digits/spaces/hyphens/apostrophes only, single spaces, 3 to 40 characters, no duplicates.
create function public.normalize_terms(p_terms text[]) returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(array_agg(distinct t order by t), '{}')
  from (
    select btrim(regexp_replace(lower(regexp_replace(x, '[^[:alnum:] ''-]', ' ', 'g')), '\s+', ' ', 'g')) as t
    from unnest(p_terms) as x
  ) s
  where length(t) between 3 and 40;
$$;

-- security definer: it runs for the signed-in user, who may not call the helper directly.
create function public.preferences_normalize() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.custom_allergens := public.normalize_terms(new.custom_allergens);
  new.custom_dislikes := public.normalize_terms(new.custom_dislikes);
  if cardinality(new.custom_allergens) > 20 or cardinality(new.custom_dislikes) > 20 then
    raise exception 'too_many_exclusions';
  end if;
  return new;
end;
$$;

create trigger preferences_normalize
  before insert or update on public.preferences
  for each row execute function public.preferences_normalize();

-- The regex for one term: whole words only ("nut" does not match "nutmeg" or "butternut"), a plural is tolerated
-- ("peanuts" matches "peanut butter"), and spaces match any run of spaces.
create function public.term_pattern(p_term text) returns text
language sql immutable set search_path = '' as $$
  select '\m'
    || regexp_replace(
         case when length(t) > 3 and t ~ '[^s]s$' then left(t, -1) else t end,
         ' +', '\\s+', 'g')
    || '(?:s|es)?\M'
  from (select regexp_replace(lower(p_term), '[^[:alnum:] ''-]', '', 'g') as t) x;
$$;

revoke all on function public.term_pattern(text), public.normalize_terms(text[]) from public, anon, authenticated;

-- The deck builder and the queue now carry the exclusions.
create or replace function public.build_deck(p_a jsonb, p_b jsonb, p_recent jsonb default '{}', p_size int default 12)
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
  -- Free-text exclusions (allergies and dislikes) from both partners, matched against ingredient names.
  v_terms text[] := array(
    select distinct jsonb_array_elements_text(coalesce(p_a -> 'custom_terms', '[]') || coalesce(p_b -> 'custom_terms', '[]'))
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
    )
    and not exists (
      select 1 from unnest(r.ingredient_names) n, unnest(v_terms) t where n ~* public.term_pattern(t)
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
