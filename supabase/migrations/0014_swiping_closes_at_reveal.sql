-- Swiping stops when the dinner is revealed, and reopens when the next day starts.
--
-- Before: in scheduled mode, swipes made after the reveal time counted toward tomorrow's dinner. Now every swipe
-- counts toward the couple's current day, and once the reveal has happened (scheduled: the reveal time has passed;
-- instant: the goal was reached) swiping is closed for both until the next local day.
-- So a day's swiping window is: midnight until the reveal.

drop function public.cycle_date(text, time, text);

-- The dinner date a swipe made right now counts toward: the couple's local date.
create function public.cycle_date(p_tz text) returns date
language sql stable set search_path = '' as $$
  select (now() at time zone p_tz)::date;
$$;

-- Has today's scheduled reveal time passed? (Instant mode has no set time: it closes when the goal is reached.)
create function public.reveal_time_passed(p_tz text, p_reveal time, p_mode text) returns boolean
language sql stable set search_path = '' as $$
  select p_mode = 'scheduled' and (now() at time zone p_tz)::time >= p_reveal;
$$;

revoke all on function public.cycle_date(text), public.reveal_time_passed(text, time, text)
from public, anon, authenticated;

-- status is now one of:
--   ready         keep swiping (dishes has the next few, in order)
--   goal_reached  the couple has enough matches; swiping is over until the reveal
--   closed        the dinner has been revealed; swiping reopens tomorrow
--   exhausted     the caller has been through every dish that fits both of you
create or replace function public.get_swipe_feed() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_couple uuid;
  v_tz text;
  v_reveal time;
  v_mode text;
  v_deck public.daily_decks;
  v_next uuid[];
  v_status text;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select m.couple_id, c.timezone, c.reveal_time, c.reveal_mode
  into v_couple, v_tz, v_reveal, v_mode
  from public.couple_members m join public.couples c on c.id = m.couple_id
  where m.user_id = v_user;
  if v_couple is null then raise exception 'couple_not_ready'; end if;

  v_deck := public.ensure_deck(v_couple, public.cycle_date(v_tz));

  v_status := case
    when public.reveal_time_passed(v_tz, v_reveal, v_mode) then 'closed'
    when public.close_if_goal_reached(v_deck.id) then 'goal_reached'
    else 'ready'
  end;

  select coalesce(array_agg(q.rid order by q.ord), '{}') into v_next
  from (
    select t.rid, t.ord
    from unnest(v_deck.recipe_ids) with ordinality as t(rid, ord)
    where not exists (
      select 1 from public.swipes s where s.deck_id = v_deck.id and s.user_id = v_user and s.recipe_id = t.rid
    )
    order by t.ord
    limit 6
  ) q;

  if v_status = 'ready' and coalesce(array_length(v_next, 1), 0) = 0 then v_status := 'exhausted'; end if;

  return jsonb_build_object(
    'deck_id', v_deck.id,
    'cycle_date', v_deck.deck_date,
    'status', v_status,
    'has_swiped', exists (select 1 from public.swipes s where s.deck_id = v_deck.id and s.user_id = v_user),
    'dishes', case when v_status = 'ready' then public.dish_json(v_next) else '[]'::jsonb end
  );
end;
$$;

create or replace function public.swipe_guard(p_deck_id uuid) returns uuid[]
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_deck public.daily_decks;
  v_tz text;
  v_reveal time;
  v_mode text;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select d.* into v_deck from public.daily_decks d
  join public.couple_members m on m.couple_id = d.couple_id and m.user_id = v_user
  where d.id = p_deck_id;
  if not found then raise exception 'deck_not_found'; end if;

  select timezone, reveal_time, reveal_mode into v_tz, v_reveal, v_mode from public.couples where id = v_deck.couple_id;
  if v_deck.deck_date <> public.cycle_date(v_tz) then raise exception 'deck_closed'; end if;
  if public.reveal_time_passed(v_tz, v_reveal, v_mode) then raise exception 'deck_closed'; end if;
  if public.close_if_goal_reached(p_deck_id) then raise exception 'deck_closed'; end if;

  return v_deck.recipe_ids;
end;
$$;

-- record_swipe reports 'closed' instead of 'ready' if that swipe happened to be the last one before the reveal.
create or replace function public.record_swipe(p_deck_id uuid, p_recipe_id uuid, p_liked boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not (p_recipe_id = any (public.swipe_guard(p_deck_id))) then raise exception 'recipe_not_in_deck'; end if;

  insert into public.swipes (deck_id, user_id, recipe_id, liked)
  values (p_deck_id, auth.uid(), p_recipe_id, p_liked)
  on conflict (deck_id, user_id, recipe_id) do update set liked = excluded.liked, swiped_at = now();

  return jsonb_build_object(
    'status', case when public.close_if_goal_reached(p_deck_id) then 'goal_reached' else 'ready' end
  );
end;
$$;
