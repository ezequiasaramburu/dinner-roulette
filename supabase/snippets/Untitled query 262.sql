select paid_until, paid_event_at from couples;

-- update couples set paid_until = null, paid_event_at = null, trial_ends_at = now() - interval '1 day';