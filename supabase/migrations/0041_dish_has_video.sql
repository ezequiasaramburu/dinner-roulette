-- Swipe cards say when a recipe has a video. dish_json returns has_video (true when the recipe has a video link) and not
-- the link itself: like the ingredients and steps, the link stays on the server until the reveal (recipe_json).
-- Recipes written by people have no video, so they are always false.
create or replace function public.dish_json(p_ids uuid[]) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id, 'title', r.title, 'image_url', r.image_url, 'country', r.country,
      'category', r.category, 'dish_type', r.dish_type, 'tags', r.tags,
      'allergens', r.allergens, 'diet_flags', r.diet_flags, 'swaps', r.swaps,
      'ingredient_names', r.ingredient_names, 'community', r.author_id is not null,
      'has_video', coalesce(r.youtube_url, '') <> '',
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
