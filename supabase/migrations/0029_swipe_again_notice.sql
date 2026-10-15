-- Swiping again tells the partner: "<name> started another round".
alter table public.notices drop constraint notices_kind_check;
alter table public.notices add constraint notices_kind_check
  check (kind in ('match_goal_changed', 'couple_ended', 'partner_left', 'swipe_again_started'));

create or replace function public.swipe_again() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_couple uuid;
  v_tz text;
  v_deck public.daily_decks;
  v_pick record;
  v_partner uuid;
  v_name text;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select m.couple_id, c.timezone into v_couple, v_tz
  from public.couple_members m join public.couples c on c.id = m.couple_id
  where m.user_id = v_user;
  if v_couple is null then raise exception 'couple_not_ready'; end if;

  v_deck := public.ensure_deck(v_couple, public.cycle_date(v_tz));
  perform pg_advisory_xact_lock(hashtext(v_couple::text));
  select * into v_deck from public.daily_decks where id = v_deck.id for update;

  if not public.deck_revealed(v_deck.id) then raise exception 'not_revealed'; end if;
  if v_deck.round > 1 then raise exception 'swipe_again_used'; end if;

  select * into v_pick from public.reveal_pick(v_deck.id);
  if v_pick.kind = 'match' then raise exception 'already_matched'; end if;
  if v_pick.kind = 'none' or not exists (
    select 1 from public.couple_members m where m.couple_id = v_couple and not public.out_of_dishes(v_deck.id, m.user_id)
  ) then
    raise exception 'nothing_left';
  end if;

  update public.daily_decks
  set round = 2, first_reveal_ids = v_pick.ids, revealed_at = null, round_started_at = now()
  where id = v_deck.id;
  -- The new reveal plays its animation again.
  delete from public.reveal_views where deck_id = v_deck.id;

  -- Tell the partner, who may be away from the app. Only one round is possible, so there is at most one notice.
  select user_id into v_partner from public.couple_members where couple_id = v_couple and user_id <> v_user;
  if v_partner is not null then
    select display_name into v_name from public.profiles where id = v_user;
    insert into public.notices (recipient_id, kind, from_name) values (v_partner, 'swipe_again_started', v_name);
  end if;
end;
$$;
