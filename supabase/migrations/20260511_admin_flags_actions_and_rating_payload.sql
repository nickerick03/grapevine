-- Admin flags improvements:
-- 1) Return full rating values in get_admin_flagged_notes
-- 2) Add admin action to clear flags without deleting note/rating ("Ignore")

drop function if exists public.get_admin_flagged_notes(integer, integer, text);

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
  reasons text[],
  latest_reason text,
  latest_details text,
  classic_modern integer,
  quiet_lively integer,
  cheap_premium integer,
  local_touristy integer,
  cozy_spacious integer,
  price_range integer,
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
      max(nf.created_at) as last_flagged_at,
      array_remove(array_agg(distinct nf.reason), null) as reasons
    from public.place_rating_note_flags nf
    group by nf.rating_id
  ),
  latest_flag as (
    select distinct on (nf.rating_id)
      nf.rating_id,
      nf.reason,
      nf.details
    from public.place_rating_note_flags nf
    order by nf.rating_id, nf.created_at desc, nf.id desc
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
    fa.reasons,
    lf.reason as latest_reason,
    lf.details as latest_details,
    pr.classic_modern,
    pr.quiet_lively,
    pr.cheap_premium,
    pr.local_touristy,
    pr.cozy_spacious,
    pr.price_range,
    pr.created_at,
    pr.updated_at
  from flag_agg fa
  join public.place_ratings pr on pr.id = fa.flagged_rating_id
  join public.places pl on pl.id = pr.place_id
  left join public.profiles pf on pf.id = pr.user_id
  left join lateral public.admin_get_user_auth_snapshot(pr.user_id) au on true
  left join latest_flag lf on lf.rating_id = pr.id
  where nullif(trim(pr.note), '') is not null
    and (
      coalesce(trim(p_query), '') = ''
      or lower(coalesce(pl.name, '')) like '%' || lower(trim(p_query)) || '%'
      or lower(coalesce(pl.city, '')) like '%' || lower(trim(p_query)) || '%'
      or lower(coalesce(pf.username, '')) like '%' || lower(trim(p_query)) || '%'
      or lower(coalesce(pr.note, '')) like '%' || lower(trim(p_query)) || '%'
      or lower(coalesce(lf.reason, '')) like '%' || lower(trim(p_query)) || '%'
      or lower(coalesce(lf.details, '')) like '%' || lower(trim(p_query)) || '%'
    )
  order by fa.flags_total desc, fa.last_flagged_at desc
  limit greatest(1, least(coalesce(p_limit, 200), 1000))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

revoke execute on function public.get_admin_flagged_notes(integer, integer, text) from public;
revoke execute on function public.get_admin_flagged_notes(integer, integer, text) from anon;
grant execute on function public.get_admin_flagged_notes(integer, integer, text) to authenticated;

create or replace function public.admin_clear_note_flags(
  p_rating_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_super_admin();

  delete from public.place_rating_note_flags
  where rating_id = p_rating_id;
end;
$$;

revoke execute on function public.admin_clear_note_flags(uuid) from public;
revoke execute on function public.admin_clear_note_flags(uuid) from anon;
grant execute on function public.admin_clear_note_flags(uuid) to authenticated;
