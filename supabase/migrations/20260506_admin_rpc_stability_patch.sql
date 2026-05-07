-- Admin RPC stability patch
-- Fixes failures in admin screens when auth.users access differs between environments.

alter table public.profiles
  add column if not exists city text,
  add column if not exists is_frozen boolean not null default false;

create or replace function public.admin_get_user_auth_snapshot(
  p_user_id uuid
)
returns table (
  email text,
  last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  begin
    return query
    select
      u.email::text,
      u.last_sign_in_at
    from auth.users u
    where u.id = p_user_id
    limit 1;
  exception
    when others then
      return query
      select null::text, null::timestamptz;
  end;
end;
$$;

revoke execute on function public.admin_get_user_auth_snapshot(uuid) from public;
revoke execute on function public.admin_get_user_auth_snapshot(uuid) from anon;
revoke execute on function public.admin_get_user_auth_snapshot(uuid) from authenticated;

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
  left join lateral public.admin_get_user_auth_snapshot(pr.user_id) au on true
  left join (
    select
      rating_id,
      count(*) filter (where vote = 1) as upvotes,
      count(*) filter (where vote = -1) as downvotes
    from public.place_rating_note_votes
    group by rating_id
  ) v on v.rating_id = pr.id
  left join (
    select
      rating_id,
      count(*) as flag_count
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
  left join lateral public.admin_get_user_auth_snapshot(pf.id) au on true
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

revoke execute on function public.get_admin_place_activity(uuid, integer) from public;
grant execute on function public.get_admin_place_activity(uuid, integer) to authenticated;

revoke execute on function public.get_admin_users(integer, integer, text) from public;
grant execute on function public.get_admin_users(integer, integer, text) to authenticated;
