-- Community recipes: anyone can submit a recipe; it is reviewed before it is published.
--
-- Authors write only the ingredients (name and amount) and the steps. Everything the app filters on is derived from
-- the ingredients by rules kept in tables, and cached on the recipe by a trigger:
--   ingredient_names, category, dish_type, allergens, diet_flags, swaps
-- Each viewer's own exclusions are applied when decks are built, exactly as for the imported catalogue.
-- The rules are ported from scripts/mealdb/normalize.mjs; recipes.test.mjs checks that they agree on the whole catalogue.

-- ---------------------------------------------------------------- rule tables (internal: no policies)

create table public.countries (name text primary key, code text not null unique);
create table public.allergen_rules (id serial primary key, allergen text not null, pattern text not null, exclude_pattern text);
create table public.diet_patterns (kind text primary key, pattern text not null);
create table public.dish_family_rules (position int primary key, family text not null, pattern text not null);

alter table public.countries enable row level security;
alter table public.allergen_rules enable row level security;
alter table public.diet_patterns enable row level security;
alter table public.dish_family_rules enable row level security;

insert into public.allergen_rules (allergen, pattern, exclude_pattern) values
  ('gluten', $re$\y(flour|bread|breadcrumbs?|panko|pasta|spaghetti|linguine|fettuccine|tagliatelle|penne|macaroni|rigatoni|lasagn[ae]|noodles?|vermicelli|couscous|barley|rye|semolina|bulgur|bulghur|seitan|wheat|pastry|pita|pitta|tortillas?|naan|buns?|biscuits?|crackers?|soy sauce|beer|ale|stout|orzo|gnocchi|filo|phyllo|croutons?|baguette|ciabatta|brioche|dough|teriyaki|worcestershire)\y$re$, $re$corn|rice|gram|chickpea|almond|coconut|buckwheat|potato|tapioca|cassava|gluten.free|\yoat$re$),
  ('dairy', $re$\y(milk|cream|butter|ghee|cheese|cheddar|parmesan|parmigiano|mozzarella|mozarella|feta|ricotta|mascarpone|halloumi|paneer|gruy[eè]re|brie|camembert|gorgonzola|pecorino|manchego|emmental|edam|gouda|yogh?urt|kefir|buttermilk|custard|whey|casein|cr[eè]me fra[iî]che|labneh|skyr|quark|ice cream)\y$re$, $re$coconut|almond|\ysoy|\yoats?\y|\yrice\y|cashew|peanut|\ynut\y|cocoa|shea|butter ?beans?|butternut|buttercup|cream of tartar|vegan|plant.based|dairy.free|non.dairy$re$),
  ('eggs', $re$\y(eggs?|mayonnaise|mayo|meringue)\y$re$, $re$vegan|egg.free|plant.based$re$),
  ('peanuts', $re$\y(peanuts?|groundnuts?)\y$re$, null),
  ('tree_nuts', $re$\y(almonds?|walnuts?|cashews?|pistachios?|hazelnuts?|pecans?|macadamias?|brazil nuts?|pine nuts?|pine kernels?|chestnuts?|praline|marzipan|nutella|amaretto|nuts?)\y$re$, $re$water chestnut$re$),
  ('soy', $re$\y(soy|soya|soybeans?|tofu|edamame|miso|tempeh|tamari|soy sauce|teriyaki)\y$re$, null),
  ('fish', $re$\y(fish|salmon|tuna|cod|haddock|mackerel|sardines?|anchov(y|ies)|trout|bass|halibut|tilapia|snapper|herring|pollock|plaice|sole|monkfish|swordfish|eel|kippers?|whitebait|mullet|carp|catfish|pilchards?|bonito|dashi|worcestershire|barramundi|hake|bream|whiting|skate|grouper|mahi.mahi|pike|perch|roe|caviar|surimi|kingfish)\y$re$, null),
  ('shellfish', $re$\y(shrimps?|prawns?|crabs?|crabmeat|lobsters?|mussels?|clams?|oysters?|scallops?|squid|calamari|crayfish|crawfish|langoustines?|cockles?|octopus|cuttlefish|whelks?|abalone|krill|shellfish|conchs?|snails?|escargot)\y$re$, null),
  ('sesame', $re$\y(sesame|tahini|hummus)\y$re$, null);

