-- The App Store / Google Play reviewer account, ready to look at everything.
--
-- 1. Create the user first: Dashboard > Authentication > Users > Add user > Create new user, email
--    review@swipefordinner.app, a long random password(AppR3v1ew3rp4$$), "Auto Confirm User" ticked. (The app asks that address for a
--    password instead of sending a code.)
-- 2. Run this in the SQL editor. It names the reviewer "Alex", finishes their food preferences, pairs them with a
--    partner account named "Sam" that never swipes, gives the couple a paid year (so sharing a recipe works too), and adds
--    five past dinners for the Dinners tab. The reveal time is 23:59 UTC: in the scheduled mode swiping closes at the
--    reveal until the next day, so a late reveal keeps the queue open nearly all day, and the Dinners tab shows what a
--    reveal looks like.
-- 3. Put the email and password in Play Console > App content > App access (and in App Store Connect later).
--
-- Running it again changes nothing. To start over: delete from auth.users where email = 'review-partner@swipefordinner.app';
-- (that ends the couple and its history), then run it again.

do $$
declare
  v_user uuid;
  v_bot uuid;
  v_couple uuid;
  v_deck uuid;
  v_ids uuid[];
  v_today date := (now() at time zone 'UTC')::date;
begin
  select id into v_user from auth.users where email = 'review@swipefordinner.app';
  if v_user is null then
    raise exception 'Create review@swipefordinner.app first: Authentication > Users > Add user';
  end if;
  if exists (select 1 from public.couple_members where user_id = v_user) then
    raise notice 'The reviewer is already in a couple; nothing to do.';
    return;
  end if;

  update public.profiles set display_name = 'Alex' where id = v_user;
  insert into public.preferences (user_id) values (v_user) on conflict (user_id) do nothing;

  -- The partner: never signs in (no password, no mailbox), like the closed-test partners.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    'review-partner@swipefordinner.app', '', now(), '{"provider": "email", "providers": ["email"]}',
    '{"full_name": "Sam"}', now(), now(), '', '', '', ''
  ) returning id into v_bot;
  insert into public.preferences (user_id) values (v_bot);

  -- The reviewer owns the couple (the payer). Paid for a year, trial already over, scheduled reveal late in the UTC day.
  insert into public.couples (owner_id, timezone, reveal_mode, reveal_time, trial_ends_at, paid_until)
  values (v_user, 'UTC', 'scheduled', '23:59', now(), now() + interval '1 year')
  returning id into v_couple;
  insert into public.couple_members (couple_id, user_id, role) values (v_couple, v_user, 'owner'), (v_couple, v_bot, 'partner');
  update public.profiles set trial_started_at = now() - interval '14 days' where id in (v_user, v_bot);

  -- Five past dinners: eight catalogue dishes a day, the first one liked by both (a match).
  for d in 1..5 loop
    select array_agg(id) into v_ids from (
      select r.id from public.recipes r
      where r.author_id is null and r.status = 'approved'
        and not exists (select 1 from public.daily_decks dd where dd.couple_id = v_couple and r.id = any (dd.recipe_ids))
      order by random() limit 8
    ) picked;
    insert into public.daily_decks (couple_id, deck_date, recipe_ids, pool_size, repeat_count, revealed_at)
    values (v_couple, v_today - d, v_ids, 8, 0, (v_today - d) + time '23:59')
    returning id into v_deck;
    insert into public.swipes (deck_id, user_id, recipe_id, liked, swiped_at)
    values (v_deck, v_user, v_ids[1], true, (v_today - d - 1) + time '20:00'),
           (v_deck, v_bot, v_ids[1], true, (v_today - d - 1) + time '20:00'),
           (v_deck, v_user, v_ids[2], false, (v_today - d - 1) + time '20:01');
  end loop;
end $$;

select p.display_name as reviewer, c.reveal_time, c.paid_until::date,
       (select count(*) from public.daily_decks d where d.couple_id = c.id) as past_dinners
from auth.users u
join public.profiles p on p.id = u.id
join public.couple_members m on m.user_id = u.id
join public.couples c on c.id = m.couple_id
where u.email = 'review@swipefordinner.app';
