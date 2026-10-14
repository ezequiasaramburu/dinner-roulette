-- Launch blockers: guessing invite codes is rate limited, and people can delete their own account.

-- Failed attempts to join with a code. A failed attempt can't be recorded by raising an error (the insert would roll
-- back with it), so join_couple now returns null for a wrong code and the app turns that into "invalid code".
create table public.join_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index join_attempts_user_idx on public.join_attempts (user_id, attempted_at);

alter table public.join_attempts enable row level security; -- no policies: only join_couple touches it

drop function public.join_couple(text);

create function public.join_couple(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_invite public.invites;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.couple_members where user_id = v_user) then
    raise exception 'already_in_couple';
  end if;

  -- 5 wrong codes in 15 minutes locks joining for a while. A 6-character code can't be brute-forced at that pace.
  if (select count(*) from public.join_attempts
      where user_id = v_user and attempted_at > now() - interval '15 minutes') >= 5 then
    raise exception 'too_many_attempts';
  end if;

  select * into v_invite from public.invites
  where code = upper(trim(p_code)) for update;

  if not found or v_invite.used_at is not null or v_invite.expires_at <= now() then
    delete from public.join_attempts where attempted_at < now() - interval '1 day';
    insert into public.join_attempts (user_id) values (v_user);
    return null;
  end if;

  -- Serialize concurrent joins on the couple row, then enforce the 2-member cap.
  perform 1 from public.couples where id = v_invite.couple_id for update;
  if (select count(*) from public.couple_members where couple_id = v_invite.couple_id) >= 2 then
    raise exception 'couple_full';
  end if;

  insert into public.couple_members (couple_id, user_id, role)
  values (v_invite.couple_id, v_user, 'partner');

  update public.invites set used_by = v_user, used_at = now() where code = v_invite.code;
  delete from public.join_attempts where user_id = v_user;

  return v_invite.couple_id;
end;
$$;

revoke all on function public.join_couple(text) from public, anon;
grant execute on function public.join_couple(text) to authenticated;

-- Deletes the caller's account and everything of theirs: profile, preferences, swipes, notices, invites.
-- If a partner is left behind they keep the couple (and its settings), become its owner and can invite someone new.
create function public.delete_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_couple uuid;
  v_role text;
  v_partner uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select couple_id, role into v_couple, v_role from public.couple_members where user_id = v_user;

  if v_couple is not null then
    select user_id into v_partner from public.couple_members where couple_id = v_couple and user_id <> v_user;

    if v_partner is not null and v_role = 'owner' then
      update public.couples set owner_id = v_partner where id = v_couple;
      update public.couple_members set role = 'owner' where couple_id = v_couple and user_id = v_partner;
    end if;
  end if;

  delete from auth.users where id = v_user;
end;
$$;

revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
