-- Security pass (database).
--
-- 1. Least privilege on tables. Supabase hands every table in `public` to anon and authenticated with ALL privileges and
--    relies on row-level security alone. Here anon gets nothing, and authenticated gets only what the app reads or writes
--    directly (everything else goes through the functions). TRUNCATE, TRIGGER and REFERENCES are never granted. New tables
--    and functions in `public` are closed by default from now on: grant explicitly, like the migrations already do.
-- 2. profiles by column. `push_token` was readable by the partner (profiles_select_partner shows a whole row) and any
--    column of your own row was writable (terms_accepted_at). Now: readable id, display_name, terms_accepted_at, locale,
--    created_at; writable display_name only. (push_token and updated_at stay server-only.)
-- 3. Trigger functions are not callable as API functions.
-- 4. The trial / paid period is also checked when swiping, undoing and reading the reveal, not only when a day's deck is
--    built, so a deck made before the trial ended cannot be used after it.

-- 1. tables, views and sequences
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

grant select on public.couples, public.couple_members, public.daily_decks, public.notices, public.recipes to authenticated;
grant select on public.cuisine_options to authenticated;
grant select, insert, update on public.preferences to authenticated;

-- 2. profiles by column
grant select (id, display_name, terms_accepted_at, locale, created_at) on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

-- 3. trigger functions
revoke execute on function
  public.handle_new_user(), public.preferences_normalize(), public.recipes_derive(),
  public.recipes_review_stamp(), public.set_updated_at()
from public, anon, authenticated;

-- 4. access check on the paths that do not build a deck
CREATE OR REPLACE FUNCTION public.swipe_guard(p_deck_id uuid)
 RETURNS uuid[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  -- A deck built earlier today must not outlive the trial or the paid period.
  if not public.couple_has_access(v_deck.couple_id) then raise exception 'subscription_required'; end if;

  select timezone, reveal_time, reveal_mode into v_tz, v_reveal, v_mode from public.couples where id = v_deck.couple_id;
  if v_deck.deck_date <> public.cycle_date(v_tz) then raise exception 'deck_closed'; end if;
  if public.deck_revealed(p_deck_id) then raise exception 'deck_closed'; end if;
  if public.close_if_goal_reached(p_deck_id) then raise exception 'deck_closed'; end if;

  return v_deck.recipe_ids;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_reveal()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_couple uuid;
  v_tz text;
  v_reveal time;
  v_mode text;
  v_goal int;
  v_today date;
  v_reveal_at timestamptz;
  v_deck public.daily_decks;
  v_kind text;
  v_ids uuid[];
  v_round smallint;
  v_can boolean;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select m.couple_id, c.timezone, c.reveal_time, c.reveal_mode, c.match_goal
  into v_couple, v_tz, v_reveal, v_mode, v_goal
  from public.couple_members m join public.couples c on c.id = m.couple_id
  where m.user_id = v_user;
  if v_couple is null then raise exception 'couple_not_ready'; end if;
  if not public.couple_has_access(v_couple) then raise exception 'subscription_required'; end if;

  v_today := (now() at time zone v_tz)::date;
  select d.round into v_round from public.daily_decks d where d.couple_id = v_couple and d.deck_date = v_today;
  v_round := coalesce(v_round, 1);

  -- A second round ("swipe again") reveals the way instant mode does, whatever the mode.
  if v_mode = 'instant' or v_round > 1 then
    select * into v_deck from public.daily_decks where couple_id = v_couple and deck_date = v_today;
    if found then perform public.close_if_goal_reached(v_deck.id); end if;
    select * into v_deck from public.daily_decks
    where couple_id = v_couple and deck_date = v_today and revealed_at is not null;
    if not found then
      return jsonb_build_object('status', 'pending', 'reveal_at', null::timestamptz);
    end if;
    v_reveal_at := v_deck.revealed_at;
  else
    -- Already stamped: the dinner was revealed earlier today, even if the reveal time was moved later since.
    select * into v_deck from public.daily_decks
    where couple_id = v_couple and deck_date = v_today and revealed_at is not null;
    if found then
      v_reveal_at := v_deck.revealed_at;
    else
      v_reveal_at := (v_today + v_reveal) at time zone v_tz;
      if now() < v_reveal_at then
        return jsonb_build_object('status', 'pending', 'reveal_at', v_reveal_at);
      end if;
      v_deck := public.ensure_deck(v_couple, v_today);
      perform public.deck_revealed(v_deck.id);
    end if;
  end if;

  select p.kind, p.ids into v_kind, v_ids from public.reveal_pick(v_deck.id) p;

  -- One more try, once, and only when nobody matched and there is still something new to swipe.
  v_can := v_deck.round = 1 and v_kind in ('closest', 'surprise') and exists (
    select 1 from public.couple_members m where m.couple_id = v_couple and not public.out_of_dishes(v_deck.id, m.user_id)
  );

  return jsonb_build_object(
    'status', 'revealed',
    'reveal_at', v_reveal_at,
    'deck_id', v_deck.id,
    'kind', v_kind,
    'round', v_deck.round,
    'can_swipe_again', v_can,
    'seen', exists (select 1 from public.reveal_views rv where rv.deck_id = v_deck.id and rv.user_id = v_user),
    'dishes', public.recipe_json(coalesce(v_ids, '{}'))
  );
end;
$function$;
