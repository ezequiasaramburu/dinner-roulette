-- Phase 4: per-user food preferences. A row existing means the user finished onboarding.
-- Allergen ids match recipes.allergens; dislike ids are matched to ingredients by the deck builder.

create table public.preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  diet text not null default 'none' check (diet in ('none', 'pescatarian', 'vegetarian', 'vegan')),
  allergens text[] not null default '{}' check (
    allergens <@ array['gluten', 'dairy', 'eggs', 'peanuts', 'tree_nuts', 'soy', 'fish', 'shellfish', 'sesame']
  ),
  cuisines text[] not null default '{}', -- liked countries; empty means "open to anything"
  disliked text[] not null default '{}' check (
    disliked <@ array[
      'beef', 'pork', 'lamb', 'chicken', 'seafood', 'mushrooms', 'olives', 'cilantro',
      'onions', 'tomatoes', 'bell_peppers', 'eggplant', 'coconut', 'chili', 'tofu', 'beets'
    ]
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.preferences enable row level security;

-- Own row only. A partner's allergies are used server-side to build decks, never shown to the other user.
create policy "preferences_select_own" on public.preferences
  for select using (auth.uid() = user_id);
create policy "preferences_insert_own" on public.preferences
  for insert with check (auth.uid() = user_id);
create policy "preferences_update_own" on public.preferences
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger preferences_set_updated_at
  before update on public.preferences
  for each row execute function public.set_updated_at();

-- Same as before, plus whether each person has finished their preferences.
create or replace function public.get_couple_state() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'couple_id', c.id,
    'role', me.role,
    'timezone', c.timezone,
    'reveal_time', to_char(c.reveal_time, 'HH24:MI'),
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
