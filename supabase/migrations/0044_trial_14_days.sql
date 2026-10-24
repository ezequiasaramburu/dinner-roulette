-- The free trial is 14 days instead of 7 (decided 2026-10-24: the Google Play closed test runs 14 days, and an app used
-- now and then needs more than a week to show what it does).
--
-- join_couple is the only place the length lives: the trial ends 14 days after the earliest trial start of the two people
-- (profiles.trial_started_at, see 0039). Couples that already have a trial get the extra week too, counted from the same
-- start, so a trial that ended less than a week ago opens again for what is left.

update public.couples set trial_ends_at = trial_ends_at + interval '7 days' where trial_ends_at is not null;

CREATE OR REPLACE FUNCTION public.join_couple(p_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  -- The free trial is remembered per person. It starts when the pair is complete and ends 14 days after the earliest trial
  -- start of the two of them, so a new couple with someone who already had a trial carries over what is left (possibly
  -- nothing). A partner who joins a couple whose trial is already running does not restart it.
  update public.couples c
  set trial_ends_at = coalesce(c.trial_ends_at, (
    select coalesce(min(p.trial_started_at), now())
    from public.profiles p
    where p.id in (select m.user_id from public.couple_members m where m.couple_id = c.id)
  ) + interval '14 days')
  where c.id = v_invite.couple_id;

  update public.profiles p
  set trial_started_at = coalesce(p.trial_started_at, (
    select c.trial_ends_at - interval '14 days' from public.couples c where c.id = v_invite.couple_id
  ))
  where p.id in (select m.user_id from public.couple_members m where m.couple_id = v_invite.couple_id);

  -- Pairing up is deliberate: a block between the two of them (made before they met) no longer applies.
  delete from public.author_blocks
  where blocker_id in (select user_id from public.couple_members where couple_id = v_invite.couple_id)
    and blocked_id in (select user_id from public.couple_members where couple_id = v_invite.couple_id);
  delete from public.join_attempts where user_id = v_user;

  return v_invite.couple_id;
end;
$function$;
