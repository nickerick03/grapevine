-- Include avatar_url in cup leaderboard rows so UI can render profile photos consistently.

drop function if exists public.get_cup_leaderboard(uuid, integer);
create function public.get_cup_leaderboard(
  p_cup_id uuid default null,
  p_limit integer default 50
)
returns table (
  rank integer,
  user_id uuid,
  username text,
  avatar_url text,
  emoji text,
  gradient_from text,
  gradient_to text,
  city text,
  cup_score numeric,
  reviews_submitted integer,
  notes_submitted integer,
  unique_cities_covered integer,
  first_ratings_submitted integer,
  helpful_votes_received integer,
  all_time_score numeric,
  city_list text[],
  score_reached_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $function$
  with target_cup as (
    select coalesce(
      p_cup_id,
      (
        select c.id
        from public.cups c
        where c.is_active = true
        order by c.start_date desc, c.created_at desc
        limit 1
      )
    ) as cup_id
  ),
  cup_scores as (
    select s.*
    from target_cup tc
    join lateral public.get_cup_user_scores(tc.cup_id) s on tc.cup_id is not null
  ),
  ranked as (
    select
      row_number() over (
        order by
          cs.cup_score desc,
          cs.score_reached_at asc,
          cs.first_ratings_submitted desc,
          cs.helpful_votes_received desc,
          cs.unique_cities_covered desc,
          cs.reviews_submitted desc,
          cs.notes_submitted desc,
          coalesce(pf.updated_at, pf.created_at) asc,
          pf.id asc
      )::int as rank,
      pf.id as user_id,
      coalesce(nullif(pf.username, ''), concat('user_', left(pf.id::text, 6))) as username,
      pf.avatar_url,
      coalesce(nullif(pf.emoji, ''), '🦊') as emoji,
      coalesce(nullif(pf.gradient_from, ''), '#F59E0B') as gradient_from,
      coalesce(nullif(pf.gradient_to, ''), '#EF4444') as gradient_to,
      coalesce(pf.city, '') as city,
      cs.cup_score,
      cs.reviews_submitted,
      cs.notes_submitted,
      cs.unique_cities_covered,
      cs.first_ratings_submitted,
      cs.helpful_votes_received,
      coalesce(gs.grapevine_score, 0)::numeric as all_time_score,
      cs.city_list,
      cs.score_reached_at
    from cup_scores cs
    join public.profiles pf on pf.id = cs.user_id
    left join public.grapevine_user_score_stats gs on gs.user_id = cs.user_id
    where coalesce(pf.hide_score, false) = false
      and coalesce(pf.is_frozen, false) = false
      and coalesce(public.is_user_currently_banned(pf.id), false) = false
  )
  select
    r.rank,
    r.user_id,
    r.username,
    r.avatar_url,
    r.emoji,
    r.gradient_from,
    r.gradient_to,
    r.city,
    r.cup_score,
    r.reviews_submitted,
    r.notes_submitted,
    r.unique_cities_covered,
    r.first_ratings_submitted,
    r.helpful_votes_received,
    r.all_time_score,
    r.city_list,
    r.score_reached_at
  from ranked r
  where r.rank <= greatest(1, least(coalesce(p_limit, 50), 200))
  order by r.rank asc;
$function$;

revoke execute on function public.get_cup_leaderboard(uuid, integer) from public;
grant execute on function public.get_cup_leaderboard(uuid, integer) to anon, authenticated;
