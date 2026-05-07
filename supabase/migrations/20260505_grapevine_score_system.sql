-- Grapevine Score system
-- Replaces simple review-count ranking with weighted contribution ranking.
-- Run after:
-- - 20260503_init_grapevine.sql
-- - 20260503_rating_moderation.sql
-- - 20260504_note_cards_feedback_and_public_profiles.sql
-- - 20260504_public_profile_privacy_notes_rank.sql

create or replace view public.grapevine_user_score_stats as
with active_ratings as (
  select
    pr.id,
    pr.place_id,
    pr.user_id,
    pr.note,
    pr.created_at,
    p.city
  from public.place_ratings pr
  join public.places p on p.id = pr.place_id
  where pr.rating_status = 'active'
),
review_stats as (
  select
    ar.user_id,
    count(*)::int as reviews_submitted,
    count(distinct ar.city)::int as unique_cities_covered,
    count(*) filter (where nullif(trim(ar.note), '') is not null)::int as notes_submitted,
    array_agg(distinct ar.city order by ar.city) as city_list
  from active_ratings ar
  group by ar.user_id
),
helpful_vote_stats as (
  select
    ar.user_id,
    coalesce(count(v.*) filter (where v.vote = 1), 0)::int as helpful_votes_received
  from active_ratings ar
  left join public.place_rating_note_votes v on v.rating_id = ar.id
  where nullif(trim(ar.note), '') is not null
  group by ar.user_id
),
first_active_place_rating as (
  select distinct on (ar.place_id)
    ar.place_id,
    ar.user_id
  from active_ratings ar
  order by ar.place_id, ar.created_at asc, ar.id asc
),
first_rating_stats as (
  select
    fpr.user_id,
    count(*)::int as first_ratings_submitted
  from first_active_place_rating fpr
  group by fpr.user_id
)
select
  rs.user_id,
  rs.reviews_submitted,
  rs.notes_submitted,
  rs.unique_cities_covered,
  coalesce(fr.first_ratings_submitted, 0)::int as first_ratings_submitted,
  coalesce(hv.helpful_votes_received, 0)::int as helpful_votes_received,
  rs.city_list,
  round(
    (
      coalesce(hv.helpful_votes_received, 0)::numeric * 0.1
      + coalesce(fr.first_ratings_submitted, 0)::numeric * 5
      + rs.unique_cities_covered::numeric * 10
      + rs.reviews_submitted::numeric
      + rs.notes_submitted::numeric * 3
    ),
    1
  ) as grapevine_score
from review_stats rs
left join helpful_vote_stats hv on hv.user_id = rs.user_id
left join first_rating_stats fr on fr.user_id = rs.user_id;

grant select on public.grapevine_user_score_stats to anon, authenticated;

drop function if exists public.get_leaderboard(integer);
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
  notes_count integer,
  first_rating_count integer,
  helpful_votes_received integer,
  grapevine_score numeric,
  city_list text[]
)
language sql
stable
security definer
set search_path = public
as $function$
  with ranked as (
    select
      row_number() over (
        order by
          s.grapevine_score desc,
          s.first_ratings_submitted desc,
          s.helpful_votes_received desc,
          s.unique_cities_covered desc,
          s.reviews_submitted desc,
          s.notes_submitted desc,
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
      s.reviews_submitted as rating_count,
      s.unique_cities_covered as city_count,
      s.notes_submitted as notes_count,
      s.first_ratings_submitted as first_rating_count,
      s.helpful_votes_received,
      s.grapevine_score,
      s.city_list
    from public.grapevine_user_score_stats s
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
    r.notes_count,
    r.first_rating_count,
    r.helpful_votes_received,
    r.grapevine_score,
    r.city_list
  from ranked r
  where r.rank <= greatest(1, least(coalesce(p_limit, 50), 200))
  order by r.rank;
$function$;

revoke execute on function public.get_leaderboard(integer) from public;
grant execute on function public.get_leaderboard(integer) to anon, authenticated;

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
  notes_count integer,
  first_rating_count integer,
  helpful_votes_received integer,
  grapevine_score numeric,
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
      coalesce(gs.reviews_submitted, 0)::int as rating_count,
      coalesce(gs.unique_cities_covered, 0)::int as city_count,
      coalesce(gs.notes_submitted, 0)::int as notes_count,
      coalesce(gs.first_ratings_submitted, 0)::int as first_rating_count,
      coalesce(gs.helpful_votes_received, 0)::int as helpful_votes_received,
      coalesce(gs.grapevine_score, 0)::numeric as grapevine_score
    from target t
    left join public.grapevine_user_score_stats gs on gs.user_id = t.id
  ),
  leaderboard_ranked as (
    select
      row_number() over (
        order by
          s.grapevine_score desc,
          s.first_ratings_submitted desc,
          s.helpful_votes_received desc,
          s.unique_cities_covered desc,
          s.reviews_submitted desc,
          s.notes_submitted desc,
          coalesce(prf.updated_at, prf.created_at) asc,
          prf.id asc
      )::int as rank,
      prf.id as user_id
    from public.grapevine_user_score_stats s
    join public.profiles prf on prf.id = s.user_id
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
    us.rating_count,
    us.city_count,
    us.notes_count,
    us.first_rating_count,
    us.helpful_votes_received,
    us.grapevine_score,
    case when t.hide_score then null else lr.rank end as leaderboard_rank,
    t.created_at
  from target t
  left join user_stats us on us.user_id = t.id
  left join leaderboard_ranked lr on lr.user_id = t.id;
$function$;

revoke execute on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;
