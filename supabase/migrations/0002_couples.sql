-- Phase 3: couples, membership and partner invites.
-- All writes go through the security-definer functions below; tables expose
-- read-only access to the couple's own members via RLS.

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  timezone text not null default 'UTC',
  reveal_time time not null default '17:00',
  created_at timestamptz not null default now()
);

create table public.couple_members (
  couple_id uuid not null references public.couples (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'partner')),
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id),
  unique (user_id) -- a user belongs to at most one couple
);

create table public.invites (
  code text primary key,
  couple_id uuid not null references public.couples (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz
);

create index invites_couple_id_idx on public.invites (couple_id);

alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.invites enable row level security; -- no policies: RPC access only

-- Membership helpers. Security definer so policies can use them without recursing into RLS.
create function public.is_couple_member(p_couple_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.couple_members
    where couple_id = p_couple_id and user_id = auth.uid()
  );
$$;

create function public.shares_couple_with(p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.couple_members me
    join public.couple_members other on other.couple_id = me.couple_id
    where me.user_id = auth.uid() and other.user_id = p_user_id
  );
$$;

create policy "couples_select_member" on public.couples
  for select using (public.is_couple_member(id));

create policy "couple_members_select_member" on public.couple_members
  for select using (public.is_couple_member(couple_id));

-- Partners can see each other's profile (display name).
create policy "profiles_select_partner" on public.profiles
  for select using (public.shares_couple_with(id));

-- Current user's couple as one json blob, or null when they have none.
create function public.get_couple_state() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'couple_id', c.id,
    'role', me.role,
    'timezone', c.timezone,
    'reveal_time', to_char(c.reveal_time, 'HH24:MI'),
    'partner', (
      select jsonb_build_object('id', p.id, 'display_name', p.display_name)
      from public.couple_members pm
      join public.profiles p on p.id = pm.user_id
      where pm.couple_id = c.id and pm.user_id <> auth.uid()
    )
  )
  from public.couple_members me
  join public.couples c on c.id = me.couple_id
  where me.user_id = auth.uid();
$$;

create function public.create_couple(p_timezone text default 'UTC') returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_tz text;
  v_couple uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.couple_members where user_id = v_user) then
    raise exception 'already_in_couple';
  end if;

  select name into v_tz from pg_catalog.pg_timezone_names where name = p_timezone limit 1;

  insert into public.couples (owner_id, timezone)
  values (v_user, coalesce(v_tz, 'UTC'))
  returning id into v_couple;

  insert into public.couple_members (couple_id, user_id, role)
  values (v_couple, v_user, 'owner');

  return v_couple;
end;
$$;

-- Returns the owner's current invite code, minting a new one if none is valid.
create function public.create_invite() returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_couple uuid;
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I
  v_tries int := 0;
begin
  select couple_id into v_couple
  from public.couple_members where user_id = v_user and role = 'owner';
  if v_couple is null then raise exception 'not_couple_owner'; end if;

  if (select count(*) from public.couple_members where couple_id = v_couple) >= 2 then
    raise exception 'couple_full';
  end if;

  select code into v_code from public.invites
  where couple_id = v_couple and used_at is null and expires_at > now()
  order by expires_at desc limit 1;
  if v_code is not null then return v_code; end if;

  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, (get_byte(extensions.gen_random_bytes(1), 0) % 32) + 1, 1);
    end loop;
    begin
      insert into public.invites (code, couple_id, created_by, expires_at)
      values (v_code, v_couple, v_user, now() + interval '7 days');
      return v_code;
    exception when unique_violation then
      v_tries := v_tries + 1;
      if v_tries > 5 then raise; end if;
    end;
  end loop;
end;
$$;

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

  select * into v_invite from public.invites
  where code = upper(trim(p_code)) for update;

  if not found or v_invite.used_at is not null or v_invite.expires_at <= now() then
    raise exception 'invalid_code';
  end if;

  -- Serialize concurrent joins on the couple row, then enforce the 2-member cap.
  perform 1 from public.couples where id = v_invite.couple_id for update;
  if (select count(*) from public.couple_members where couple_id = v_invite.couple_id) >= 2 then
    raise exception 'couple_full';
  end if;

  insert into public.couple_members (couple_id, user_id, role)
  values (v_invite.couple_id, v_user, 'partner');

  update public.invites set used_by = v_user, used_at = now() where code = v_invite.code;

  return v_invite.couple_id;
end;
$$;

-- Owner changed their mind before a partner joined: delete the couple.
create function public.cancel_couple() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_couple uuid;
begin
  select couple_id into v_couple
  from public.couple_members where user_id = auth.uid() and role = 'owner';
  if v_couple is null then raise exception 'not_couple_owner'; end if;
  if (select count(*) from public.couple_members where couple_id = v_couple) > 1 then
    raise exception 'couple_full';
  end if;
  delete from public.couples where id = v_couple;
end;
$$;

revoke all on function
  public.is_couple_member(uuid), public.shares_couple_with(uuid), public.get_couple_state(),
  public.create_couple(text), public.create_invite(), public.join_couple(text), public.cancel_couple()
from public, anon;

grant execute on function
  public.is_couple_member(uuid), public.shares_couple_with(uuid), public.get_couple_state(),
  public.create_couple(text), public.create_invite(), public.join_couple(text), public.cancel_couple()
to authenticated;

-- Let the owner's screen react the moment the partner joins.
alter publication supabase_realtime add table public.couple_members;
