-- Tell the person left behind why their couple changed when their partner deletes their account:
--   the owner leaves  -> the partner gets 'couple_ended' (the couple is gone, they can start or join another)
--   the partner leaves -> the owner gets 'partner_left' (they are back to waiting for a partner)
alter table public.notices add column from_name text;

alter table public.notices drop constraint notices_kind_check;
alter table public.notices add constraint notices_kind_check
  check (kind in ('match_goal_changed', 'couple_ended', 'partner_left'));

create or replace function public.delete_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_couple uuid;
  v_role text;
  v_partner uuid;
  v_name text;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select couple_id, role into v_couple, v_role from public.couple_members where user_id = v_user;
  if v_couple is not null then
    select user_id into v_partner from public.couple_members where couple_id = v_couple and user_id <> v_user;
    if v_partner is not null then
      select display_name into v_name from public.profiles where id = v_user;
      insert into public.notices (recipient_id, kind, from_name)
      values (v_partner, case when v_role = 'owner' then 'couple_ended' else 'partner_left' end, v_name);
    end if;
  end if;

  -- Cascades to members, invites, decks, swipes and reveal views.
  delete from public.couples where owner_id = v_user;

  delete from auth.users where id = v_user;
end;
$$;
