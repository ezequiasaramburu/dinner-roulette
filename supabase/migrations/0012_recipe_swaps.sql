-- Easy ingredient swaps that make a dish fit a diet, e.g. [{ "from": "chicken stock cube", "to": "vegetable stock cube" }].
-- A dish whose only meat is a stock cube is flagged vegetarian (and vegan if nothing else is animal-based) and carries
-- the swap so the cook knows. Filled by the recipe import (scripts/mealdb).
alter table public.recipes add column swaps jsonb not null default '[]';

-- Swipe cards and the revealed recipe both carry the swaps.
create or replace function public.dish_json(p_ids uuid[]) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id, 'title', r.title, 'image_url', r.image_url, 'country', r.country,
      'category', r.category, 'dish_type', r.dish_type, 'tags', r.tags,
      'allergens', r.allergens, 'diet_flags', r.diet_flags, 'swaps', r.swaps
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
      'ingredients', r.ingredients, 'steps', r.steps,
      'youtube_url', r.youtube_url, 'source_url', r.source_url
    ) order by t.ord
  ), '[]'::jsonb)
  from unnest(p_ids) with ordinality as t(rid, ord)
  join public.recipes r on r.id = t.rid;
$$;
