-- Sharing recipes is for subscribers.
--
-- submit_recipe refuses with 'recipes_need_subscription' unless the author's couple has a paid period running
-- (couples.paid_until in the future). A couple that is only on the free trial, whose plan ended, or no couple at all cannot
-- share. The rule is the couple's, so both partners can share while either one pays. Recipes already shared are untouched.
--
-- get_couple_state now also returns is_subscribed (a paid period is running) so the app can explain this before the
-- person fills in the form.

create or replace function public.submit_recipe(
  p_title text,
  p_country text,
  p_ingredients jsonb,
  p_steps jsonb,
  p_image_url text default null,
  p_accept_terms boolean default false
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_title text := trim(coalesce(p_title, ''));
  v_ingredients jsonb;
  v_steps jsonb;
  v_accepted timestamptz;
  v_id uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  -- Sharing a recipe is for subscribers: the couple has a paid period running. The free trial does not count, and neither
  -- does a plan that ended. Someone with no couple has no plan.
  if not exists (
    select 1 from public.couple_members m join public.couples c on c.id = m.couple_id
    where m.user_id = v_user and now() < c.paid_until
  ) then
    raise exception 'recipes_need_subscription';
  end if;

  if char_length(v_title) not between 3 and 80 then raise exception 'invalid_title'; end if;
  if not exists (select 1 from public.countries where name = p_country) then raise exception 'invalid_country'; end if;

  if jsonb_typeof(p_ingredients) is distinct from 'array' or jsonb_array_length(p_ingredients) not between 3 and 30 then
    raise exception 'invalid_ingredients';
  end if;
  select jsonb_agg(jsonb_build_object('name', trim(i ->> 'name'), 'measure', trim(coalesce(i ->> 'measure', ''))) order by ord)
  into v_ingredients
  from jsonb_array_elements(p_ingredients) with ordinality as t(i, ord);
  if exists (
    select 1 from jsonb_array_elements(v_ingredients) i
    where char_length(i ->> 'name') not between 1 and 60 or char_length(i ->> 'measure') > 40
  ) then
    raise exception 'invalid_ingredients';
  end if;

  if jsonb_typeof(p_steps) is distinct from 'array' or jsonb_array_length(p_steps) not between 1 and 25 then
    raise exception 'invalid_steps';
  end if;
  select jsonb_agg(trim(s) order by ord) into v_steps from jsonb_array_elements_text(p_steps) with ordinality as t(s, ord);
  if exists (select 1 from jsonb_array_elements_text(v_steps) s where char_length(s) not between 3 and 600) then
    raise exception 'invalid_steps';
  end if;

  -- No links or adverts, in any text field.
  if v_title || ' ' || v_ingredients::text || ' ' || v_steps::text ~* '(https?:|www\.)' then
    raise exception 'links_not_allowed';
  end if;

  if p_image_url is not null
     and p_image_url !~ ('^https?://[^/]+/storage/v1/object/public/recipe-photos/' || v_user::text || '/[A-Za-z0-9_.-]+$') then
    raise exception 'invalid_image';
  end if;

  select terms_accepted_at into v_accepted from public.profiles where id = v_user;
  if v_accepted is null then
    if not coalesce(p_accept_terms, false) then raise exception 'terms_required'; end if;
    update public.profiles set terms_accepted_at = now() where id = v_user;
  end if;

  if (select count(*) from public.recipes where author_id = v_user and submitted_at > now() - interval '24 hours') >= 5 then
    raise exception 'too_many_recipes';
  end if;
  if (select count(*) from public.recipes where author_id = v_user and status = 'pending') >= 10 then
    raise exception 'too_many_pending';
  end if;

  -- category, dish_type, ingredient_names, allergens, diet_flags and swaps are filled in by the recipes_derive trigger.
  insert into public.recipes (
    author_id, status, submitted_at, title, country, image_url, ingredients, steps, category, ingredient_names
  ) values (
    v_user, 'pending', now(), v_title, p_country, p_image_url, v_ingredients, v_steps, 'Vegetarian', '{}'
  ) returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.get_couple_state() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'couple_id', c.id,
    'role', me.role,
    'timezone', c.timezone,
    'reveal_time', to_char(c.reveal_time, 'HH24:MI'),
    'reveal_mode', c.reveal_mode,
    'match_goal', c.match_goal,
    'has_access', public.couple_has_access(c.id),
    -- A paid period is running (not just the free trial): the app only lets subscribers share recipes.
    'is_subscribed', coalesce(now() < c.paid_until, false),
    'trial_ends_at', c.trial_ends_at,
    -- Whole days left in the free trial, only while it is the thing giving access (not once a subscription is paid).
    'trial_days_left', case
      when c.trial_ends_at is null or now() >= c.trial_ends_at or now() < c.paid_until then null
      else ceil(extract(epoch from c.trial_ends_at - now()) / 86400)::int
    end,
    'me_ready', exists (select 1 from public.preferences where user_id = auth.uid()),
    'partner', (
      select jsonb_build_object(
        'id', p.id,
        'display_name', p.display_name,
        'ready', exists (select 1 from public.preferences where user_id = p.id)
      )
      from public.couple_members pm
      join public.profiles p on p.id = pm.user_id
      where pm.couple_id = c.id and pm.user_id <> auth.uid()
    )
  )
  from public.couple_members me
  join public.couples c on c.id = me.couple_id
  where me.user_id = auth.uid();
$$;
