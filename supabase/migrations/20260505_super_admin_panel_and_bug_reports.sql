-- Super admin lock + admin panel backend + bug reports
-- This migration enforces one super-admin identity and adds moderation/reporting APIs.

alter table public.profiles
  add column if not exists is_frozen boolean not null default false;

alter table public.place_ratings
  add column if not exists rating_status text not null default 'active',
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid references public.profiles(id),
  add column if not exists revocation_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.place_ratings'::regclass
      and conname = 'place_ratings_rating_status_check'
  ) then
    execute $stmt$
      alter table public.place_ratings
      add constraint place_ratings_rating_status_check
      check (rating_status in ('active', 'revoked'))
    $stmt$;
  end if;
end;
$$;

create table if not exists public.place_rating_note_votes (
  rating_id uuid not null references public.place_ratings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (rating_id, user_id)
);

create table if not exists public.place_rating_note_flags (
  id uuid primary key default gen_random_uuid(),
  rating_id uuid not null references public.place_ratings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (rating_id, user_id)
);

create table if not exists public.app_admin_config (
  singleton_key boolean primary key default true check (singleton_key = true),
  super_admin_email text not null
);

insert into public.app_admin_config (singleton_key, super_admin_email)
values (true, 'dominik.e.karloczy@gmail.com')
on conflict (singleton_key) do update
set super_admin_email = excluded.super_admin_email;

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
set role = 'admin'
from auth.users u
where u.id = p.id
  and lower(u.email) = (
    select lower(cfg.super_admin_email)
    from public.app_admin_config cfg
    where cfg.singleton_key = true
    limit 1
  );

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
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_email text;
begin
  select lower(u.email)
  into actor_email
  from auth.users u
  where u.id = auth.uid();

  if actor_email is null then
    return false;
  end if;

  return exists (
    select 1
    from public.app_admin_config cfg
    where cfg.singleton_key = true
      and lower(cfg.super_admin_email) = actor_email
  );
end;
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

-- Auto-promote configured super-admin account on signup.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_role text := 'user';
begin
  if exists (
    select 1
    from public.app_admin_config cfg
    where cfg.singleton_key = true
      and lower(cfg.super_admin_email) = lower(coalesce(new.email, ''))
  ) then
    next_role := 'admin';
  end if;

  insert into public.profiles (id, username, display_name, avatar_url, role)
  values (
    new.id,
    null,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    next_role
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

create or replace function public.prevent_place_rating_moderation_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    new.rating_status is distinct from old.rating_status
    or new.revoked_at is distinct from old.revoked_at
    or new.revoked_by is distinct from old.revoked_by
    or new.revocation_reason is distinct from old.revocation_reason
  ) then
    if not public.is_super_admin() then
      raise exception 'Only the super admin can modify moderation fields';
    end if;
  end if;

  if new.rating_status = 'active' then
    new.revoked_at = null;
    new.revoked_by = null;
    new.revocation_reason = null;
  end if;

  return new;
end;
$$;