insert into public.diet_patterns (kind, pattern) values
  ('meat', $re$\y(beef|steaks?|mince|veal|brisket|chicken|turkey|duck|goose|pork|bacon|ham|gammon|sausages?|chorizo|salami|pepperoni|prosciutto|pancetta|lamb|mutton|goat|venison|rabbit|oxtail|ribs?|liver|kidney|lard|suet|gelatine?|marrow|meatballs?|mortadella|bresaola|pat[eé])\y$re$),
  ('not_meat', $re$kidney beans?$re$),
  ('meat_stock', $re$^(chicken|beef|pork|lamb|meat|ham|turkey|duck)\s+(stock|bouillon|broth)\y$re$),
  ('meat_word', $re$\y(chicken|beef|pork|lamb|meat|ham|turkey|duck)\y$re$),
  ('non_vegan', $re$\y(honey|gelatine?)\y$re$);

insert into public.dish_family_rules (position, family, pattern) values
  (1, 'soup', $re$\y(soups?|broth|chowder|bisque|bors[c]h|borscht|bortsch|shchi|ukha|pho|laksa|congee|waterzooi|ribollita|pistou|fiskesuppe|tom (yum|kha)|chorba|leblebi)\y$re$),
  (2, 'salad', $re$\ysalad\y$re$),
  (3, 'pasta', $re$\y(pasta|mac and cheese|spaghetti|linguine|fettuccine|fettucine|penne|rigatoni|lasagn[ae]|cannelloni|macaroni|carbonara|bolognese|fideu[aà]|alfredo|puttanesca|cassoulet)\y$re$),
  (4, 'noodles', $re$\y(noodles?|lo mein|chow fun|chow mein|pad thai|pad see ew|ramen|udon|soba|mee goreng|bun-thit|drunken|singapore|yaki)\y$re$),
  (5, 'handheld', $re$\y(sandwich(es)?|burgers?|wraps?|tacos?|fajitas?|banh mi|arepas?|chivito|kapsalon|sloppy joes?|burritos?|quesadillas?|pita|choripán|zapiekanki|shawarma|prego|pizza|lahmacun|buns|roti(?! a l)|patties|parcels|cakes)\y$re$),
  (6, 'pie', $re$\y(pie|pies|pasty|pasties|pastel|tart|tourti[eè]re|wellington|empanadas?|pierogi|pierogii|briks|rotolo|flamiche|lakror|paszteciki|toad in the hole|pate chinois|moussaka)\y$re$),
  (7, 'dumplings', $re$\y(dumplings?|wontons?|gyoza|kn[öo]del|halu[sš]ky|gnocchi|raspeballer|momos?|dolma|golabki|cabbage rolls?|stuffed|spiralized rolls)\y$re$),
  (8, 'curry', $re$\y(curry|masala|rogan josh|korma|handi|karahi|rendang|massaman|panang|amok|moqueca|samlar|kaeng|tikka|katsu curry)\y$re$),
  (9, 'rice', $re$\y(rice|paella|risotto|pilaf|pilau|plov|biryani|mandi|kabse|arroz|jollof|koshari|nasi|gallo pinto|kedgeree|pulao|mastawa|mujaddara)\y$re$),
  (10, 'stew', $re$\y(stew|hotpot|hot pot|goulash|ragu|bourguignon|tagine|tajine|caldereta|sancocho|feijoada|bigos|pepperpot|mechado|pot roast|hodge|hutsepot|lapskaus|fårikål|waterzooi|chilli|chili|casserole|stoemp|stamppot|colcannon|hash)\y$re$),
  (11, 'fried', $re$\y(katsu|tonkatsu|katsudon|milanesa|schnitzel|breaded|karaage|fried chicken|crispy|wings|fritters?|croquetas|lollipop|calamari|squid|fried)\y$re$),
  (12, 'grilled', $re$\y(roast|roasted|grilled|grill|bbq|barbecue|barbecued|asado|kebabs?|skewers|tandoori|jerk|souvlaki|steak|chops|shanks?|brisket|ribs|smoked|peka|choma|seswaa|tafelspitz|leg of|slow-?cooked|sunday)\y$re$),
  (13, 'stirfry', $re$\y(stir-?fr(y|ied)|kung|szechuan|sichuan|teriyaki|sweet and sour|general ts|lok lak|prawn stir|snow peas|bistek|salt (and|&) pepper|orange chicken|honey)\y$re$),
  (14, 'egg', $re$\y(omelette|omelet|tortilla|shakshuka|frittata|egg foo|huevos|pisto|tortang|eggs)\y$re$),
  (15, 'meatballs', $re$\y(meatballs?|kofta|kefta|kafta|frikadeller|fa[sš][ií]rky|rissoles|cevapi|karbonader|meatloaves|bitterballen)\y$re$),
  (16, 'legumes', $re$\y(beans?|lentils?|dal|dhal|chickpeas?|falafel|ful|hummus|tamiya|kidney)\y$re$);

