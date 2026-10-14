-- "Get a new code": the owner can cancel the current unused code (say it leaked) and get a fresh one.
-- Limited to 5 new codes per hour so it can't be used to churn through codes.
alter table public.invites add column created_at timestamptz not null default now();

create function public.regenerate_invite() returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_couple uuid;
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I
  v_tries int := 0;
begin
  select couple_id into v_couple from public.couple_members where user_id = v_user and role = 'owner';
  if v_couple is null then raise exception 'not_couple_owner'; end if;

  if (select count(*) from public.couple_members where couple_id = v_couple) >= 2 then
    raise exception 'couple_full';
  end if;

  if (select count(*) from public.invites
      where couple_id = v_couple and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'too_many_invites';
  end if;

  update public.invites set expires_at = now() where couple_id = v_couple and used_at is null and expires_at > now();

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

revoke all on function public.regenerate_invite() from public, anon;
grant execute on function public.regenerate_invite() to authenticated;
