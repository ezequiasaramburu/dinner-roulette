-- Instant mode gets the same fallback as scheduled mode.
--
-- Until now an instant dinner only opened when the match goal was reached. A couple who ran out of dishes first, or
-- where one of them stopped swiping, never got a dinner that day. Now the reveal also opens when
--   * both of you have been through every dish in the queue, or
--   * either of you taps "Reveal with what we have" (reveal_now).
-- get_reveal then picks the same way as for a scheduled reveal: what you both liked, else what one of you liked,
-- else the best fit from the queue.

-- Has this person been through every dish of the queue that is still showable?
create function public.out_of_dishes(p_deck_id uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1
    from public.daily_decks d
    cross join lateral unnest(d.recipe_ids) as t(rid)
    where d.id = p_deck_id
      and not exists (select 1 from public.swipes s where s.deck_id = d.id and s.user_id = p_user and s.recipe_id = t.rid)
      and t.rid <> all (public.couple_hidden_recipes(d.couple_id))
      and exists (select 1 from public.recipes r where r.id = t.rid and r.status = 'approved')
  );
$$;

revoke all on function public.out_of_dishes(uuid, uuid) from public, anon, authenticated;

create or replace function public.close_if_goal_reached(p_deck_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_deck public.daily_decks;
  v_goal int;
  v_mode text;
  v_reached boolean;
  v_done boolean;
begin
  select * into v_deck from public.daily_decks where id = p_deck_id;
  select match_goal, reveal_mode into v_goal, v_mode from public.couples where id = v_deck.couple_id;

  v_reached := public.deck_match_count(p_deck_id) >= v_goal;

  if v_mode = 'instant' and v_deck.revealed_at is null then
    -- Nothing left to swipe for either of them: reveal with what we have.
    v_done := v_reached or not exists (
      select 1 from public.couple_members m
      where m.couple_id = v_deck.couple_id and not public.out_of_dishes(p_deck_id, m.user_id)
    );
    if v_done then
      update public.daily_decks set revealed_at = now() where id = p_deck_id and revealed_at is null;
      return true;
    end if;
  end if;
  return v_reached or v_deck.revealed_at is not null;
end;
$$;

-- "Reveal with what we have": either of you can open today's instant reveal early, for both.
create function public.reveal_now() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_couple uuid;
  v_tz text;
  v_mode text;
  v_deck public.daily_decks;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select m.couple_id, c.timezone, c.reveal_mode into v_couple, v_tz, v_mode
  from public.couple_members m join public.couples c on c.id = m.couple_id
  where m.user_id = v_user;
  if v_couple is null then raise exception 'couple_not_ready'; end if;
  if v_mode <> 'instant' then raise exception 'not_instant'; end if;

  v_deck := public.ensure_deck(v_couple, public.cycle_date(v_tz));
  if not exists (select 1 from public.swipes where deck_id = v_deck.id and user_id = v_user) then
    raise exception 'nothing_swiped';
  end if;
  update public.daily_decks set revealed_at = now() where id = v_deck.id and revealed_at is null;
end;
$$;

revoke all on function public.reveal_now() from public, anon;
grant execute on function public.reveal_now() to authenticated;