insert into public.countries (name, code) values
  ('Afghanistan', 'AF'),
  ('Albania', 'AL'),
  ('Algeria', 'DZ'),
  ('Andorra', 'AD'),
  ('Angola', 'AO'),
  ('Antigua and Barbuda', 'AG'),
  ('Argentina', 'AR'),
  ('Armenia', 'AM'),
  ('Aruba', 'AW'),
  ('Australia', 'AU'),
  ('Austria', 'AT'),
  ('Azerbaijan', 'AZ'),
  ('Bahamas', 'BS'),
  ('Bahrain', 'BH'),
  ('Bangladesh', 'BD'),
  ('Barbados', 'BB'),
  ('Belarus', 'BY'),
  ('Belgium', 'BE'),
  ('Belize', 'BZ'),
  ('Benin', 'BJ'),
  ('Bhutan', 'BT'),
  ('Bolivia', 'BO'),
  ('Bosnia and Herzegovina', 'BA'),
  ('Botswana', 'BW'),
  ('Brazil', 'BR'),
  ('Brunei', 'BN'),
  ('Bulgaria', 'BG'),
  ('Burkina Faso', 'BF'),
  ('Burundi', 'BI'),
  ('Cabo Verde', 'CV'),
  ('Cambodia', 'KH'),
  ('Cameroon', 'CM'),
  ('Canada', 'CA'),
  ('Cayman Islands', 'KY'),
  ('Central African Republic', 'CF'),
  ('Chad', 'TD'),
  ('Chile', 'CL'),
  ('China', 'CN'),
  ('Colombia', 'CO'),
  ('Comoros', 'KM'),
  ('Congo', 'CG'),
  ('Costa Rica', 'CR'),
  ('Croatia', 'HR'),
  ('Cuba', 'CU'),
  ('Curaçao', 'CW'),
  ('Cyprus', 'CY'),
  ('Czechia', 'CZ'),
  ('Côte d''Ivoire', 'CI'),
  ('DR Congo', 'CD'),
  ('Denmark', 'DK'),
  ('Djibouti', 'DJ'),
  ('Dominica', 'DM'),
  ('Dominican Republic', 'DO'),
  ('Ecuador', 'EC'),
  ('Egypt', 'EG'),
  ('El Salvador', 'SV'),
  ('Equatorial Guinea', 'GQ'),
  ('Eritrea', 'ER'),
  ('Estonia', 'EE'),
  ('Eswatini', 'SZ'),
  ('Ethiopia', 'ET'),
  ('Fiji', 'FJ'),
  ('Finland', 'FI'),
  ('France', 'FR'),
  ('Gabon', 'GA'),
  ('Gambia', 'GM'),
  ('Georgia', 'GE'),
  ('Germany', 'DE'),
  ('Ghana', 'GH'),
  ('Greece', 'GR'),
  ('Grenada', 'GD'),
  ('Guatemala', 'GT'),
  ('Guinea', 'GN'),
  ('Guinea-Bissau', 'GW'),
  ('Guyana', 'GY'),
  ('Haiti', 'HT'),
  ('Honduras', 'HN'),
  ('Hong Kong', 'HK'),
  ('Hungary', 'HU'),
  ('Iceland', 'IS'),
  ('India', 'IN'),
  ('Indonesia', 'ID'),
  ('Iran', 'IR'),
  ('Iraq', 'IQ'),
  ('Ireland', 'IE'),
  ('Israel', 'IL'),
  ('Italy', 'IT'),
  ('Jamaica', 'JM'),
  ('Japan', 'JP'),
  ('Jordan', 'JO'),
  ('Kazakhstan', 'KZ'),
  ('Kenya', 'KE'),
  ('Kiribati', 'KI'),
  ('Kosovo', 'XK'),
  ('Kuwait', 'KW'),
  ('Kyrgyzstan', 'KG'),
  ('Laos', 'LA'),
  ('Latvia', 'LV'),
  ('Lebanon', 'LB'),
  ('Lesotho', 'LS'),
  ('Liberia', 'LR'),
  ('Libya', 'LY'),
  ('Liechtenstein', 'LI'),
  ('Lithuania', 'LT'),
  ('Luxembourg', 'LU'),
  ('Macao', 'MO'),
  ('Madagascar', 'MG'),
  ('Malawi', 'MW'),
  ('Malaysia', 'MY'),
  ('Maldives', 'MV'),
  ('Mali', 'ML'),
  ('Malta', 'MT'),
  ('Mauritania', 'MR'),
  ('Mauritius', 'MU'),
  ('Mexico', 'MX'),
  ('Micronesia', 'FM'),
  ('Moldova', 'MD'),
  ('Monaco', 'MC'),
  ('Mongolia', 'MN'),
  ('Montenegro', 'ME'),
  ('Morocco', 'MA'),
  ('Mozambique', 'MZ'),
  ('Myanmar', 'MM'),
  ('Namibia', 'NA'),
  ('Nepal', 'NP'),
  ('Netherlands', 'NL'),
  ('New Zealand', 'NZ'),
  ('Nicaragua', 'NI'),
  ('Niger', 'NE'),
  ('Nigeria', 'NG'),
  ('North Korea', 'KP'),
  ('North Macedonia', 'MK'),
  ('Norway', 'NO'),
  ('Oman', 'OM'),
  ('Pakistan', 'PK'),
  ('Palestine', 'PS'),
  ('Panama', 'PA'),
  ('Papua New Guinea', 'PG'),
  ('Paraguay', 'PY'),
  ('Peru', 'PE'),
  ('Philippines', 'PH'),
  ('Poland', 'PL'),
  ('Portugal', 'PT'),
  ('Puerto Rico', 'PR'),
  ('Qatar', 'QA'),
  ('Romania', 'RO'),
  ('Russia', 'RU'),
  ('Rwanda', 'RW'),
  ('Saint Kitts and Nevis', 'KN'),
  ('Saint Lucia', 'LC'),
  ('Saint Vincent and the Grenadines', 'VC'),
  ('Samoa', 'WS'),
  ('San Marino', 'SM'),
  ('Saudi Arabia', 'SA'),
  ('Senegal', 'SN'),
  ('Serbia', 'RS'),
  ('Seychelles', 'SC'),
  ('Sierra Leone', 'SL'),
  ('Singapore', 'SG'),
  ('Slovakia', 'SK'),
  ('Slovenia', 'SI'),
  ('Solomon Islands', 'SB'),
  ('Somalia', 'SO'),
  ('South Africa', 'ZA'),
  ('South Korea', 'KR'),
  ('South Sudan', 'SS'),
  ('Spain', 'ES'),
  ('Sri Lanka', 'LK'),
  ('Sudan', 'SD'),
  ('Suriname', 'SR'),
  ('Sweden', 'SE'),
  ('Switzerland', 'CH'),
  ('Syria', 'SY'),
  ('São Tomé and Príncipe', 'ST'),
  ('Taiwan', 'TW'),
  ('Tajikistan', 'TJ'),
  ('Tanzania', 'TZ'),
  ('Thailand', 'TH'),
  ('Timor-Leste', 'TL'),
  ('Togo', 'TG'),
  ('Tonga', 'TO'),
  ('Trinidad and Tobago', 'TT'),
  ('Tunisia', 'TN'),
  ('Turkey', 'TR'),
  ('Turkmenistan', 'TM'),
  ('Tuvalu', 'TV'),
  ('Uganda', 'UG'),
  ('Ukraine', 'UA'),
  ('United Arab Emirates', 'AE'),
  ('United Kingdom', 'GB'),
  ('United States', 'US'),
  ('Uruguay', 'UY'),
  ('Uzbekistan', 'UZ'),
  ('Vanuatu', 'VU'),
  ('Vatican City', 'VA'),
  ('Venezuela', 'VE'),
  ('Vietnam', 'VN'),
  ('Yemen', 'YE'),
  ('Zambia', 'ZM'),
  ('Zimbabwe', 'ZW');

