-- select paid_until, paid_event_at from couples;

-- update couples set paid_until = null, paid_event_at = null, trial_ends_at = now() - interval '1 day';
update profiles set trial_started_at = now() - interval '10 days' where id = (select id from auth.users where email = 'darenka@gmail.com');