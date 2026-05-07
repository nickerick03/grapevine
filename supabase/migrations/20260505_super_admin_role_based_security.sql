-- Convert super-admin authorization to role-based security.
-- Removes email-based admin checks and hardens role escalation rules.

do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end;
$$;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('user', 'admin', 'super_admin'));

create unique index if not exists idx_profiles_single_super_admin
  on public.profiles (role)
  where role = 'super_admin';

-- One-time assignment for the requested account.
do $$
begin
  if exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.profiles'::regclass
      and tgname = 'prevent_profile_role_escalation_trigger'
  ) then
    execute 'alter table public.profiles disable trigger prevent_profile_role_escalation_trigger';
  end if;
end;
$$;

update public.profiles p
set role = 'super_admin'
from auth.users u
where u.id = p.id
  and lower(u.email) = 'dominik.e.karloczy@gmail.com';

do $$
begin
  if exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.profiles'::regclass
      and tgname = 'prevent_profile_role_escalation_trigger'
  ) then
    execute 'alter table public.profiles enable trigger prevent_profile_role_escalation_trigger';
  end if;
end;
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'super_admin'
  );
$$;

create or replace function public.assert_super_admin()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Super admin access required';
  end if;
end;
$$;

revoke execute on function public.is_super_admin() from public;
grant execute on function public.is_super_admin() to anon, authenticated;
revoke execute on function public.assert_super_admin() from public;
grant execute on function public.assert_super_admin() to authenticated;

-- New users always start as plain user.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url, role)
  values (
    new.id,
    null,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    'user'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role then
    if auth.uid() = old.id then
      raise exception 'Users cannot change their own role';
    end if;

    if not public.is_super_admin() then
      raise exception 'Only the super admin can change roles';
    end if;
  end if;

  return new;
end;
$$;

drop policy if exists "places_admin_insert" on public.places;
create policy "places_admin_insert"
on public.places
for insert
to authenticated
with check (public.is_super_admin());

drop policy if exists "places_admin_update" on public.places;
create policy "places_admin_update"
on public.places
for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "places_admin_delete" on public.places;
create policy "places_admin_delete"
on public.places
for delete
to authenticated
using (public.is_super_admin());

drop policy if exists "place_ratings_select_all" on public.place_ratings;
drop policy if exists "place_ratings_select_active_or_admin" on public.place_ratings;
drop policy if exists "place_ratings_select_active_or_super_admin" on public.place_ratings;
create policy "place_ratings_select_active_or_super_admin"
on public.place_ratings
for select
to anon, authenticated
using (
  (
    place_ratings.rating_status = 'active'
    and exists (
      select 1
      from public.profiles owner_profile
      where owner_profile.id = place_ratings.user_id
        and coalesce(owner_profile.is_frozen, false) = false
    )
  )
  or public.is_super_admin()
);

create or replace function public.admin_set_user_frozen(
  p_user_id uuid,
  p_is_frozen boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_profile public.profiles;
begin
  perform public.assert_super_admin();

  if exists (
    select 1
    from public.profiles target_profile
    where target_profile.id = p_user_id
      and target_profile.role = 'super_admin'
  ) then
    raise exception 'Super-admin account cannot be frozen';
  end if;

  update public.profiles
  set
    is_frozen = p_is_frozen,
    updated_at = now()
  where id = p_user_id
  returning * into updated_profile;

  if not found then
    raise exception 'Profile not found';
  end if;

  return updated_profile;
end;
$$;

drop table if exists public.app_admin_config;