-- ---------------------------------------------------------------- recipes: authors and review

alter table public.recipes
  add column author_id uuid references auth.users (id) on delete cascade, -- null for the imported catalogue
  add column status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  add column review_note text,       -- why it was rejected, shown to the author
  add column submitted_at timestamptz,
  add column reviewed_at timestamptz;

alter table public.recipes alter column source_id drop not null;
alter table public.recipes alter column image_url drop not null; -- a photo is optional for community recipes
alter table public.recipes add constraint recipes_origin_check check (source_id is not null or author_id is not null);

create index recipes_author_idx on public.recipes (author_id) where author_id is not null;
create index recipes_status_idx on public.recipes (status) where status <> 'approved';

-- People see approved recipes, plus their own in whatever state. (Writes go through the functions below.)
drop policy "recipes_select_authenticated" on public.recipes;
create policy "recipes_select_visible" on public.recipes
  for select to authenticated using (status = 'approved' or author_id = auth.uid());

create or replace view public.cuisine_options with (security_invoker = true) as
  select country, count(*)::int as recipe_count
  from public.recipes
  where status = 'approved'
  group by country
  order by country;

create function public.recipes_review_stamp() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from old.status then new.reviewed_at := now(); end if;
  return new;
end;
$$;

create trigger recipes_review_stamp before update of status on public.recipes
  for each row execute function public.recipes_review_stamp();