create or replace function public.admin_revoke_place_rating(
  p_rating_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_super_admin();

  update public.place_ratings
  set
    rating_status = 'revoked',
    revoked_at = now(),
    revoked_by = auth.uid(),
    revocation_reason = nullif(trim(p_reason), ''),
    updated_at = now()
  where id = p_rating_id;

  if not found then
    raise exception 'Rating not found';
  end if;
end;
$$;

create or replace function public.admin_restore_place_rating(
  p_rating_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_super_admin();

  update public.place_ratings
  set
    rating_status = 'active',
    revoked_at = null,
    revoked_by = null,
    revocation_reason = null,
    updated_at = now()
  where id = p_rating_id;

  if not found then
    raise exception 'Rating not found';
  end if;
end;
$$;

create or replace function public.admin_delete_place_rating(
  p_rating_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_super_admin();

  delete from public.place_ratings where id = p_rating_id;
  if not found then
    raise exception 'Rating not found';
  end if;
end;
$$;

create or replace function public.admin_delete_rating_note(
  p_rating_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_super_admin();

  delete from public.place_rating_note_votes where rating_id = p_rating_id;
  delete from public.place_rating_note_flags where rating_id = p_rating_id;

  update public.place_ratings
  set
    note = null,
    updated_at = now()
  where id = p_rating_id;

  if not found then
    raise exception 'Rating not found';
  end if;
end;
$$;

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

revoke execute on function public.admin_revoke_place_rating(uuid, text) from public;
grant execute on function public.admin_revoke_place_rating(uuid, text) to authenticated;
revoke execute on function public.admin_restore_place_rating(uuid) from public;
grant execute on function public.admin_restore_place_rating(uuid) to authenticated;
revoke execute on function public.admin_delete_place_rating(uuid) from public;
grant execute on function public.admin_delete_place_rating(uuid) to authenticated;
revoke execute on function public.admin_delete_rating_note(uuid) from public;
grant execute on function public.admin_delete_rating_note(uuid) to authenticated;
revoke execute on function public.admin_set_user_frozen(uuid, boolean) from public;
grant execute on function public.admin_set_user_frozen(uuid, boolean) to authenticated;

-- Bug reports
create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 3 and 160),
  description text not null check (char_length(trim(description)) between 10 and 4000),
  page_route text,
  screenshot_url text,
  status text not null default 'open' check (status in ('open', 'triaged', 'in_progress', 'resolved', 'dismissed')),
  admin_note text,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bug_reports_status_created_at
  on public.bug_reports (status, created_at desc);

create index if not exists idx_bug_reports_reporter_id
  on public.bug_reports (reporter_id);

alter table public.bug_reports enable row level security;

drop trigger if exists set_bug_reports_updated_at on public.bug_reports;
create trigger set_bug_reports_updated_at
before update on public.bug_reports
for each row
execute function public.set_updated_at();

drop policy if exists "bug_reports_insert_own" on public.bug_reports;
create policy "bug_reports_insert_own"
on public.bug_reports
for insert
to authenticated
with check (auth.uid() = reporter_id);

drop policy if exists "bug_reports_select_own" on public.bug_reports;
create policy "bug_reports_select_own"
on public.bug_reports
for select
to authenticated
using (auth.uid() = reporter_id);

drop policy if exists "bug_reports_admin_select_all" on public.bug_reports;
create policy "bug_reports_admin_select_all"
on public.bug_reports
for select
to authenticated
using (public.is_super_admin());

drop policy if exists "bug_reports_admin_update_all" on public.bug_reports;
create policy "bug_reports_admin_update_all"
on public.bug_reports
for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "bug_reports_admin_delete_all" on public.bug_reports;
create policy "bug_reports_admin_delete_all"
on public.bug_reports
for delete
to authenticated
using (public.is_super_admin());

create or replace function public.get_admin_dashboard_totals()
returns table (
  total_places bigint,
  rated_venues bigint,
  active_ratings bigint,
  revoked_ratings bigint,
  notes_count bigint,
  users_total bigint,
  users_frozen bigint,
  bug_reports_open bigint,
  bug_reports_total bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_super_admin();

  return query
  select
    (select count(*) from public.places),
    (select count(distinct pr.place_id) from public.place_ratings pr),
    (select count(*) from public.place_ratings pr where pr.rating_status = 'active'),
    (select count(*) from public.place_ratings pr where pr.rating_status = 'revoked'),
    (select count(*) from public.place_ratings pr where nullif(trim(pr.note), '') is not null),
    (select count(*) from public.profiles),
    (select count(*) from public.profiles p where coalesce(p.is_frozen, false) = true),
    (select count(*) from public.bug_reports br where br.status in ('open', 'triaged', 'in_progress')),
    (select count(*) from public.bug_reports);
end;
$$;

create or replace function public.get_admin_rated_venues(
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  place_id uuid,
  place_name text,
  city text,
  country text,
  address text,
  venue_type text,
  rating_count bigint,
  active_rating_count bigint,
  note_count bigint,
  last_rating_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_super_admin();

  return query
  select
    p.id as place_id,
    p.name as place_name,
    p.city,
    p.country,
    p.address,
    p.venue_type,
    count(pr.id) as rating_count,
    count(*) filter (where pr.rating_status = 'active') as active_rating_count,
    count(*) filter (where nullif(trim(pr.note), '') is not null) as note_count,
    max(pr.updated_at) as last_rating_at
  from public.places p
  join public.place_ratings pr on pr.place_id = p.id
  group by p.id, p.name, p.city, p.country, p.address, p.venue_type
  order by max(pr.updated_at) desc nulls last
  limit greatest(1, least(coalesce(p_limit, 100), 500))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

create or replace function public.get_admin_place_activity(
  p_place_id uuid,
  p_limit integer default 200
)
returns table (
  rating_id uuid,
  place_id uuid,
  place_name text,
  user_id uuid,
  username text,
  user_email text,
  rating_status text,
  revocation_reason text,
  created_at timestamptz,
  updated_at timestamptz,
  note text,
  visit_context text,
  price_range smallint,
  classic_modern integer,
  quiet_lively integer,
  cheap_premium integer,
  local_touristy integer,
  cozy_spacious integer,
  upvotes bigint,
  downvotes bigint,
  flag_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_super_admin();

  return query
  select
    pr.id as rating_id,
    pl.id as place_id,
    pl.name as place_name,
    pr.user_id,
    coalesce(nullif(pf.username, ''), split_part(coalesce(au.email, ''), '@', 1), 'user') as username,
    au.email as user_email,
    pr.rating_status,
    pr.revocation_reason,
    pr.created_at,
    pr.updated_at,
    pr.note,
    pr.visit_context,
    pr.price_range,
    pr.classic_modern,
    pr.quiet_lively,
    pr.cheap_premium,
    pr.local_touristy,
    pr.cozy_spacious,
    coalesce(v.upvotes, 0) as upvotes,
    coalesce(v.downvotes, 0) as downvotes,
    coalesce(f.flag_count, 0) as flag_count
  from public.place_ratings pr
  join public.places pl on pl.id = pr.place_id
  left join public.profiles pf on pf.id = pr.user_id
  left join auth.users au on au.id = pr.user_id
  left join (
    select rating_id,
      count(*) filter (where vote = 1) as upvotes,
      count(*) filter (where vote = -1) as downvotes
    from public.place_rating_note_votes
    group by rating_id
  ) v on v.rating_id = pr.id
  left join (
    select rating_id, count(*) as flag_count
    from public.place_rating_note_flags
    group by rating_id
  ) f on f.rating_id = pr.id
  where pr.place_id = p_place_id
  order by pr.updated_at desc, pr.created_at desc
  limit greatest(1, least(coalesce(p_limit, 200), 1000));
end;
$$;

create or replace function public.get_admin_users(
  p_limit integer default 100,
  p_offset integer default 0,
  p_query text default null
)
returns table (
  user_id uuid,
  email text,
  username text,
  city text,
  role text,
  is_frozen boolean,
  created_at timestamptz,
  updated_at timestamptz,
  last_sign_in_at timestamptz,
  grapevine_score numeric,
  helpful_votes_received integer,
  first_ratings_submitted integer,
  unique_cities_covered integer,
  reviews_submitted integer,
  notes_submitted integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_super_admin();

  return query
  select
    pf.id as user_id,
    au.email,
    coalesce(pf.username, split_part(coalesce(au.email, ''), '@', 1), 'user') as username,
    coalesce(pf.city, '') as city,
    pf.role,
    coalesce(pf.is_frozen, false) as is_frozen,
    pf.created_at,
    pf.updated_at,
    au.last_sign_in_at,
    coalesce(gs.grapevine_score, 0)::numeric as grapevine_score,
    coalesce(gs.helpful_votes_received, 0)::int as helpful_votes_received,
    coalesce(gs.first_ratings_submitted, 0)::int as first_ratings_submitted,
    coalesce(gs.unique_cities_covered, 0)::int as unique_cities_covered,
    coalesce(gs.reviews_submitted, 0)::int as reviews_submitted,
    coalesce(gs.notes_submitted, 0)::int as notes_submitted
  from public.profiles pf
  left join auth.users au on au.id = pf.id
  left join public.grapevine_user_score_stats gs on gs.user_id = pf.id
  where (
    coalesce(trim(p_query), '') = ''
    or lower(coalesce(au.email, '')) like '%' || lower(trim(p_query)) || '%'
    or lower(coalesce(pf.username, '')) like '%' || lower(trim(p_query)) || '%'
    or lower(coalesce(pf.city, '')) like '%' || lower(trim(p_query)) || '%'
  )
  order by coalesce(gs.grapevine_score, 0) desc, pf.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 1000))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

create or replace function public.get_admin_user_activity(
  p_user_id uuid,
  p_limit integer default 200
)
returns table (
  rating_id uuid,
  place_id uuid,
  place_name text,
  place_city text,
  rating_status text,
  revocation_reason text,
  created_at timestamptz,
  updated_at timestamptz,
  note text,
  visit_context text,
  price_range smallint,
  classic_modern integer,
  quiet_lively integer,
  cheap_premium integer,
  local_touristy integer,
  cozy_spacious integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_super_admin();

  return query
  select
    pr.id as rating_id,
    pl.id as place_id,
    pl.name as place_name,
    pl.city as place_city,
    pr.rating_status,
    pr.revocation_reason,
    pr.created_at,
    pr.updated_at,
    pr.note,
    pr.visit_context,
    pr.price_range,
    pr.classic_modern,
    pr.quiet_lively,
    pr.cheap_premium,
    pr.local_touristy,
    pr.cozy_spacious
  from public.place_ratings pr
  join public.places pl on pl.id = pr.place_id
  where pr.user_id = p_user_id
  order by pr.updated_at desc, pr.created_at desc
  limit greatest(1, least(coalesce(p_limit, 200), 1000));
end;
$$;

revoke execute on function public.get_admin_dashboard_totals() from public;
grant execute on function public.get_admin_dashboard_totals() to authenticated;
revoke execute on function public.get_admin_rated_venues(integer, integer) from public;
grant execute on function public.get_admin_rated_venues(integer, integer) to authenticated;
revoke execute on function public.get_admin_place_activity(uuid, integer) from public;
grant execute on function public.get_admin_place_activity(uuid, integer) to authenticated;
revoke execute on function public.get_admin_users(integer, integer, text) from public;
grant execute on function public.get_admin_users(integer, integer, text) to authenticated;
revoke execute on function public.get_admin_user_activity(uuid, integer) from public;
grant execute on function public.get_admin_user_activity(uuid, integer) to authenticated;
