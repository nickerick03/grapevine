-- Public profile privacy + notes visibility + leaderboard rank
-- Run after:
-- - 20260503_init_grapevine.sql
-- - 20260503_rating_moderation.sql
-- - 20260504_profile_preferences_and_leaderboard.sql
-- - 20260504_note_cards_feedback_and_public_profiles.sql

alter table public.profiles
  add column if not exists show_public_notes boolean not null default true;

update public.profiles
set show_public_notes = coalesce(show_public_notes, true)
where show_public_notes is null;

create index if not exists idx_profiles_show_public_notes on public.profiles (show_public_notes);

drop function if exists public.get_public_profile(text);
create function public.get_public_profile(
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
  hide_score boolean,
  show_public_notes boolean,
  rating_count integer,
  city_count integer,
  leaderboard_rank integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $function$
  with target as (
    select
      p.id,
      p.username,
      p.avatar_url,
      coalesce(nullif(p.emoji, ''), '🦊') as emoji,
      coalesce(nullif(p.gradient_from, ''), '#F59E0B') as gradient_from,
      coalesce(nullif(p.gradient_to, ''), '#EF4444') as gradient_to,
      coalesce(p.city, '') as city,
      coalesce(p.hide_score, false) as hide_score,
      coalesce(p.show_public_notes, true) as show_public_notes,
      p.created_at
    from public.profiles p
    where lower(p.username) = lower(trim(p_username))
    limit 1
  ),
  user_stats as (
    select
      t.id as user_id,
      count(pr.id)::int as rating_count,
      count(distinct pl.city)::int as city_count
    from target t
    left join public.place_ratings pr
      on pr.user_id = t.id
      and pr.rating_status = 'active'
    left join public.places pl
      on pl.id = pr.place_id
    group by t.id
  ),
  leaderboard_source as (
    select
      pr.user_id,
      count(*)::int as rating_count,
      count(distinct p.city)::int as city_count
    from public.place_ratings pr
    join public.places p on p.id = pr.place_id
    where pr.rating_status = 'active'
    group by pr.user_id
  ),
  leaderboard_ranked as (
    select
      row_number() over (
        order by
          ls.rating_count desc,
          ls.city_count desc,
          coalesce(prf.updated_at, prf.created_at) asc,
          prf.id asc
      )::int as rank,
      prf.id as user_id
    from leaderboard_source ls
    join public.profiles prf on prf.id = ls.user_id
    where coalesce(prf.hide_score, false) = false
  )
  select
    t.id as user_id,
    t.username,
    t.avatar_url,
    t.emoji,
    t.gradient_from,
    t.gradient_to,
    t.city,
    t.hide_score,
    t.show_public_notes,
    coalesce(us.rating_count, 0)::int as rating_count,
    coalesce(us.city_count, 0)::int as city_count,
    case when t.hide_score then null else lr.rank end as leaderboard_rank,
    t.created_at
  from target t
  left join user_stats us on us.user_id = t.id
  left join leaderboard_ranked lr on lr.user_id = t.id;
$function$;

revoke execute on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;

create or replace function public.get_public_profile_notes(
  p_username text,
  p_limit integer default 300
)
returns table (
  rating_id uuid,
  place_id uuid,
  place_name text,
  place_city text,
  note text,
  noted_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $function$
  with target as (
    select
      p.id,
      coalesce(p.show_public_notes, true) as show_public_notes
    from public.profiles p
    where lower(p.username) = lower(trim(p_username))
    limit 1
  )
  select
    pr.id as rating_id,
    pl.id as place_id,
    pl.name as place_name,
    pl.city as place_city,
    pr.note,
    coalesce(pr.updated_at, pr.created_at) as noted_at
  from target t
  join public.place_ratings pr
    on pr.user_id = t.id
   and pr.rating_status = 'active'
  join public.places pl
    on pl.id = pr.place_id
  where t.show_public_notes = true
    and nullif(trim(pr.note), '') is not null
  order by coalesce(pr.updated_at, pr.created_at) desc
  limit greatest(1, least(coalesce(p_limit, 300), 1000));
$function$;

revoke execute on function public.get_public_profile_notes(text, integer) from public;
grant execute on function public.get_public_profile_notes(text, integer) to anon, authenticated;
