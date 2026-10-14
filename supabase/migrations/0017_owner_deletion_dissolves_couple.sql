-- When the person who created (and will pay for) the couple deletes their account, the couple is dissolved instead of
-- being handed to the partner. The partner keeps their own account and food preferences, and can start their own
-- couple or join another with a code. If the partner is the one leaving, the owner keeps the couple as before.
create or replace function public.delete_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  -- Cascades to members, invites, decks, swipes and reveal views.
  delete from public.couples where owner_id = v_user;

  delete from auth.users where id = v_user;
end;
$$;
