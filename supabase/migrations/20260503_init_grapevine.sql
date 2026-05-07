-- Grapevine MVP schema and security setup
-- Run this in your Supabase SQL editor.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  category text not null default 'bar',
  venue_type text not null default 'bar' check (venue_type in ('bar', 'cafe', 'restaurant')),
  price_range smallint check (price_range is null or price_range between 1 and 4),
  address text,
  city text not null,
  country text not null default 'Hungary',
  latitude double precision not null,
  longitude double precision not null,
  description text,
  image_url text,
  created_by uuid references public.profiles(id),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.place_ratings (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  classic_modern integer not null check (classic_modern between 0 and 100),
  quiet_lively integer not null check (quiet_lively between 0 and 100),
  cheap_premium integer not null check (cheap_premium between 0 and 100),
  local_touristy integer not null check (local_touristy between 0 and 100),
  cozy_spacious integer not null check (cozy_spacious between 0 and 100),
  price_range smallint check (price_range is null or price_range between 1 and 4),
  visit_context text check (
    visit_context is null
    or visit_context in ('Weekday afternoon', 'Weekday evening', 'Weekend afternoon', 'Weekend evening', 'Late night')
  ),
  note text check (char_length(note) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (place_id, user_id)
);

create table if not exists public.saved_places (
  user_id uuid not null references public.profiles(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

create index if not exists idx_places_city on public.places(city);
create index if not exists idx_places_category on public.places(category);
create index if not exists idx_places_is_published on public.places(is_published);
create index if not exists idx_place_ratings_place_id on public.place_ratings(place_id);
create index if not exists idx_place_ratings_user_id on public.place_ratings(user_id);
create index if not exists idx_saved_places_place_id on public.saved_places(place_id);

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger set_places_updated_at
before update on public.places
for each row
execute function public.set_updated_at();

create trigger set_place_ratings_updated_at
before update on public.place_ratings
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user_profile();

create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_is_admin boolean;
begin
  if new.role is distinct from old.role then
    if auth.uid() = old.id then
      raise exception 'Users cannot change their own role';
    end if;

    select exists (
      select 1 from public.profiles actor where actor.id = auth.uid() and actor.role = 'admin'
    ) into actor_is_admin;

    if not actor_is_admin then
      raise exception 'Only admins can change roles';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_profile_role_escalation_trigger on public.profiles;
create trigger prevent_profile_role_escalation_trigger
before update on public.profiles
for each row
execute function public.prevent_profile_role_escalation();

create or replace view public.place_vibe_summary as
select
  p.id as place_id,
  count(pr.id)::int as rating_count,
  round(avg(pr.classic_modern)::numeric, 1) as avg_classic_modern,
  round(avg(pr.quiet_lively)::numeric, 1) as avg_quiet_lively,
  round(avg(pr.cheap_premium)::numeric, 1) as avg_cheap_premium,
  round(avg(pr.local_touristy)::numeric, 1) as avg_local_touristy,
  round(avg(pr.cozy_spacious)::numeric, 1) as avg_cozy_spacious,
  round(avg(pr.price_range)::numeric, 1) as avg_price_range,
  case
    when count(pr.id) = 0 then 'No ratings yet'
    when count(pr.id) between 1 and 9 then 'Low confidence'
    when count(pr.id) between 10 and 49 then 'Medium confidence'
    else 'High confidence'
  end::text as confidence_level
from public.places p
left join public.place_ratings pr on pr.place_id = p.id
group by p.id;

grant select on public.place_vibe_summary to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.places enable row level security;
alter table public.place_ratings enable row level security;
alter table public.saved_places enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "places_select_published" on public.places;
create policy "places_select_published"
on public.places
for select
to anon, authenticated
using (is_published = true);

drop policy if exists "places_admin_insert" on public.places;
create policy "places_admin_insert"
on public.places
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'admin'
  )
);

drop policy if exists "places_admin_update" on public.places;
create policy "places_admin_update"
on public.places
for update
to authenticated
using (
  exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'admin'
  )
);

drop policy if exists "places_admin_delete" on public.places;
create policy "places_admin_delete"
on public.places
for delete
to authenticated
using (
  exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'admin'
  )
);

drop policy if exists "place_ratings_select_all" on public.place_ratings;
create policy "place_ratings_select_all"
on public.place_ratings
for select
to anon, authenticated
using (true);

drop policy if exists "place_ratings_insert_own" on public.place_ratings;
create policy "place_ratings_insert_own"
on public.place_ratings
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "place_ratings_update_own" on public.place_ratings;
create policy "place_ratings_update_own"
on public.place_ratings
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "place_ratings_delete_own" on public.place_ratings;
create policy "place_ratings_delete_own"
on public.place_ratings
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "saved_places_select_own" on public.saved_places;
create policy "saved_places_select_own"
on public.saved_places
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "saved_places_insert_own" on public.saved_places;
create policy "saved_places_insert_own"
on public.saved_places
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "saved_places_delete_own" on public.saved_places;
create policy "saved_places_delete_own"
on public.saved_places
for delete
to authenticated
using (auth.uid() = user_id);
