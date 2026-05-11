-- Cup time window + finalize RPC stability patch
-- Adds start/end timestamps and rebinds cup RPCs for datetime logic.

alter table public.cups
  add column if not exists start_at timestamptz,
  add column if not exists end_at timestamptz;

update public.cups
set start_at = coalesce(start_at, start_date::timestamptz)
where start_at is null
  and start_date is not null;

update public.cups
set end_at = coalesce(end_at, (end_date::timestamptz + interval '1 day' - interval '1 second'))
where end_at is null
  and end_date is not null;

update public.cups
set
  start_at = coalesce(start_at, created_at),
  end_at = coalesce(end_at, created_at + interval '14 days')
where start_at is null
   or end_at is null;

alter table public.cups
  alter column start_at set not null,
  alter column end_at set not null;

alter table public.cups
  drop constraint if exists cups_date_range_check;

alter table public.cups
  drop constraint if exists cups_time_range_check;

alter table public.cups
  add constraint cups_time_range_check
  check (start_at < end_at);

drop index if exists public.idx_cups_date_range;
create index if not exists idx_cups_time_range
  on public.cups (start_at, end_at);

drop function if exists public.get_cup_user_scores(uuid);
create function public.get_cup_user_scores(
  p_cup_id uuid
)
returns table (
  user_id uuid,
  reviews_submitted integer,
  notes_submitted integer,
  unique_cities_covered integer,
  first_ratings_submitted integer,
  helpful_votes_received integer,
  city_list text[],
  cup_score numeric,
  score_reached_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $function$
  with cup_target as (
    select
      c.id,
      c.start_at as starts_at,
      c.end_at as ends_at
    from public.cups c
    where c.id = p_cup_id
    limit 1
  ),
  active_rating_rows as (
    select
      pr.id,
      pr.place_id,
      pr.user_id,
      pr.created_at,
      pr.first_note_added_at,
      p.city
    from public.place_ratings pr
    join public.places p on p.id = pr.place_id
    where pr.rating_status = 'active'
      and coalesce(public.is_user_currently_banned(pr.user_id), false) = false
  ),
  eligible_profiles as (
    select
      pf.id
    from public.profiles pf
    where coalesce(pf.hide_score, false) = false
      and coalesce(pf.is_frozen, false) = false
      and coalesce(public.is_user_currently_banned(pf.id), false) = false
  ),
  review_rows as (
    select
      ar.user_id,
      ar.city,
      ar.created_at
    from active_rating_rows ar
    join cup_target ct on ar.created_at >= ct.starts_at and ar.created_at < ct.ends_at
    join eligible_profiles ep on ep.id = ar.user_id
  ),
  review_stats as (
    select
      rr.user_id,
      count(*)::int as reviews_submitted
    from review_rows rr
    group by rr.user_id
  ),
  note_rows as (
    select
      ar.user_id,
      ar.first_note_added_at as noted_at
    from active_rating_rows ar
    join cup_target ct on ar.first_note_added_at >= ct.starts_at and ar.first_note_added_at < ct.ends_at
    join eligible_profiles ep on ep.id = ar.user_id
    where ar.first_note_added_at is not null
  ),
  note_stats as (
    select
      nr.user_id,
      count(*)::int as notes_submitted
    from note_rows nr
    group by nr.user_id
  ),
  city_firsts as (
    select
      rr.user_id,
      rr.city,
      min(rr.created_at) as first_city_at
    from review_rows rr
    group by rr.user_id, rr.city
  ),
  city_stats as (
    select
      cf.user_id,
      count(*)::int as unique_cities_covered,
      array_agg(cf.city order by cf.city) as city_list
    from city_firsts cf
    group by cf.user_id
  ),
  first_place_rating_global as (
    select distinct on (ar.place_id)
      ar.place_id,
      ar.user_id,
      ar.created_at
    from active_rating_rows ar
    order by ar.place_id, ar.created_at asc, ar.id asc
  ),
  first_rating_stats as (
    select
      fpr.user_id,
      count(*)::int as first_ratings_submitted
    from first_place_rating_global fpr
    join cup_target ct on fpr.created_at >= ct.starts_at and fpr.created_at < ct.ends_at
    join eligible_profiles ep on ep.id = fpr.user_id
    group by fpr.user_id
  ),
  helpful_vote_rows as (
    select
      ar.user_id,
      nv.created_at
    from public.place_rating_note_votes nv
    join active_rating_rows ar on ar.id = nv.rating_id
    join cup_target ct on nv.created_at >= ct.starts_at and nv.created_at < ct.ends_at
    join eligible_profiles ep on ep.id = ar.user_id
    where nv.vote = 1
  ),
  helpful_vote_stats as (
    select
      hvr.user_id,
      count(*)::int as helpful_votes_received
    from helpful_vote_rows hvr
    group by hvr.user_id
  ),
  events as (
    select rr.user_id, rr.created_at as event_at, 1.0::numeric as points from review_rows rr
    union all
    select cf.user_id, cf.first_city_at as event_at, 10.0::numeric as points from city_firsts cf
    union all
    select frg.user_id, frg.created_at as event_at, 5.0::numeric as points
    from first_place_rating_global frg
    join cup_target ct on frg.created_at >= ct.starts_at and frg.created_at < ct.ends_at
    join eligible_profiles ep on ep.id = frg.user_id
    union all
    select nr.user_id, nr.noted_at as event_at, 3.0::numeric as points from note_rows nr
    union all
    select hvr.user_id, hvr.created_at as event_at, 0.1::numeric as points from helpful_vote_rows hvr
  ),
  event_rollup as (
    select
      e.user_id,
      round(sum(e.points), 1) as cup_score,
      max(e.event_at) as score_reached_at
    from events e
    group by e.user_id
  ),
  user_pool as (
    select user_id from review_stats
    union
    select user_id from note_stats
    union
    select user_id from city_stats
    union
    select user_id from first_rating_stats
    union
    select user_id from helpful_vote_stats
    union
    select user_id from event_rollup
  )
  select
    up.user_id,
    coalesce(rs.reviews_submitted, 0)::int as reviews_submitted,
    coalesce(ns.notes_submitted, 0)::int as notes_submitted,
    coalesce(cs.unique_cities_covered, 0)::int as unique_cities_covered,
    coalesce(fr.first_ratings_submitted, 0)::int as first_ratings_submitted,
    coalesce(hv.helpful_votes_received, 0)::int as helpful_votes_received,
    coalesce(cs.city_list, '{}'::text[]) as city_list,
    coalesce(er.cup_score, 0)::numeric as cup_score,
    er.score_reached_at
  from user_pool up
  left join review_stats rs on rs.user_id = up.user_id
  left join note_stats ns on ns.user_id = up.user_id
  left join city_stats cs on cs.user_id = up.user_id
  left join first_rating_stats fr on fr.user_id = up.user_id
  left join helpful_vote_stats hv on hv.user_id = up.user_id
  left join event_rollup er on er.user_id = up.user_id
  where coalesce(er.cup_score, 0) > 0;
$function$;

revoke execute on function public.get_cup_user_scores(uuid) from public;
grant execute on function public.get_cup_user_scores(uuid) to anon, authenticated;

drop function if exists public.get_active_cup();
create function public.get_active_cup()
returns table (
  id uuid,
  name text,
  start_at timestamptz,
  end_at timestamptz,
  reward_points integer,
  svg_markup text,
  is_active boolean,
  finalized_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  seconds_left bigint
)
language sql
stable
security definer
set search_path = public
as $function$
  select
    c.id,
    c.name,
    c.start_at,
    c.end_at,
    c.reward_points,
    c.svg_markup,
    c.is_active,
    c.finalized_at,
    c.created_at,
    c.updated_at,
    greatest(
      0,
      extract(epoch from (c.end_at - now()))
    )::bigint as seconds_left
  from public.cups c
  where c.is_active = true
  order by c.start_at desc, c.created_at desc
  limit 1;
$function$;

revoke execute on function public.get_active_cup() from public;
grant execute on function public.get_active_cup() to anon, authenticated;

drop function if exists public.get_cup_leaderboard(uuid, integer);
create function public.get_cup_leaderboard(
  p_cup_id uuid default null,
  p_limit integer default 50
)
returns table (
  rank integer,
  user_id uuid,
  username text,
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
        order by c.start_at desc, c.created_at desc
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
  order by r.rank;
$function$;

revoke execute on function public.get_cup_leaderboard(uuid, integer) from public;
grant execute on function public.get_cup_leaderboard(uuid, integer) to anon, authenticated;

create or replace function public.finalize_cup_internal(
  p_cup_id uuid,
  p_actor_user_id uuid default null
)
returns table (
  cup_id uuid,
  placements_saved integer,
  rewards_saved integer,
  already_finalized boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cup public.cups%rowtype;
  v_saved_placements integer := 0;
  v_saved_rewards integer := 0;
  v_reward integer;
  v_row record;
begin
  select *
  into v_cup
  from public.cups c
  where c.id = p_cup_id
  for update;

  if not found then
    raise exception 'Cup not found';
  end if;

  if v_cup.finalized_at is not null then
    return query select v_cup.id, 0, 0, true;
    return;
  end if;

  for v_row in
    select
      r.user_id,
      r.rank,
      r.cup_score
    from public.get_cup_leaderboard(v_cup.id, 3) r
    where r.rank between 1 and 3
    order by r.rank asc
  loop
    v_reward := case
      when v_row.rank = 1 then round(v_cup.reward_points::numeric * 1.0)::int
      when v_row.rank = 2 then round(v_cup.reward_points::numeric * 0.5)::int
      when v_row.rank = 3 then round(v_cup.reward_points::numeric * 0.25)::int
      else 0
    end;

    insert into public.cup_placements (
      cup_id,
      user_id,
      placement,
      cup_score,
      reward_points_awarded,
      created_at
    )
    values (
      v_cup.id,
      v_row.user_id,
      v_row.rank,
      v_row.cup_score,
      greatest(v_reward, 0),
      now()
    )
    on conflict on constraint cup_placements_unique_cup_placement do nothing;

    if found then
      v_saved_placements := v_saved_placements + 1;
    end if;

    if v_reward > 0 then
      insert into public.score_transactions (
        user_id,
        cup_id,
        transaction_type,
        points,
        idempotency_key,
        metadata,
        created_at
      )
      values (
        v_row.user_id,
        v_cup.id,
        'cup_reward',
        v_reward,
        format('cup_reward:%s:placement:%s', v_cup.id::text, v_row.rank::text),
        jsonb_build_object(
          'placement', v_row.rank,
          'cup_name', v_cup.name,
          'reward_multiplier', case when v_row.rank = 1 then 1.0 when v_row.rank = 2 then 0.5 else 0.25 end,
          'source', 'cup_finalization'
        ),
        now()
      )
      on conflict (idempotency_key) do nothing;

      if found then
        v_saved_rewards := v_saved_rewards + 1;
      end if;
    end if;
  end loop;

  update public.cups
  set
    finalized_at = now(),
    finalized_by = coalesce(p_actor_user_id, finalized_by),
    is_active = false,
    updated_at = now()
  where id = v_cup.id;

  return query select v_cup.id, v_saved_placements, v_saved_rewards, false;
end;
$$;

create or replace function public.admin_finalize_cup(
  p_cup_id uuid
)
returns table (
  cup_id uuid,
  placements_saved integer,
  rewards_saved integer,
  already_finalized boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_super_admin();

  return query
  select *
  from public.finalize_cup_internal(p_cup_id, auth.uid());
end;
$$;

revoke execute on function public.admin_finalize_cup(uuid) from public;
grant execute on function public.admin_finalize_cup(uuid) to authenticated;

create or replace function public.finalize_due_cups()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cup record;
  v_count integer := 0;
begin
  for v_cup in
    select c.id
    from public.cups c
    where c.finalized_at is null
      and c.end_at < now()
  loop
    perform 1
    from public.finalize_cup_internal(v_cup.id, null)
    limit 1;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.finalize_due_cups() from public;
grant execute on function public.finalize_due_cups() to authenticated;

create or replace function public.admin_set_cup_active(
  p_cup_id uuid,
  p_is_active boolean
)
returns public.cups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cup public.cups;
begin
  perform public.assert_super_admin();

  if p_is_active then
    update public.cups
    set is_active = false,
        updated_at = now()
    where is_active = true
      and id <> p_cup_id;
  end if;

  update public.cups
  set
    is_active = p_is_active,
    updated_at = now()
  where id = p_cup_id
  returning * into v_cup;

  if not found then
    raise exception 'Cup not found';
  end if;

  return v_cup;
end;
$$;

revoke execute on function public.admin_set_cup_active(uuid, boolean) from public;
grant execute on function public.admin_set_cup_active(uuid, boolean) to authenticated;

drop function if exists public.admin_create_cup(text, date, date, integer, text, boolean);
drop function if exists public.admin_create_cup(text, timestamptz, timestamptz, integer, text, boolean);
create function public.admin_create_cup(
  p_name text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_reward_points integer,
  p_svg_markup text,
  p_is_active boolean default false
)
returns public.cups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cup public.cups;
begin
  perform public.assert_super_admin();

  insert into public.cups (
    name,
    start_at,
    end_at,
    start_date,
    end_date,
    reward_points,
    svg_markup,
    is_active,
    created_at,
    updated_at
  )
  values (
    trim(p_name),
    p_start_at,
    p_end_at,
    p_start_at::date,
    p_end_at::date,
    greatest(coalesce(p_reward_points, 0), 0),
    public.sanitize_cup_svg_markup(p_svg_markup),
    false,
    now(),
    now()
  )
  returning * into v_cup;

  if p_is_active then
    select * into v_cup from public.admin_set_cup_active(v_cup.id, true);
  end if;

  return v_cup;
end;
$$;

revoke execute on function public.admin_create_cup(text, timestamptz, timestamptz, integer, text, boolean) from public;
grant execute on function public.admin_create_cup(text, timestamptz, timestamptz, integer, text, boolean) to authenticated;

drop function if exists public.admin_update_cup(uuid, text, date, date, integer, text, boolean);
drop function if exists public.admin_update_cup(uuid, text, timestamptz, timestamptz, integer, text, boolean);
create function public.admin_update_cup(
  p_cup_id uuid,
  p_name text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_reward_points integer,
  p_svg_markup text,
  p_is_active boolean
)
returns public.cups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cup public.cups;
begin
  perform public.assert_super_admin();

  update public.cups
  set
    name = trim(p_name),
    start_at = p_start_at,
    end_at = p_end_at,
    start_date = p_start_at::date,
    end_date = p_end_at::date,
    reward_points = greatest(coalesce(p_reward_points, 0), 0),
    svg_markup = public.sanitize_cup_svg_markup(p_svg_markup),
    updated_at = now()
  where id = p_cup_id
  returning * into v_cup;

  if not found then
    raise exception 'Cup not found';
  end if;

  if p_is_active is distinct from v_cup.is_active then
    select * into v_cup from public.admin_set_cup_active(p_cup_id, p_is_active);
  end if;

  return v_cup;
end;
$$;

revoke execute on function public.admin_update_cup(uuid, text, timestamptz, timestamptz, integer, text, boolean) from public;
grant execute on function public.admin_update_cup(uuid, text, timestamptz, timestamptz, integer, text, boolean) to authenticated;

drop function if exists public.get_admin_cups();
create function public.get_admin_cups()
returns table (
  id uuid,
  name text,
  start_at timestamptz,
  end_at timestamptz,
  reward_points integer,
  svg_markup text,
  is_active boolean,
  finalized_at timestamptz,
  finalized_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  perform public.assert_super_admin();

  return query
  select
    c.id,
    c.name,
    c.start_at,
    c.end_at,
    c.reward_points,
    c.svg_markup,
    c.is_active,
    c.finalized_at,
    c.finalized_by,
    c.created_at,
    c.updated_at
  from public.cups c
  order by c.is_active desc, c.start_at desc, c.created_at desc;
end;
$function$;

revoke execute on function public.get_admin_cups() from public;
grant execute on function public.get_admin_cups() to authenticated;
