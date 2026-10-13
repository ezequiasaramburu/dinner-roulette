-- Phase 5: recipe catalog (imported from TheMealDB by scripts/mealdb/import.mjs).
-- Read-only for app users; rows are loaded through supabase/seed.sql.

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  source_id text not null unique, -- TheMealDB idMeal
  title text not null,
  category text not null,
  country text not null,
  tags text[] not null default '{}',
  image_url text not null,
  youtube_url text,
  source_url text,
  ingredients jsonb not null, -- [{ "name": "...", "measure": "..." }]
  steps jsonb not null,       -- ["...", "..."]
  ingredient_names text[] not null, -- lower-cased, for matching dislikes
  allergens text[] not null default '{}',   -- gluten, dairy, eggs, peanuts, tree_nuts, soy, fish, shellfish, sesame
  diet_flags text[] not null default '{}',  -- pescatarian, vegetarian, vegan (a recipe may carry several)
  created_at timestamptz not null default now()
);

create index recipes_country_idx on public.recipes (country);
create index recipes_allergens_idx on public.recipes using gin (allergens);
create index recipes_diet_flags_idx on public.recipes using gin (diet_flags);

alter table public.recipes enable row level security;

create policy "recipes_select_authenticated" on public.recipes
  for select to authenticated using (true);

-- Cuisines worth offering in the preferences screen (enough recipes to fill a deck).
create view public.cuisine_options with (security_invoker = true) as
  select country, count(*)::int as recipe_count
  from public.recipes
  group by country
  having count(*) >= 5
  order by count(*) desc, country;

grant select on public.cuisine_options to authenticated;
