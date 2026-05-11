-- Cup period system (single active cup, no weekly splits)
-- Adds cup lifecycle, cup leaderboard, all-time cup rewards, and public profile cup placements.

create extension if not exists pgcrypto;

create table if not exists public.cups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date not null,
  reward_points integer not null default 0,
  svg_markup text not null,
  is_active boolean not null default false,
  finalized_at timestamptz,
  finalized_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cups_name_not_blank check (char_length(trim(name)) > 0),
  constraint cups_date_range_check check (start_date < end_date),
  constraint cups_reward_non_negative check (reward_points >= 0)
);

create unique index if not exists idx_cups_single_active
  on public.cups ((is_active))
  where is_active = true;

create index if not exists idx_cups_date_range
  on public.cups (start_date, end_date);

create table if not exists public.cup_placements (
  id uuid primary key default gen_random_uuid(),
  cup_id uuid not null references public.cups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  placement smallint not null,
  cup_score numeric(10,1) not null,
  reward_points_awarded integer not null default 0,
  created_at timestamptz not null default now(),
  constraint cup_placements_placement_check check (placement in (1, 2, 3)),
  constraint cup_placements_score_non_negative check (cup_score >= 0),
  constraint cup_placements_reward_non_negative check (reward_points_awarded >= 0),
  constraint cup_placements_unique_cup_placement unique (cup_id, placement),
  constraint cup_placements_unique_cup_user unique (cup_id, user_id)
);

create index if not exists idx_cup_placements_user_created
  on public.cup_placements (user_id, created_at desc);

create table if not exists public.score_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  cup_id uuid references public.cups(id) on delete set null,
  transaction_type text not null,
  points integer not null default 0,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint score_transactions_type_check check (transaction_type in ('cup_reward')),
  constraint score_transactions_points_non_negative check (points >= 0),
  constraint score_transactions_idempotency_unique unique (idempotency_key)
);

create index if not exists idx_score_transactions_user_type
  on public.score_transactions (user_id, transaction_type, created_at desc);

create index if not exists idx_score_transactions_cup_type
  on public.score_transactions (cup_id, transaction_type, created_at desc);

drop trigger if exists set_cups_updated_at on public.cups;
create trigger set_cups_updated_at
before update on public.cups
for each row
execute function public.set_updated_at();

alter table public.place_ratings
  add column if not exists first_note_added_at timestamptz;

update public.place_ratings
set first_note_added_at = coalesce(updated_at, created_at)
where nullif(trim(note), '') is not null
  and first_note_added_at is null;

create or replace function public.set_place_rating_first_note_added_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_note text;
  new_note text;
begin
  if tg_op = 'INSERT' then
    new_note := nullif(trim(new.note), '');
    if new_note is not null and new.first_note_added_at is null then
      new.first_note_added_at := coalesce(new.created_at, now());
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    old_note := nullif(trim(old.note), '');
    new_note := nullif(trim(new.note), '');
    if old_note is null
       and new_note is not null
       and new.first_note_added_at is null then
      new.first_note_added_at := now();
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists set_place_rating_first_note_added_at on public.place_ratings;
create trigger set_place_rating_first_note_added_at
before insert or update on public.place_ratings
for each row
execute function public.set_place_rating_first_note_added_at();

