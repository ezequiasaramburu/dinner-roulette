-- Free trials are remembered per person, and account deletions leave an anonymous trace.
--
-- profiles.trial_started_at (server-only, not readable by the app) is set when someone's first couple trial starts. A new
-- couple's trial ends 7 days after the earliest start among its two people, so deleting a couple and pairing up again does
-- not give a fresh week (what is left carries over, which can be nothing). To get one, both people would need to be brand
-- new accounts. Existing trials are backfilled from the couples that have one.
--
-- account_deletions keeps one anonymous row per deleted account: when, whether they were in a couple or its owner, how
-- many days into their trial, and whether the couple had ever paid. No id, email or name. The admin dashboard reads it
-- to see whether the delete-and-sign-up-again pattern is common (see docs/trial-abuse.md).

alter table public.profiles add column trial_started_at timestamptz;

update public.profiles p
set trial_started_at = c.trial_ends_at - interval '7 days'
from public.couple_members m join public.couples c on c.id = m.couple_id
where m.user_id = p.id and c.trial_ends_at is not null;

create table public.account_deletions (
  id bigint generated always as identity primary key,
  deleted_at timestamptz not null default now(),
  was_owner boolean not null,
  had_couple boolean not null,
  trial_day int,
  had_paid boolean not null
);
alter table public.account_deletions enable row level security;
revoke all on public.account_deletions from anon, authenticated;

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

  -- The free trial is remembered per person. It starts when the pair is complete and ends 7 days after the earliest trial
  -- start of the two of them, so a new couple with someone who already had a trial carries over what is left (possibly
  -- nothing). A partner who joins a couple whose trial is already running does not restart it.
  update public.couples c
  set trial_ends_at = coalesce(c.trial_ends_at, (
    select coalesce(min(p.trial_started_at), now())
    from public.profiles p
    where p.id in (select m.user_id from public.couple_members m where m.couple_id = c.id)
  ) + interval '7 days')
  where c.id = v_invite.couple_id;

  update public.profiles p
  set trial_started_at = coalesce(p.trial_started_at, (
    select c.trial_ends_at - interval '7 days' from public.couples c where c.id = v_invite.couple_id
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

CREATE OR REPLACE FUNCTION public.delete_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  -- An anonymous record, so abuse of the free trial (delete, sign up again, repeat) can be seen later without keeping
  -- anything about the person: no id, no email, no name.
  insert into public.account_deletions (was_owner, had_couple, trial_day, had_paid)
  select coalesce(v_role = 'owner', false), v_couple is not null,
         extract(day from now() - p.trial_started_at)::int,
         coalesce((select c.paid_until is not null from public.couples c where c.id = v_couple), false)
  from public.profiles p where p.id = v_user;

  -- Cascades to members, invites, decks, swipes and reveal views.
  delete from public.couples where owner_id = v_user;

  delete from auth.users where id = v_user;
end;
$function$;
