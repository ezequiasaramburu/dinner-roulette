-- In-app notices: short messages one partner's action leaves for the other ("Daryna changed matches per day").
-- Only the recipient can read them; they are created by update_couple_settings and removed by dismissing.

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('match_goal_changed')),
  from_value int,
  to_value int,
  created_at timestamptz not null default now()
);

create index notices_recipient_idx on public.notices (recipient_id);

alter table public.notices enable row level security;

create policy "notices_select_own" on public.notices
  for select using (auth.uid() = recipient_id);

alter publication supabase_realtime add table public.notices;

create function public.dismiss_notice(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  delete from public.notices where id = p_id and recipient_id = auth.uid();
end;
$$;

revoke all on function public.dismiss_notice(uuid) from public, anon;
grant execute on function public.dismiss_notice(uuid) to authenticated;

-- Changing the match goal now tells the partner. Several changes before they look collapse into one notice from the
-- original value to the latest, and changing it back leaves no notice at all.
create or replace function public.update_couple_settings(
  p_match_goal int default null,
  p_reveal_mode text default null,
  p_reveal_time time default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_couple uuid;
  v_partner uuid;
  v_old int;
  v_from int;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_match_goal is not null and p_match_goal not between 1 and 5 then raise exception 'invalid_match_goal'; end if;
  if p_reveal_mode is not null and p_reveal_mode not in ('scheduled', 'instant') then raise exception 'invalid_reveal_mode'; end if;

  select m.couple_id, c.match_goal into v_couple, v_old
  from public.couple_members m join public.couples c on c.id = m.couple_id
  where m.user_id = v_user;
  if v_couple is null then raise exception 'couple_not_ready'; end if;

  update public.couples set
    match_goal = coalesce(p_match_goal, match_goal),
    reveal_mode = coalesce(p_reveal_mode, reveal_mode),
    reveal_time = coalesce(p_reveal_time, reveal_time)
  where id = v_couple;

  if p_match_goal is not null and p_match_goal <> v_old then
    -- Acting on the goal means I have seen what my partner did to it.
    delete from public.notices where recipient_id = v_user and kind = 'match_goal_changed';

    select user_id into v_partner from public.couple_members where couple_id = v_couple and user_id <> v_user;
    if v_partner is not null then
      v_from := v_old;
      delete from public.notices
      where recipient_id = v_partner and kind = 'match_goal_changed'
      returning from_value into v_from;
      v_from := coalesce(v_from, v_old);

      if v_from <> p_match_goal then
        insert into public.notices (recipient_id, kind, from_value, to_value)
        values (v_partner, 'match_goal_changed', v_from, p_match_goal);
      end if;
    end if;
  end if;
end;
$$;
