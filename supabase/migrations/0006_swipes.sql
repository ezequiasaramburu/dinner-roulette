-- Phase 7: swipes. Each person likes or passes the dishes in their couple's daily deck.
-- You can only ever read your own swipes; the partner's choices stay hidden until the reveal (Phase 8).
-- You can see how MANY dishes your partner has swiped, never which ones.

create table public.swipes (
  deck_id uuid not null references public.daily_decks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  liked boolean not null,
  swiped_at timestamptz not null default now(),
  primary key (deck_id, user_id, recipe_id)
);

create index swipes_user_idx on public.swipes (user_id, swiped_at desc);

alter table public.swipes enable row level security;

-- Own rows only. No insert/update/delete policies: writes go through the functions below.
create policy "swipes_select_own" on public.swipes
  for select using (auth.uid() = user_id);

-- The deck payload now also carries the caller's own swipes and the partner's progress.
create or replace function public.deck_json(p_deck_id uuid) returns jsonb
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
    ), '[]'::jsonb),
    'my_swipes', coalesce((
      select jsonb_object_agg(s.recipe_id::text, s.liked)
      from public.swipes s where s.deck_id = d.id and s.user_id = auth.uid()
    ), '{}'::jsonb),
    'partner_swiped', (
      select count(*)::int from public.swipes s where s.deck_id = d.id and s.user_id <> auth.uid()
    )
  )
  from public.daily_decks d
  where d.id = p_deck_id;
$$;

-- Shared checks for the swipe functions: the caller belongs to the deck's couple and the deck is still
-- today's (in the couple's timezone). Returns the deck's recipe ids.
create function public.swipe_guard(p_deck_id uuid) returns uuid[]
language plpgsql stable security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_deck public.daily_decks;
  v_tz text;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select d.* into v_deck from public.daily_decks d
  join public.couple_members m on m.couple_id = d.couple_id and m.user_id = v_user
  where d.id = p_deck_id;
  if not found then raise exception 'deck_not_found'; end if;

  select timezone into v_tz from public.couples where id = v_deck.couple_id;
  if v_deck.deck_date <> (now() at time zone v_tz)::date then raise exception 'deck_closed'; end if;

  return v_deck.recipe_ids;
end;
$$;

revoke all on function public.swipe_guard(uuid) from public, anon, authenticated;

-- Like or pass a dish. Changing your mind is allowed until the deck closes.
create function public.record_swipe(p_deck_id uuid, p_recipe_id uuid, p_liked boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (p_recipe_id = any (public.swipe_guard(p_deck_id))) then raise exception 'recipe_not_in_deck'; end if;

  insert into public.swipes (deck_id, user_id, recipe_id, liked)
  values (p_deck_id, auth.uid(), p_recipe_id, p_liked)
  on conflict (deck_id, user_id, recipe_id) do update set liked = excluded.liked, swiped_at = now();
end;
$$;

-- Take back your most recent swipe. Returns the dish it was for, or null if there was nothing to undo.
create function public.undo_last_swipe(p_deck_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_recipe uuid;
begin
  perform public.swipe_guard(p_deck_id);

  select recipe_id into v_recipe from public.swipes
  where deck_id = p_deck_id and user_id = auth.uid()
  order by swiped_at desc limit 1;

  if v_recipe is not null then
    delete from public.swipes
    where deck_id = p_deck_id and user_id = auth.uid() and recipe_id = v_recipe;
  end if;
  return v_recipe;
end;
$$;

revoke all on function public.record_swipe(uuid, uuid, boolean), public.undo_last_swipe(uuid) from public, anon;
grant execute on function public.record_swipe(uuid, uuid, boolean), public.undo_last_swipe(uuid) to authenticated;
