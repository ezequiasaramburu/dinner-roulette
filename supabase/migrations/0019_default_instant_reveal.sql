-- New couples reveal as soon as they match. With a set time, a couple that signs up after that time has swiping closed
-- until midnight and gets a "surprise" dish without ever swiping. Couples can still choose a set time in Settings;
-- existing couples keep what they have.
alter table public.couples alter column reveal_mode set default 'instant';