create or replace function public.is_user_currently_banned(
  p_user_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  begin
    return exists (
      select 1
      from auth.users u
      where u.id = p_user_id
        and u.banned_until is not null
        and u.banned_until > now()
    );
  exception
    when others then
      return false;
  end;
end;
$$;

revoke execute on function public.is_user_currently_banned(uuid) from public;
grant execute on function public.is_user_currently_banned(uuid) to anon, authenticated;

create or replace function public.sanitize_cup_svg_markup(
  p_svg text
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_svg text := trim(coalesce(p_svg, ''));
  v_lower text;
begin
  if v_svg = '' then
    raise exception 'Cup SVG is required';
  end if;

  if char_length(v_svg) > 200000 then
    raise exception 'Cup SVG is too large';
  end if;

  v_lower := lower(v_svg);

  if position('<svg' in v_lower) = 0 then
    raise exception 'Cup artwork must be a valid SVG';
  end if;

  if v_lower ~ '<\\s*script'
     or v_lower ~ 'on[a-z]+\\s*='
     or v_lower ~ 'javascript\\s*:'
     or v_lower ~ '<\\s*foreignobject'
     or v_lower ~ 'data\\s*:\\s*text/html' then
    raise exception 'Cup SVG contains disallowed content';
  end if;

  return v_svg;
end;
$$;

create or replace function public.get_default_cup_badge_svg(
  p_placement smallint
)
returns text
language sql
immutable
as $$
  select case
    when p_placement = 2 then
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="Second place"><defs><linearGradient id="g2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#e2e8f0"/><stop offset="100%" stop-color="#a8b5d9"/></linearGradient></defs><circle cx="60" cy="60" r="52" fill="url(#g2)"/><circle cx="60" cy="60" r="42" fill="rgba(255,255,255,0.65)"/><text x="60" y="71" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="34" fill="#67708f">2</text></svg>'
    when p_placement = 3 then
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="Third place"><defs><linearGradient id="g3" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f6e5cf"/><stop offset="100%" stop-color="#d7a87b"/></linearGradient></defs><circle cx="60" cy="60" r="52" fill="url(#g3)"/><circle cx="60" cy="60" r="42" fill="rgba(255,255,255,0.62)"/><text x="60" y="71" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="34" fill="#9a5f2d">3</text></svg>'
    else
      null
  end;
$$;

alter table public.cups enable row level security;
alter table public.cup_placements enable row level security;
alter table public.score_transactions enable row level security;

drop policy if exists "cups_select_public" on public.cups;
create policy "cups_select_public"
on public.cups
for select
to anon, authenticated
using (true);

drop policy if exists "cups_super_admin_insert" on public.cups;
create policy "cups_super_admin_insert"
on public.cups
for insert
to authenticated
with check (public.is_super_admin());

drop policy if exists "cups_super_admin_update" on public.cups;
create policy "cups_super_admin_update"
on public.cups
for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "cups_super_admin_delete" on public.cups;
create policy "cups_super_admin_delete"
on public.cups
for delete
to authenticated
using (public.is_super_admin());

drop policy if exists "cup_placements_select_public" on public.cup_placements;
create policy "cup_placements_select_public"
on public.cup_placements
for select
to anon, authenticated
using (true);

drop policy if exists "cup_placements_super_admin_insert" on public.cup_placements;
create policy "cup_placements_super_admin_insert"
on public.cup_placements
for insert
to authenticated
with check (public.is_super_admin());

drop policy if exists "cup_placements_super_admin_update" on public.cup_placements;
create policy "cup_placements_super_admin_update"
on public.cup_placements
for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "cup_placements_super_admin_delete" on public.cup_placements;
create policy "cup_placements_super_admin_delete"
on public.cup_placements
for delete
to authenticated
using (public.is_super_admin());

drop policy if exists "score_transactions_super_admin_select" on public.score_transactions;
create policy "score_transactions_super_admin_select"
on public.score_transactions
for select
to authenticated
using (public.is_super_admin());

drop policy if exists "score_transactions_super_admin_insert" on public.score_transactions;
create policy "score_transactions_super_admin_insert"
on public.score_transactions
for insert
to authenticated
with check (public.is_super_admin());

drop policy if exists "score_transactions_super_admin_update" on public.score_transactions;
create policy "score_transactions_super_admin_update"
on public.score_transactions
for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "score_transactions_super_admin_delete" on public.score_transactions;
create policy "score_transactions_super_admin_delete"
on public.score_transactions
for delete
to authenticated
using (public.is_super_admin());

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

create or replace function public.get_cup_user_scores(
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
      c.start_date::timestamptz as starts_at,
      (c.end_date::timestamptz + interval '1 day') as ends_at
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
  start_date date,
  end_date date,
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
    c.start_date,
    c.end_date,
    c.reward_points,
    c.svg_markup,
    c.is_active,
    c.finalized_at,
    c.created_at,
    c.updated_at,
    greatest(
      0,
      extract(epoch from ((c.end_date::timestamptz + interval '1 day') - now()))
    )::bigint as seconds_left
  from public.cups c
  where c.is_active = true
  order by c.start_date desc, c.created_at desc
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
      and c.end_date < current_date
  loop
    perform * from public.finalize_cup_internal(v_cup.id, null);
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

create or replace function public.admin_create_cup(
  p_name text,
  p_start_date date,
  p_end_date date,
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
    p_start_date,
    p_end_date,
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

revoke execute on function public.admin_create_cup(text, date, date, integer, text, boolean) from public;
grant execute on function public.admin_create_cup(text, date, date, integer, text, boolean) to authenticated;

create or replace function public.admin_update_cup(
  p_cup_id uuid,
  p_name text,
  p_start_date date,
  p_end_date date,
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
    start_date = p_start_date,
    end_date = p_end_date,
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

revoke execute on function public.admin_update_cup(uuid, text, date, date, integer, text, boolean) from public;
grant execute on function public.admin_update_cup(uuid, text, date, date, integer, text, boolean) to authenticated;

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

  delete from public.cups c
  where c.id = p_cup_id;
end;
$$;

revoke execute on function public.admin_delete_cup(uuid) from public;
grant execute on function public.admin_delete_cup(uuid) to authenticated;

drop function if exists public.get_admin_cups();
create function public.get_admin_cups()
returns table (
  id uuid,
  name text,
  start_date date,
  end_date date,
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
    c.start_date,
    c.end_date,
    c.reward_points,
    c.svg_markup,
    c.is_active,
    c.finalized_at,
    c.finalized_by,
    c.created_at,
    c.updated_at
  from public.cups c
  order by c.is_active desc, c.start_date desc, c.created_at desc;
end;
$function$;

revoke execute on function public.get_admin_cups() from public;
grant execute on function public.get_admin_cups() to authenticated;

drop function if exists public.get_public_profile_cup_placements(text, integer);
create function public.get_public_profile_cup_placements(
  p_username text,
  p_limit integer default 12
)
returns table (
  cup_id uuid,
  cup_name text,
  placement smallint,
  cup_score numeric,
  reward_points_awarded integer,
  cup_svg_markup text,
  badge_svg_markup text,
  awarded_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $function$
  with target as (
    select
      p.id,
      coalesce(p.hide_score, false) as hide_score
    from public.profiles p
    where lower(p.username) = lower(trim(p_username))
      and coalesce(p.is_frozen, false) = false
      and coalesce(public.is_user_currently_banned(p.id), false) = false
    limit 1
  )
  select
    cp.cup_id,
    c.name as cup_name,
    cp.placement,
    cp.cup_score,
    cp.reward_points_awarded,
    case when cp.placement = 1 then c.svg_markup else null end as cup_svg_markup,
    case when cp.placement in (2, 3) then public.get_default_cup_badge_svg(cp.placement) else null end as badge_svg_markup,
    cp.created_at as awarded_at
  from target t
  join public.cup_placements cp on cp.user_id = t.id
  join public.cups c on c.id = cp.cup_id
  where t.hide_score = false
  order by cp.created_at desc, cp.placement asc
  limit greatest(1, least(coalesce(p_limit, 12), 100));
$function$;

revoke execute on function public.get_public_profile_cup_placements(text, integer) from public;
grant execute on function public.get_public_profile_cup_placements(text, integer) to anon, authenticated;

create or replace function public.get_leaderboard(p_limit integer default 50)
returns table (
  rank integer,
  user_id uuid,
  username text,
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
      coalesce(nullif(prf.username, ''), concat('user_', left(prf.id::text, 6))) as username,
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
      and coalesce(prf.is_frozen, false) = false
      and coalesce(public.is_user_currently_banned(prf.id), false) = false
  )
  select
    r.rank,
    r.user_id,
    r.username,
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

create or replace function public.get_public_profile(
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
      and coalesce(p.is_frozen, false) = false
      and coalesce(public.is_user_currently_banned(p.id), false) = false
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
      and coalesce(prf.is_frozen, false) = false
      and coalesce(public.is_user_currently_banned(prf.id), false) = false
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

do $$
begin
  begin
    create extension if not exists pg_cron;
  exception
    when others then
      raise notice 'pg_cron extension is not available in this environment';
  end;

  begin
    if exists (select 1 from pg_extension where extname = 'pg_cron') then
      if exists (select 1 from cron.job where jobname = 'grapevine-finalize-cups-daily') then
        perform cron.unschedule((select jobid from cron.job where jobname = 'grapevine-finalize-cups-daily' limit 1));
      end if;

      perform cron.schedule(
        'grapevine-finalize-cups-daily',
        '15 0 * * *',
        $cron$select public.finalize_due_cups();$cron$
      );
    end if;
  exception
    when others then
      raise notice 'Could not schedule cup finalization cron job: %', sqlerrm;
  end;
end;
$$;
