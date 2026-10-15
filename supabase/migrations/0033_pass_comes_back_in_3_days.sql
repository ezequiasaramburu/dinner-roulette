-- Dishes passed on come back sooner: 3 days instead of 7 (liked dishes keep 7).
--
-- With about 100 dishes a day, a couple who says no to most of them for three or four days in a row ran out of
-- fresh dishes under the 7-day rule.

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

  -- "Recent" means dishes the couple actually swiped, not everything that was queued: a dish only ever passed on
  -- stays out for 3 days (it is a no, and the catalog is small), a dish someone liked for 7.
  select coalesce(jsonb_object_agg(rid::text, last_date), '{}') into v_recent
  from (
    select s.recipe_id as rid, max(d.deck_date) as last_date
    from public.swipes s join public.daily_decks d on d.id = s.deck_id
    where d.couple_id = p_couple and d.deck_date > p_date - (case when s.liked then 7 else 3 end)
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