-- ---------------------------------------------------------------- deriving what the app filters on

-- Allergens named by the ingredients. An unspecified "seafood mix" could contain anything.
create function public.derive_allergens(p_names text[]) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct a order by a), '{}')
  from (
    select r.allergen as a
    from unnest(p_names) n
    join public.allergen_rules r on n ~* r.pattern and (r.exclude_pattern is null or n !~* r.exclude_pattern)
    union
    select unnest(array['fish', 'shellfish'])
    where exists (select 1 from unnest(p_names) n where n ~ '\yseafood\y')
  ) x;
$$;

create function public.derive_diet(p_category text, p_names text[], p_allergens text[]) returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare
  v_meat text := (select pattern from public.diet_patterns where kind = 'meat');
  v_not_meat text := (select pattern from public.diet_patterns where kind = 'not_meat');
  v_non_vegan text := (select pattern from public.diet_patterns where kind = 'non_vegan');
  v_has_meat boolean;
  v_has_fish boolean;
  v_animal boolean;
  v_flags text[] := '{}';
begin
  v_has_meat := p_category in ('Beef', 'Chicken', 'Pork', 'Lamb', 'Goat')
    or exists (select 1 from unnest(p_names) n where n ~* v_meat and n !~* v_not_meat);
  v_has_fish := p_allergens && array['fish', 'shellfish'] or p_category = 'Seafood';
  v_animal := p_allergens && array['dairy', 'eggs'] or exists (select 1 from unnest(p_names) n where n ~* v_non_vegan);
  -- Alphabetical, like the importer: pescatarian, vegan, vegetarian.
  if not v_has_meat then v_flags := array_append(v_flags, 'pescatarian'); end if;
  if not v_has_meat and not v_has_fish and not v_animal then v_flags := array_append(v_flags, 'vegan'); end if;
  if not v_has_meat and not v_has_fish then v_flags := array_append(v_flags, 'vegetarian'); end if;
  return v_flags;
end;
$$;

-- Allergens, diet flags and stock-cube swaps for a recipe of a known category. Dishes whose only meat is a stock
-- cube are judged without it, and the swap ("chicken stock cube" -> "vegetable stock cube") is recorded.
create function public.derive_flags(p_category text, p_names text[]) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_allergens text[] := public.derive_allergens(p_names);
  v_stock text := (select pattern from public.diet_patterns where kind = 'meat_stock');
  v_word text := (select pattern from public.diet_patterns where kind = 'meat_word');
  v_swapped text[];
  v_swaps jsonb;
  v_own text[];
  v_with text[];
  v_use boolean;
begin
  if p_category = 'Seafood' and not (v_allergens && array['fish', 'shellfish']) then
    v_allergens := array(select distinct x from unnest(v_allergens || array['fish', 'shellfish']) x order by x);
  end if;

  v_swapped := array(select n from unnest(p_names) with ordinality as t(n, ord) where n ~* v_stock order by ord);
  v_swaps := coalesce(
    (select jsonb_agg(jsonb_build_object('from', n, 'to', regexp_replace(n, v_word, 'vegetable')) order by ord)
     from unnest(v_swapped) with ordinality as t(n, ord)),
    '[]'::jsonb);

  v_own := public.derive_diet(p_category, p_names, v_allergens);
  v_with := public.derive_diet(p_category, array(select n from unnest(p_names) n where n <> all (v_swapped)), v_allergens);
  v_use := coalesce(array_length(v_swapped, 1), 0) > 0 and cardinality(v_with) > cardinality(v_own);

  return jsonb_build_object(
    'allergens', to_jsonb(v_allergens),
    'diet_flags', to_jsonb(case when v_use then v_with else v_own end),
    'swaps', case when v_use then v_swaps else '[]'::jsonb end
  );
