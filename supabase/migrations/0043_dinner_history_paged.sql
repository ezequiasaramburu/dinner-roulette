-- Dinners tab, lighter: a page of days with card-sized dishes, and one full recipe only when it is opened.
--
-- 0042 sent every recipe in full (ingredients and steps) for 30 days in one call. Now:
--   get_dinner_history(p_before, p_limit)  a page of revealed days, newest first, with dish_json (what a card needs).
--       p_before is the 'next_before' of the previous page (null for the first). 'next_before' is null on the last page.
--   get_history_recipe(p_id)  the full recipe of one dish the couple was shown on a revealed day (and only those: a dish
--       that was in the queue but not in the result stays private, like the reveal itself).
-- Both are refused outside a couple and once the trial and paid period are over, like the reveal.

drop function public.get_dinner_history(int);

create function public.get_dinner_history(p_before date default null, p_limit int default 10) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_couple uuid;
  v_limit int := least(greatest(coalesce(p_limit, 10), 1), 30);
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select m.couple_id into v_couple from public.couple_members m where m.user_id = v_user;
  if v_couple is null then raise exception 'couple_not_ready'; end if;
  if not public.couple_has_access(v_couple) then raise exception 'subscription_required'; end if;

  -- The page is cut first (one more than asked for tells us if there is a next page), then reveal_pick runs on that page only.
  return (
    with page as (
      select d.id, d.deck_date, d.round
      from public.daily_decks d
      where d.couple_id = v_couple and d.revealed_at is not null and (p_before is null or d.deck_date < p_before)
      order by d.deck_date desc
      limit v_limit + 1
    ), shown as (
      select pg.* from page pg order by pg.deck_date desc limit v_limit
    )
    select jsonb_build_object(
      'days', coalesce((
        select jsonb_agg(
          jsonb_build_object('deck_id', x.id, 'deck_date', x.deck_date, 'kind', x.kind, 'round', x.round, 'dishes', x.dishes)
          order by x.deck_date desc
        )
        from (
          select sh.id, sh.deck_date, sh.round, p.kind, public.dish_json(p.ids) as dishes
          from shown sh cross join lateral public.reveal_pick(sh.id) p
        ) x
        where x.kind <> 'none' and jsonb_array_length(x.dishes) > 0
      ), '[]'::jsonb),
      'next_before', case when (select count(*) from page) > v_limit then (select min(sh.deck_date) from shown sh) end
    )
  );
end;
$$;

revoke all on function public.get_dinner_history(date, int) from public, anon, authenticated;
grant execute on function public.get_dinner_history(date, int) to authenticated;

create function public.get_history_recipe(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_couple uuid;
  v_recipe jsonb;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select m.couple_id into v_couple from public.couple_members m where m.user_id = v_user;
  if v_couple is null then raise exception 'couple_not_ready'; end if;
  if not public.couple_has_access(v_couple) then raise exception 'subscription_required'; end if;

  if not exists (
    select 1
    from public.daily_decks d
    cross join lateral public.reveal_pick(d.id) p
    where d.couple_id = v_couple and d.revealed_at is not null and p_id = any (d.recipe_ids) and p_id = any (p.ids)
  ) then
    raise exception 'recipe_not_found';
  end if;

  v_recipe := public.recipe_json(array[p_id]) -> 0;
  if v_recipe is null then raise exception 'recipe_not_found'; end if;
  return v_recipe;
end;
$$;

revoke all on function public.get_history_recipe(uuid) from public, anon, authenticated;
grant execute on function public.get_history_recipe(uuid) to authenticated;
