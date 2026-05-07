-- Note cards: username/date + reactions + flagging + public profile lookup
-- Run after:
-- - 20260503_init_grapevine.sql
-- - 20260503_rating_moderation.sql
-- - 20260504_profile_preferences_and_leaderboard.sql

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

create index if not exists idx_place_rating_note_votes_rating_id
  on public.place_rating_note_votes (rating_id);
create index if not exists idx_place_rating_note_flags_rating_id
  on public.place_rating_note_flags (rating_id);
create index if not exists idx_place_rating_note_flags_user_id
  on public.place_rating_note_flags (user_id);

drop trigger if exists set_place_rating_note_votes_updated_at on public.place_rating_note_votes;
create trigger set_place_rating_note_votes_updated_at
before update on public.place_rating_note_votes
for each row
execute function public.set_updated_at();

alter table public.place_rating_note_votes enable row level security;
alter table public.place_rating_note_flags enable row level security;

drop policy if exists "note_votes_select_all" on public.place_rating_note_votes;
create policy "note_votes_select_all"
on public.place_rating_note_votes
for select
to anon, authenticated
using (true);

drop policy if exists "note_votes_insert_own" on public.place_rating_note_votes;
create policy "note_votes_insert_own"
on public.place_rating_note_votes
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "note_votes_update_own" on public.place_rating_note_votes;
create policy "note_votes_update_own"
on public.place_rating_note_votes
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "note_votes_delete_own" on public.place_rating_note_votes;
create policy "note_votes_delete_own"
on public.place_rating_note_votes
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "note_flags_select_own" on public.place_rating_note_flags;
create policy "note_flags_select_own"
on public.place_rating_note_flags
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "note_flags_insert_own" on public.place_rating_note_flags;
create policy "note_flags_insert_own"
on public.place_rating_note_flags
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "note_flags_delete_own" on public.place_rating_note_flags;
create policy "note_flags_delete_own"
on public.place_rating_note_flags
for delete
to authenticated
using (auth.uid() = user_id);

create or replace function public.get_place_note_feed(
  p_place_id uuid,
  p_limit integer default 6
)
returns table (
  rating_id uuid,
  user_id uuid,
  username text,
  avatar_url text,
  emoji text,
  gradient_from text,
  gradient_to text,
  note text,
  noted_at timestamptz,
  upvotes integer,
  downvotes integer,
  my_vote smallint,
  flagged_by_me boolean
)
language sql
stable
security definer
set search_path = public
as $function$
  with note_rows as (
    select
      pr.id as rating_id,
      pr.user_id,
      coalesce(nullif(pf.username, ''), concat('user_', left(pr.user_id::text, 6))) as username,
      pf.avatar_url,
      coalesce(nullif(pf.emoji, ''), '🦊') as emoji,
      coalesce(nullif(pf.gradient_from, ''), '#F59E0B') as gradient_from,
      coalesce(nullif(pf.gradient_to, ''), '#EF4444') as gradient_to,
      pr.note,
      coalesce(pr.updated_at, pr.created_at) as noted_at
    from public.place_ratings pr
    join public.profiles pf on pf.id = pr.user_id
    where pr.place_id = p_place_id
      and pr.rating_status = 'active'
      and nullif(trim(pr.note), '') is not null
    order by coalesce(pr.updated_at, pr.created_at) desc
    limit greatest(1, least(coalesce(p_limit, 6), 50))
  )
  select
    nr.rating_id,
    nr.user_id,
    nr.username,
    nr.avatar_url,
    nr.emoji,
    nr.gradient_from,
    nr.gradient_to,
    nr.note,
    nr.noted_at,
    coalesce((
      select count(*)
      from public.place_rating_note_votes v
      where v.rating_id = nr.rating_id and v.vote = 1
    ), 0)::int as upvotes,
    coalesce((
      select count(*)
      from public.place_rating_note_votes v
      where v.rating_id = nr.rating_id and v.vote = -1
    ), 0)::int as downvotes,
    (
      select v.vote
      from public.place_rating_note_votes v
      where v.rating_id = nr.rating_id
        and v.user_id = auth.uid()
      limit 1
    )::smallint as my_vote,
    exists (
      select 1
      from public.place_rating_note_flags f
      where f.rating_id = nr.rating_id
        and f.user_id = auth.uid()
    ) as flagged_by_me
  from note_rows nr
  order by nr.noted_at desc;
$function$;

revoke execute on function public.get_place_note_feed(uuid, integer) from public;
grant execute on function public.get_place_note_feed(uuid, integer) to anon, authenticated;

create or replace function public.get_public_profile(
  p_username text
)
returns table (
  user_id uuid,
  username text,
  avatar_url text,
  emoji text,
  gradient_from text,
  gradient_to text,
  city text,
  rating_count integer,
  city_count integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $function$
  select
    p.id as user_id,
    p.username,
    p.avatar_url,
    coalesce(nullif(p.emoji, ''), '🦊') as emoji,
    coalesce(nullif(p.gradient_from, ''), '#F59E0B') as gradient_from,
    coalesce(nullif(p.gradient_to, ''), '#EF4444') as gradient_to,
    coalesce(p.city, '') as city,
    coalesce(stats.rating_count, 0)::int as rating_count,
    coalesce(stats.city_count, 0)::int as city_count,
    p.created_at
  from public.profiles p
  left join lateral (
    select
      count(*)::int as rating_count,
      count(distinct pl.city)::int as city_count
    from public.place_ratings pr
    join public.places pl on pl.id = pr.place_id
    where pr.user_id = p.id
      and pr.rating_status = 'active'
  ) stats on true
  where lower(p.username) = lower(trim(p_username))
  limit 1;
$function$;

revoke execute on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;
