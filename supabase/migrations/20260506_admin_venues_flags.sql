-- Admin venues + flags RPC patch
-- 1) Fix ambiguous "rating_id" reference in get_admin_place_activity
-- 2) Add get_admin_flagged_notes for admin flag triage screen

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
      nv.rating_id as vote_rating_id,
      count(*) filter (where nv.vote = 1) as upvotes,
      count(*) filter (where nv.vote = -1) as downvotes
    from public.place_rating_note_votes nv
    group by nv.rating_id
  ) v on v.vote_rating_id = pr.id
  left join (
    select
      nf.rating_id as flag_rating_id,
      count(*) as flag_count
    from public.place_rating_note_flags nf
    group by nf.rating_id
  ) f on f.flag_rating_id = pr.id
  where pr.place_id = p_place_id
  order by pr.updated_at desc, pr.created_at desc
  limit greatest(1, least(coalesce(p_limit, 200), 1000));
end;
$$;

create or replace function public.get_admin_flagged_notes(
  p_limit integer default 200,
  p_offset integer default 0,
  p_query text default null
)
returns table (
  rating_id uuid,
  place_id uuid,
  place_name text,
  place_city text,
  user_id uuid,
  username text,
  user_email text,
  note text,
  rating_status text,
  flag_count bigint,
  last_flagged_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_super_admin();

  return query
  with flag_agg as (
    select
      nf.rating_id as flagged_rating_id,
      count(*)::bigint as flags_total,
      max(nf.created_at) as last_flagged_at
    from public.place_rating_note_flags nf
    group by nf.rating_id
  )
  select
    pr.id as rating_id,
    pl.id as place_id,
    pl.name as place_name,
    pl.city as place_city,
    pr.user_id,
    coalesce(nullif(pf.username, ''), split_part(coalesce(au.email, ''), '@', 1), 'user') as username,
    au.email as user_email,
    pr.note,
    pr.rating_status,
    fa.flags_total as flag_count,
    fa.last_flagged_at,
    pr.created_at,
    pr.updated_at
  from flag_agg fa
  join public.place_ratings pr on pr.id = fa.flagged_rating_id
  join public.places pl on pl.id = pr.place_id
  left join public.profiles pf on pf.id = pr.user_id
  left join lateral public.admin_get_user_auth_snapshot(pr.user_id) au on true
  where nullif(trim(pr.note), '') is not null
    and (
      coalesce(trim(p_query), '') = ''
      or lower(coalesce(pl.name, '')) like '%' || lower(trim(p_query)) || '%'
      or lower(coalesce(pl.city, '')) like '%' || lower(trim(p_query)) || '%'
      or lower(coalesce(pf.username, '')) like '%' || lower(trim(p_query)) || '%'
      or lower(coalesce(pr.note, '')) like '%' || lower(trim(p_query)) || '%'
    )
  order by fa.flags_total desc, fa.last_flagged_at desc
  limit greatest(1, least(coalesce(p_limit, 200), 1000))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

revoke execute on function public.get_admin_place_activity(uuid, integer) from public;
revoke execute on function public.get_admin_place_activity(uuid, integer) from anon;
grant execute on function public.get_admin_place_activity(uuid, integer) to authenticated;

revoke execute on function public.get_admin_flagged_notes(integer, integer, text) from public;
revoke execute on function public.get_admin_flagged_notes(integer, integer, text) from anon;
grant execute on function public.get_admin_flagged_notes(integer, integer, text) to authenticated;
