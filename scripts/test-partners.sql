-- Test partners for the Google Play closed test.
--
-- Testers are strangers, so nobody has a partner to pair with. This makes 20 ready-made partner accounts: each one owns a
-- couple, has finished its food preferences (open to everything) and has an unused invite code valid for 60 days. A tester
-- signs in with their own email and enters one code on "Join your partner"; from then on the whole app works for them.
-- The partner never swipes, so the reveal (daily at 17:00 UTC) shows the dishes the tester liked ("One of you liked") or
-- our pick. The trial
-- starts when the tester joins, like for anyone. The partner owns the couple, so the tester is never the one who pays.
--
-- Run it in the SQL editor of the project the test build points at (Dashboard > SQL editor > paste > Run). It prints the
-- codes. Running it again adds nothing new and prints the codes nobody has used yet.
--
-- After the test, remove them (this ends the testers' couples too):
--   delete from auth.users where email like 'test-partner-%@swipefordinner.app';

do $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- the same as create_invite: no 0/O/1/I
  v_email text;
  v_user uuid;
  v_couple uuid;
  v_code text;
begin
  for i in 1..20 loop
    v_email := format('test-partner-%s@swipefordinner.app', lpad(i::text, 2, '0'));
    continue when exists (select 1 from auth.users where email = v_email);

    -- No password and no real mailbox: these accounts never sign in. The empty strings keep the dashboard's user list happy.
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', v_email, '', now(),
      '{"provider": "email", "providers": ["email"]}', '{"full_name": "Test partner"}', now(), now(), '', '', '', ''
    ) returning id into v_user;
    -- handle_new_user has made the profile, named "Test partner".

    insert into public.preferences (user_id) values (v_user);
    -- Scheduled, not the default instant reveal: instant waits for both to swipe, and this partner never does. The reveal
    -- opens at 17:00 UTC; the app shows that in the tester's own time, and either of them can move it in Settings.
    insert into public.couples (owner_id, timezone, reveal_mode) values (v_user, 'UTC', 'scheduled') returning id into v_couple;
    insert into public.couple_members (couple_id, user_id, role) values (v_couple, v_user, 'owner');

    loop
      v_code := '';
      for j in 1..6 loop
        v_code := v_code || substr(v_alphabet, (get_byte(extensions.gen_random_bytes(1), 0) % 32) + 1, 1);
      end loop;
      exit when not exists (select 1 from public.invites where code = v_code);
    end loop;
    insert into public.invites (code, couple_id, created_by, expires_at)
    values (v_code, v_couple, v_user, now() + interval '60 days');
  end loop;
end $$;

select u.email, i.code, i.expires_at::date as valid_until
from auth.users u
join public.invites i on i.created_by = u.id
where u.email like 'test-partner-%@swipefordinner.app' and i.used_at is null and i.expires_at > now()
order by u.email;
