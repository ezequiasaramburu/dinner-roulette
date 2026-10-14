-- Let the app hear about reveals and setting changes as they happen (an instant reveal opens when the goal is
-- reached; the partner's open app should notice without polling). Row-level security still decides who receives what.
alter publication supabase_realtime add table public.daily_decks, public.couples;
