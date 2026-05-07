-- Profile preferences + leaderboard backend support
-- Run after:
-- - 20260503_init_grapevine.sql
-- - 20260503_rating_moderation.sql

alter table public.profiles
  add column if not exists city text,
  add column if not exists hide_score boolean not null default false,
  add column if not exists emoji text,
  add column if not exists gradient_from text,
  add column if not exists gradient_to text;

update public.profiles
set
  city = coalesce(city, ''),
  hide_score = coalesce(hide_score, false),
  emoji = coalesce(nullif(emoji, ''), '🦊'),
  gradient_from = coalesce(nullif(gradient_from, ''), '#F59E0B'),
  gradient_to = coalesce(nullif(gradient_to, ''), '#EF4444')
where city is null
   or hide_score is null
   or emoji is null
   or gradient_from is null
   or gradient_to is null;

create index if not exists idx_profiles_hide_score on public.profiles (hide_score);

create or replace function public.get_leaderboard(p_limit integer default 50)
returns table (
  rank integer,
  user_id uuid,
  username text,
  display_name text,
  emoji text,
  gradient_from text,
  gradient_to text,
  city text,
  rating_count integer,
  city_count integer,
  city_list text[]
)
language sql
stable
security definer
set search_path = public
as $function$
  with stats as (
    select
      pr.user_id,
      count(*)::int as rating_count,
      count(distinct p.city)::int as city_count,
      array_agg(distinct p.city order by p.city) as city_list
    from public.place_ratings pr
    join public.places p on p.id = pr.place_id
    where pr.rating_status = 'active'
    group by pr.user_id
  ),
  ranked as (
    select
      row_number() over (
        order by
          s.rating_count desc,
          s.city_count desc,
          coalesce(prf.updated_at, prf.created_at) asc,
          prf.id asc
      )::int as rank,
      prf.id as user_id,
      prf.username,
      prf.display_name,
      coalesce(nullif(prf.emoji, ''), '🦊') as emoji,
      coalesce(nullif(prf.gradient_from, ''), '#F59E0B') as gradient_from,
      coalesce(nullif(prf.gradient_to, ''), '#EF4444') as gradient_to,
      coalesce(prf.city, '') as city,
      s.rating_count,
      s.city_count,
      s.city_list
    from stats s
    join public.profiles prf on prf.id = s.user_id
    where coalesce(prf.hide_score, false) = false
  )
  select
    r.rank,
    r.user_id,
    r.username,
    r.display_name,
    r.emoji,
    r.gradient_from,
    r.gradient_to,
    r.city,
    r.rating_count,
    r.city_count,
    r.city_list
  from ranked r
  where r.rank <= greatest(1, least(coalesce(p_limit, 50), 200))
  order by r.rank;
$function$;

revoke execute on function public.get_leaderboard(integer) from public;
grant execute on function public.get_leaderboard(integer) to anon, authenticated;
