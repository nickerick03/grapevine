-- Fix admin flagged-notes function shape mismatch and add multi-report support per user/note.

alter table public.place_rating_note_flags
  add column if not exists report_count integer not null default 1;

update public.place_rating_note_flags
set report_count = 1
where report_count is null or report_count < 1;

alter table public.place_rating_note_flags
  drop constraint if exists place_rating_note_flags_report_count_check;

alter table public.place_rating_note_flags
  add constraint place_rating_note_flags_report_count_check
  check (report_count between 1 and 3);

create or replace function public.submit_note_flag_report(
  p_rating_id uuid,
  p_reason text default 'other',
  p_details text default null
)
returns table (
  status text,
  report_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_current_count integer;
  v_reason text;
  v_details text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  v_reason := coalesce(nullif(trim(p_reason), ''), 'other');
  if v_reason not in ('incorrect', 'false', 'inappropriate', 'other') then
    v_reason := 'other';
  end if;

  v_details := nullif(left(coalesce(p_details, ''), 280), '');

  if not exists (select 1 from public.place_ratings pr where pr.id = p_rating_id) then
    raise exception 'Rating not found';
  end if;

  select nf.report_count
  into v_current_count
  from public.place_rating_note_flags nf
  where nf.rating_id = p_rating_id
    and nf.user_id = v_user_id
  for update;

  if v_current_count is null then
    insert into public.place_rating_note_flags (
      rating_id,
      user_id,
      reason,
      details,
      report_count
    )
    values (
      p_rating_id,
      v_user_id,
      v_reason,
      case when v_reason = 'other' then v_details else null end,
      1
    );

    return query select 'created'::text, 1::integer;
    return;
  end if;

  if v_current_count >= 3 then
    update public.place_rating_note_flags
    set
      reason = v_reason,
      details = case when v_reason = 'other' then v_details else null end,
      created_at = now()
    where rating_id = p_rating_id
      and user_id = v_user_id;

    return query select 'limit_reached'::text, 3::integer;
    return;
  end if;

  update public.place_rating_note_flags
  set
    report_count = least(3, report_count + 1),
    reason = v_reason,
    details = case when v_reason = 'other' then v_details else null end,
    created_at = now()
  where rating_id = p_rating_id
    and user_id = v_user_id
  returning place_rating_note_flags.report_count into v_current_count;

  return query select 'updated'::text, coalesce(v_current_count, 1)::integer;
end;
$$;

revoke execute on function public.submit_note_flag_report(uuid, text, text) from public;
revoke execute on function public.submit_note_flag_report(uuid, text, text) from anon;
grant execute on function public.submit_note_flag_report(uuid, text, text) to authenticated;

drop function if exists public.get_place_note_feed(uuid, integer);

create or replace function public.get_place_note_feed(
  p_place_id uuid,
  p_limit integer default 8
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
  note_original text,
  noted_at timestamptz,
  note_edited_at timestamptz,
  is_edited boolean,
  upvotes integer,
  downvotes integer,
  my_vote integer,
  flagged_by_me boolean,
  my_flag_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  return query
  with votes as (
    select
      v.rating_id,
      count(*) filter (where v.vote = 1)::integer as upvotes,
      count(*) filter (where v.vote = -1)::integer as downvotes
    from public.place_rating_note_votes v
    group by v.rating_id
  ),
  my_votes as (
    select v.rating_id, v.vote
    from public.place_rating_note_votes v
    where v.user_id = v_user_id
  ),
  my_flags as (
    select
      f.rating_id,
      coalesce(f.report_count, 1)::integer as report_count
    from public.place_rating_note_flags f
    where f.user_id = v_user_id
  )
  select
    pr.id as rating_id,
    pr.user_id,
    coalesce(nullif(pf.username, ''), split_part(coalesce(au.email, ''), '@', 1), 'user')::text as username,
    pf.avatar_url::text as avatar_url,
    pf.emoji::text as emoji,
    pf.gradient_from::text as gradient_from,
    pf.gradient_to::text as gradient_to,
    pr.note::text as note,
    pr.note_original::text as note_original,
    coalesce(pr.note_edited_at, pr.updated_at)::timestamptz as noted_at,
    pr.note_edited_at::timestamptz as note_edited_at,
    (pr.note_original is not null or pr.note_edited_at is not null)::boolean as is_edited,
    coalesce(v.upvotes, 0)::integer as upvotes,
    coalesce(v.downvotes, 0)::integer as downvotes,
    coalesce(mv.vote, 0)::integer as my_vote,
    (mf.rating_id is not null)::boolean as flagged_by_me,
    coalesce(mf.report_count, 0)::integer as my_flag_count
  from public.place_ratings pr
  join public.places pl on pl.id = pr.place_id
  left join votes v on v.rating_id = pr.id
  left join my_votes mv on mv.rating_id = pr.id
  left join my_flags mf on mf.rating_id = pr.id
  left join public.profiles pf on pf.id = pr.user_id
  left join lateral public.admin_get_user_auth_snapshot(pr.user_id) au on true
  where pr.place_id = p_place_id
    and pr.rating_status = 'active'
    and nullif(trim(pr.note), '') is not null
  order by coalesce(pr.note_edited_at, pr.updated_at) desc
  limit greatest(1, least(coalesce(p_limit, 8), 50));
end;
$$;

revoke execute on function public.get_place_note_feed(uuid, integer) from public;
revoke execute on function public.get_place_note_feed(uuid, integer) from anon;
grant execute on function public.get_place_note_feed(uuid, integer) to authenticated, anon;

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
    pr.id::uuid as rating_id,
    pl.id::uuid as place_id,
    pl.name::text as place_name,
    pl.city::text as place_city,
    pr.user_id::uuid as user_id,
    coalesce(nullif(pf.username, ''), split_part(coalesce(au.email, ''), '@', 1), 'user')::text as username,
    au.email::text as user_email,
    pr.note::text as note,
    pr.rating_status::text as rating_status,
    fa.flags_total::bigint as flag_count,
    fa.last_flagged_at::timestamptz as last_flagged_at,
    fa.reasons::text[] as reasons,
    lf.reason::text as latest_reason,
    lf.details::text as latest_details,
    pr.classic_modern::integer,
    pr.quiet_lively::integer,
    pr.cheap_premium::integer,
    pr.local_touristy::integer,
    pr.cozy_spacious::integer,
    pr.price_range::integer,
    pr.created_at::timestamptz as created_at,
    pr.updated_at::timestamptz as updated_at
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
