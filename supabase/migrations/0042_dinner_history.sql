-- The Dinners tab: what the couple was shown on the days it was revealed, newest first.
--
-- It is the same result get_reveal gives (reveal_pick: the dishes you both liked, else ones one of you liked, else the best
-- fit), with the full recipe so a past dish opens like today's. Only days that were actually revealed count, and a couple
-- whose trial or paid period is over is refused, like the reveal itself.
--
-- shortcut: the full recipes come with every day, so the default is 30 days (a few tens of KB); add paging when
-- someone has months of history worth browsing.

create function public.get_dinner_history(p_limit int default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_couple uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select m.couple_id into v_couple from public.couple_members m where m.user_id = v_user;
  if v_couple is null then raise exception 'couple_not_ready'; end if;
  if not public.couple_has_access(v_couple) then raise exception 'subscription_required'; end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object('deck_id', x.id, 'deck_date', x.deck_date, 'kind', x.kind, 'round', x.round, 'dishes', x.dishes)
      order by x.deck_date desc
    )
    from (
      select d.id, d.deck_date, d.round, p.kind, public.recipe_json(p.ids) as dishes
      from public.daily_decks d
      cross join lateral public.reveal_pick(d.id) p
      where d.couple_id = v_couple and d.revealed_at is not null
      order by d.deck_date desc
      limit least(greatest(coalesce(p_limit, 30), 1), 60)
    ) x
    where x.kind <> 'none' and jsonb_array_length(x.dishes) > 0
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_dinner_history(int) from public, anon, authenticated;
grant execute on function public.get_dinner_history(int) to authenticated;
