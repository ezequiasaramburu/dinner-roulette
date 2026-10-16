-- The free trial starts when your partner joins, not when the couple is created.
--
-- Until then `trial_ends_at` is empty and nothing is locked (nobody can swipe without a partner anyway). joining stamps
-- it with 7 days from that moment; a partner who joins later does not restart it. Couples that exist but are still
-- waiting for a partner get their clock reset. The couple state also says how many trial days are left, for Home.

alter table public.couples alter column trial_ends_at drop not null;
alter table public.couples alter column trial_ends_at drop default;

update public.couples c set trial_ends_at = null
where c.paid_until is null and (select count(*) from public.couple_members m where m.couple_id = c.id) < 2;

create or replace function public.couple_has_access(p_couple uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(c.trial_ends_at is null or now() < c.trial_ends_at or now() < c.paid_until, false)
  from public.couples c where c.id = p_couple;
$$;

create or replace function public.join_couple(p_code text) returns uuid
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

  -- The free trial starts when the pair is complete, not when the first person signed up. A later partner (after one
  -- left) does not restart it.
  update public.couples set trial_ends_at = coalesce(trial_ends_at, now() + interval '7 days') where id = v_invite.couple_id;

  -- Pairing up is deliberate: a block between the two of them (made before they met) no longer applies.
  delete from public.author_blocks
  where blocker_id in (select user_id from public.couple_members where couple_id = v_invite.couple_id)
    and blocked_id in (select user_id from public.couple_members where couple_id = v_invite.couple_id);
  delete from public.join_attempts where user_id = v_user;

  return v_invite.couple_id;
end;
$$;

create or replace function public.get_couple_state() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'couple_id', c.id,
    'role', me.role,
    'timezone', c.timezone,
    'reveal_time', to_char(c.reveal_time, 'HH24:MI'),
    'reveal_mode', c.reveal_mode,
    'match_goal', c.match_goal,
    'has_access', public.couple_has_access(c.id),
    'trial_ends_at', c.trial_ends_at,
    -- Whole days left in the free trial, only while it is the thing giving access (not once a subscription is paid).
    'trial_days_left', case
      when c.trial_ends_at is null or now() >= c.trial_ends_at or now() < c.paid_until then null
      else ceil(extract(epoch from c.trial_ends_at - now()) / 86400)::int
    end,
    'me_ready', exists (select 1 from public.preferences where user_id = auth.uid()),
    'partner', (
      select jsonb_build_object(
        'id', p.id,
        'display_name', p.display_name,
        'ready', exists (select 1 from public.preferences where user_id = p.id)
      )
      from public.couple_members pm
      join public.profiles p on p.id = pm.user_id
      where pm.couple_id = c.id and pm.user_id <> auth.uid()
    )
  )
  from public.couple_members me
  join public.couples c on c.id = me.couple_id
  where me.user_id = auth.uid();
$$;
