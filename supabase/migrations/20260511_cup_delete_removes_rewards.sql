-- Ensure deleting a Cup removes its score impact from user profiles/leaderboards.
-- 1) Grapevine score view should only count rewards tied to existing cups.
-- 2) Admin cup delete should remove reward transactions for that cup.
-- 3) Cleanup legacy orphan reward transactions created by older delete flow.

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
),
cup_reward_stats as (
  select
    st.user_id,
    coalesce(sum(st.points), 0)::numeric as cup_reward_points
  from public.score_transactions st
  join public.cups c on c.id = st.cup_id
  where st.transaction_type = 'cup_reward'
  group by st.user_id
),
user_pool as (
  select rs.user_id from review_stats rs
  union
  select cr.user_id from cup_reward_stats cr
),
base_scores as (
  select
    up.user_id,
    coalesce(rs.reviews_submitted, 0)::int as reviews_submitted,
    coalesce(rs.notes_submitted, 0)::int as notes_submitted,
    coalesce(rs.unique_cities_covered, 0)::int as unique_cities_covered,
    coalesce(fr.first_ratings_submitted, 0)::int as first_ratings_submitted,
    coalesce(hv.helpful_votes_received, 0)::int as helpful_votes_received,
    coalesce(rs.city_list, '{}'::text[]) as city_list,
    round(
      (
        coalesce(hv.helpful_votes_received, 0)::numeric * 0.1
        + coalesce(fr.first_ratings_submitted, 0)::numeric * 5
        + coalesce(rs.unique_cities_covered, 0)::numeric * 10
        + coalesce(rs.reviews_submitted, 0)::numeric
        + coalesce(rs.notes_submitted, 0)::numeric * 3
      ),
      1
    ) as base_grapevine_score
  from user_pool up
  left join review_stats rs on rs.user_id = up.user_id
  left join helpful_vote_stats hv on hv.user_id = up.user_id
  left join first_rating_stats fr on fr.user_id = up.user_id
)
select
  bs.user_id,
  bs.reviews_submitted,
  bs.notes_submitted,
  bs.unique_cities_covered,
  bs.first_ratings_submitted,
  bs.helpful_votes_received,
  bs.city_list,
  round(bs.base_grapevine_score + coalesce(cr.cup_reward_points, 0)::numeric, 1) as grapevine_score,
  bs.base_grapevine_score,
  coalesce(cr.cup_reward_points, 0)::numeric as cup_reward_points
from base_scores bs
left join cup_reward_stats cr on cr.user_id = bs.user_id;

grant select on public.grapevine_user_score_stats to anon, authenticated;

create or replace function public.admin_delete_cup(
  p_cup_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_super_admin();

  delete from public.score_transactions st
  where st.cup_id = p_cup_id
    and st.transaction_type = 'cup_reward';

  delete from public.cups c
  where c.id = p_cup_id;
end;
$$;

revoke execute on function public.admin_delete_cup(uuid) from public;
grant execute on function public.admin_delete_cup(uuid) to authenticated;

-- Cleanup from previous versions where cup delete set cup_id to null but rewards remained.
delete from public.score_transactions st
where st.transaction_type = 'cup_reward'
  and st.cup_id is null;