end;
$$;

-- Dish family from the title (soup, pie, rice...): lets decks avoid three of a kind in a row.
create function public.derive_dish_type(p_title text, p_category text) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select family from public.dish_family_rules where p_title ~* pattern order by position limit 1),
    case
      when p_category = 'Seafood' then 'seafood'
      when p_category in ('Beef', 'Chicken', 'Pork', 'Lamb', 'Goat') then 'meat'
      when p_category in ('Vegetarian', 'Vegan') then 'veg'
      else 'other'
    end
  );
$$;

-- The main ingredient, for authored recipes (the importer takes TheMealDB's category instead).
create function public.derive_category(p_names text[]) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v_stock text := (select pattern from public.diet_patterns where kind = 'meat_stock');
  v_meat text := (select pattern from public.diet_patterns where kind = 'meat');
  v_not_meat text := (select pattern from public.diet_patterns where kind = 'not_meat');
  v_names text[] := array(select n from unnest(p_names) n where n !~* v_stock); -- a stock cube is not the main ingredient
  v_rule text;
begin
  select r.id into v_rule
  from public.dislike_rules r
  where r.id in ('beef', 'pork', 'lamb', 'chicken')
    and exists (select 1 from unnest(v_names) n where n ~* r.include_pattern and (r.exclude_pattern is null or n !~* r.exclude_pattern))
  order by case r.id when 'beef' then 1 when 'pork' then 2 when 'lamb' then 3 else 4 end
  limit 1;
  if v_rule is not null then return initcap(v_rule); end if;

  if public.derive_allergens(v_names) && array['fish', 'shellfish'] then return 'Seafood'; end if;
  if exists (select 1 from unnest(v_names) n where n ~* v_meat and n !~* v_not_meat) then return 'Miscellaneous'; end if;
  if exists (select 1 from unnest(v_names) n where n ~* '\y(pasta|spaghetti|linguine|fettuccine|tagliatelle|penne|macaroni|rigatoni|lasagn[ae]|orzo|gnocchi)\y') then
    return 'Pasta';
  end if;
  return 'Vegetarian';
end;
$$;

create function public.recipes_derive() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_names text[];
  v_category text;
  v_flags jsonb;
begin
  v_names := array(
    select lower(trim(i ->> 'name')) from jsonb_array_elements(new.ingredients) with ordinality as t(i, ord) order by ord
  );
  v_category := public.derive_category(v_names);
  v_flags := public.derive_flags(v_category, v_names);
  if v_category = 'Vegetarian' and (v_flags -> 'diet_flags') @> '"vegan"'::jsonb then v_category := 'Vegan'; end if;

  new.ingredient_names := v_names;
  new.category := v_category;
  new.dish_type := public.derive_dish_type(new.title, v_category);
  new.allergens := array(select jsonb_array_elements_text(v_flags -> 'allergens'));
  new.diet_flags := array(select jsonb_array_elements_text(v_flags -> 'diet_flags'));
  new.swaps := v_flags -> 'swaps';
  return new;
end;
$$;

create trigger recipes_derive before insert or update of title, ingredients on public.recipes
  for each row when (new.author_id is not null) execute function public.recipes_derive();

revoke all on function
  public.derive_allergens(text[]), public.derive_diet(text, text[], text[]), public.derive_flags(text, text[]),
  public.derive_dish_type(text, text), public.derive_category(text[])
from public, anon, authenticated;

-- ---------------------------------------------------------------- terms, blocks and reports

alter table public.profiles add column terms_accepted_at timestamptz;

create table public.author_blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.recipe_reports (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (reason in ('offensive', 'spam', 'copied', 'unsafe', 'wrong', 'other')),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  unique (recipe_id, reporter_id)
);

alter table public.author_blocks enable row level security;
alter table public.recipe_reports enable row level security;

-- ---------------------------------------------------------------- the functions the app calls

create function public.submit_recipe(
  p_title text,
  p_country text,
  p_ingredients jsonb,
  p_steps jsonb,
  p_image_url text default null,
  p_accept_terms boolean default false
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_title text := trim(coalesce(p_title, ''));
  v_ingredients jsonb;
  v_steps jsonb;
  v_accepted timestamptz;
  v_id uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  if char_length(v_title) not between 3 and 80 then raise exception 'invalid_title'; end if;
  if not exists (select 1 from public.countries where name = p_country) then raise exception 'invalid_country'; end if;

  if jsonb_typeof(p_ingredients) is distinct from 'array' or jsonb_array_length(p_ingredients) not between 3 and 30 then
    raise exception 'invalid_ingredients';
  end if;
  select jsonb_agg(jsonb_build_object('name', trim(i ->> 'name'), 'measure', trim(coalesce(i ->> 'measure', ''))) order by ord)
  into v_ingredients
  from jsonb_array_elements(p_ingredients) with ordinality as t(i, ord);
  if exists (
    select 1 from jsonb_array_elements(v_ingredients) i
    where char_length(i ->> 'name') not between 1 and 60 or char_length(i ->> 'measure') > 40
  ) then
    raise exception 'invalid_ingredients';
  end if;

  if jsonb_typeof(p_steps) is distinct from 'array' or jsonb_array_length(p_steps) not between 1 and 25 then
    raise exception 'invalid_steps';
  end if;
  select jsonb_agg(trim(s) order by ord) into v_steps from jsonb_array_elements_text(p_steps) with ordinality as t(s, ord);
  if exists (select 1 from jsonb_array_elements_text(v_steps) s where char_length(s) not between 3 and 600) then
    raise exception 'invalid_steps';
  end if;

  -- No links or adverts, in any text field.
  if v_title || ' ' || v_ingredients::text || ' ' || v_steps::text ~* '(https?:|www\.)' then
    raise exception 'links_not_allowed';
  end if;

  if p_image_url is not null
     and p_image_url !~ ('^https?://[^/]+/storage/v1/object/public/recipe-photos/' || v_user::text || '/[A-Za-z0-9_.-]+$') then
    raise exception 'invalid_image';
  end if;

  select terms_accepted_at into v_accepted from public.profiles where id = v_user;
  if v_accepted is null then
    if not coalesce(p_accept_terms, false) then raise exception 'terms_required'; end if;
    update public.profiles set terms_accepted_at = now() where id = v_user;
  end if;

  if (select count(*) from public.recipes where author_id = v_user and submitted_at > now() - interval '24 hours') >= 5 then
    raise exception 'too_many_recipes';
  end if;
  if (select count(*) from public.recipes where author_id = v_user and status = 'pending') >= 10 then
    raise exception 'too_many_pending';
  end if;

  -- category, dish_type, ingredient_names, allergens, diet_flags and swaps are filled in by the recipes_derive trigger.
  insert into public.recipes (
    author_id, status, submitted_at, title, country, image_url, ingredients, steps, category, ingredient_names
  ) values (
    v_user, 'pending', now(), v_title, p_country, p_image_url, v_ingredients, v_steps, 'Vegetarian', '{}'
  ) returning id into v_id;

  return v_id;
end;
$$;

create function public.delete_recipe(p_recipe_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  delete from public.recipes where id = p_recipe_id and author_id = auth.uid();
  if not found then raise exception 'recipe_not_found'; end if;
end;
$$;

-- Report a community recipe. The reporter's couple stops seeing it right away, and three different reporters
-- send an approved recipe back to review.
create function public.report_recipe(p_recipe_id uuid, p_reason text, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_author uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select author_id into v_author from public.recipes where id = p_recipe_id and status = 'approved';
  if not found or v_author is null then raise exception 'recipe_not_found'; end if;
  if v_author = v_user then raise exception 'cannot_report_own_recipe'; end if;

  insert into public.recipe_reports (recipe_id, reporter_id, reason, note)
  values (p_recipe_id, v_user, p_reason, nullif(trim(coalesce(p_note, '')), ''))
  on conflict (recipe_id, reporter_id) do nothing;

  if (select count(*) from public.recipe_reports where recipe_id = p_recipe_id) >= 3 then
    update public.recipes set status = 'pending', review_note = 'Sent back to review after reports' where id = p_recipe_id;
  end if;
end;
$$;

-- Hide everything by this recipe's author. Takes a recipe, so the app never handles another person's id.
-- Not possible for yourself or for your partner (their recipes are part of your shared queue).
create function public.block_author(p_recipe_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_author uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select author_id into v_author from public.recipes where id = p_recipe_id;
  if v_author is null then raise exception 'recipe_not_found'; end if;
  if v_author = v_user then raise exception 'cannot_block_yourself'; end if;
  if public.shares_couple_with(v_author) then raise exception 'cannot_block_partner'; end if;

  insert into public.author_blocks (blocker_id, blocked_id) values (v_user, v_author) on conflict do nothing;
end;
$$;

create function public.clear_blocks() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  delete from public.author_blocks where blocker_id = auth.uid();
end;
$$;

revoke all on function
  public.submit_recipe(text, text, jsonb, jsonb, text, boolean), public.delete_recipe(uuid),
  public.report_recipe(uuid, text, text), public.block_author(uuid), public.clear_blocks()
from public, anon;
grant execute on function
  public.submit_recipe(text, text, jsonb, jsonb, text, boolean), public.delete_recipe(uuid),
  public.report_recipe(uuid, text, text), public.block_author(uuid), public.clear_blocks()
to authenticated;

-- ---------------------------------------------------------------- dishes tell the app when they are community recipes

create or replace function public.dish_json(p_ids uuid[]) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id, 'title', r.title, 'image_url', r.image_url, 'country', r.country,
      'category', r.category, 'dish_type', r.dish_type, 'tags', r.tags,
      'allergens', r.allergens, 'diet_flags', r.diet_flags, 'swaps', r.swaps,
      'ingredient_names', r.ingredient_names, 'community', r.author_id is not null
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
      'ingredients', r.ingredients, 'steps', r.steps,
      'youtube_url', r.youtube_url, 'source_url', r.source_url
    ) order by t.ord
  ), '[]'::jsonb)
  from unnest(p_ids) with ordinality as t(rid, ord)
  join public.recipes r on r.id = t.rid;
$$;

-- ---------------------------------------------------------------- decks: approved recipes only, minus blocks and reports

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
  -- Community recipes: authors this couple blocked and recipes one of them reported never appear.
  v_blocked uuid[] := array(
    select distinct jsonb_array_elements_text(coalesce(p_a -> 'blocked_authors', '[]') || coalesce(p_b -> 'blocked_authors', '[]'))::uuid
  );
  v_hidden uuid[] := array(
    select distinct jsonb_array_elements_text(coalesce(p_a -> 'hidden_recipes', '[]') || coalesce(p_b -> 'hidden_recipes', '[]'))::uuid
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
  where r.status = 'approved'
    and not coalesce(r.author_id = any (v_blocked), false)
    and not (r.id = any (v_hidden))
    and (v_diet = 'none' or v_diet = any (r.diet_flags))
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

revoke all on function public.ensure_deck(uuid, date) from public, anon, authenticated;

-- joining a couple removes any block between the two people
create or replace function public.join_couple(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_invite public.invites;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.couple_members where user_id = v_user) then
    raise exception 'already_in_couple';
  end if;

  -- 5 wrong codes in 15 minutes locks joining for a while. A 6-character code can't be brute-forced at that pace.
  if (select count(*) from public.join_attempts
      where user_id = v_user and attempted_at > now() - interval '15 minutes') >= 5 then
    raise exception 'too_many_attempts';
  end if;

  select * into v_invite from public.invites
  where code = upper(trim(p_code)) for update;

  if not found or v_invite.used_at is not null or v_invite.expires_at <= now() then
    delete from public.join_attempts where attempted_at < now() - interval '1 day';
    insert into public.join_attempts (user_id) values (v_user);
    return null;
  end if;

  -- Serialize concurrent joins on the couple row, then enforce the 2-member cap.
  perform 1 from public.couples where id = v_invite.couple_id for update;
  if (select count(*) from public.couple_members where couple_id = v_invite.couple_id) >= 2 then
    raise exception 'couple_full';
  end if;

  insert into public.couple_members (couple_id, user_id, role)
  values (v_invite.couple_id, v_user, 'partner');

  update public.invites set used_by = v_user, used_at = now() where code = v_invite.code;

  -- Pairing up is deliberate: a block between the two of them (made before they met) no longer applies.
  delete from public.author_blocks
  where blocker_id in (select user_id from public.couple_members where couple_id = v_invite.couple_id)
    and blocked_id in (select user_id from public.couple_members where couple_id = v_invite.couple_id);
  delete from public.join_attempts where user_id = v_user;

  return v_invite.couple_id;
end;
$$;

revoke all on function public.join_couple(text) from public, anon;
grant execute on function public.join_couple(text) to authenticated;
