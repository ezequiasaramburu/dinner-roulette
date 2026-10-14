-- List every country the catalogue has a recipe for (not only those with 5+), alphabetically, so people can find
-- and pick any of them. Cuisines stay a boost in deck building, never a restriction.
create or replace view public.cuisine_options with (security_invoker = true) as
  select country, count(*)::int as recipe_count
  from public.recipes
  group by country
  order by country;
