-- Account freeze mode
-- Frozen accounts are hidden from leaderboard and public review surfaces.
-- Ratings and notes remain stored for later recovery (unfreeze).

alter table public.profiles
  add column if not exists is_frozen boolean not null default false;

update public.profiles
set is_frozen = false
where is_frozen is null;

create index if not exists idx_profiles_is_frozen on public.profiles (is_frozen);

drop policy if exists "place_ratings_select_all" on public.place_ratings;
drop policy if exists "place_ratings_select_active_or_admin" on public.place_ratings;
create policy "place_ratings_select_active_or_admin"
on public.place_ratings
for select
to anon, authenticated
using (
  (
    rating_status = 'active'
    and exists (
      select 1
      from public.profiles owner_profile
      where owner_profile.id = place_ratings.user_id
        and coalesce(owner_profile.is_frozen, false) = false
    )
  )
  or exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'admin'
  )
);

drop policy if exists "place_ratings_insert_own" on public.place_ratings;
create policy "place_ratings_insert_own"
on public.place_ratings
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and coalesce(actor.is_frozen, false) = false
  )
);

drop policy if exists "place_ratings_update_own" on public.place_ratings;
create policy "place_ratings_update_own"
on public.place_ratings
for update
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and coalesce(actor.is_frozen, false) = false
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and coalesce(actor.is_frozen, false) = false
  )
);

drop policy if exists "place_ratings_delete_own" on public.place_ratings;
create policy "place_ratings_delete_own"
on public.place_ratings
for delete
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and coalesce(actor.is_frozen, false) = false
  )
);

create or replace view public.place_vibe_summary as
select
  p.id as place_id,
  count(pr.id)::int as rating_count,
  round(avg(pr.classic_modern)::numeric, 1) as avg_classic_modern,
  round(avg(pr.quiet_lively)::numeric, 1) as avg_quiet_lively,
  round(avg(pr.cheap_premium)::numeric, 1) as avg_cheap_premium,
  round(avg(pr.local_touristy)::numeric, 1) as avg_local_touristy,
  round(avg(pr.cozy_spacious)::numeric, 1) as avg_cozy_spacious,
  round(avg(pr.price_range)::numeric, 1) as avg_price_range,
  case
    when count(pr.id) = 0 then 'No ratings yet'
    when count(pr.id) between 1 and 9 then 'Low confidence'
    when count(pr.id) between 10 and 49 then 'Medium confidence'
    else 'High confidence'
  end::text as confidence_level
from public.places p
left join public.place_ratings pr
  on pr.place_id = p.id
 and pr.rating_status = 'active'
left join public.profiles owner_profile
  on owner_profile.id = pr.user_id
 and coalesce(owner_profile.is_frozen, false) = false
where pr.id is null or owner_profile.id is not null
group by p.id;

grant select on public.place_vibe_summary to anon, authenticated;

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
    join public.profiles owner_profile on owner_profile.id = pr.user_id
    where pr.rating_status = 'active'
      and coalesce(owner_profile.is_frozen, false) = false
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
  scored as (
    select
      rs.user_id,
      rs.reviews_submitted,
      rs.unique_cities_covered,
      rs.notes_submitted,
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
    left join first_rating_stats fr on fr.user_id = rs.user_id
  ),
  ranked as (
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
    from scored s
    join public.profiles prf on prf.id = s.user_id
    where coalesce(prf.hide_score, false) = false
      and coalesce(prf.is_frozen, false) = false
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
      and coalesce(p.is_frozen, false) = false
    limit 1
  ),
  active_ratings as (
    select
      pr.id,
      pr.place_id,
      pr.user_id,
      pr.note,
      pr.created_at,
      pl.city
    from public.place_ratings pr
    join public.places pl on pl.id = pr.place_id
    join public.profiles owner_profile on owner_profile.id = pr.user_id
    where pr.rating_status = 'active'
      and coalesce(owner_profile.is_frozen, false) = false
  ),
  review_stats as (
    select
      ar.user_id,
      count(*)::int as rating_count,
      count(distinct ar.city)::int as city_count,
      count(*) filter (where nullif(trim(ar.note), '') is not null)::int as notes_count
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
      count(*)::int as first_rating_count
    from first_active_place_rating fpr
    group by fpr.user_id
  ),
  scored as (
    select
      rs.user_id,
      rs.rating_count,
      rs.city_count,
      rs.notes_count,
      coalesce(fr.first_rating_count, 0)::int as first_rating_count,
      coalesce(hv.helpful_votes_received, 0)::int as helpful_votes_received,
      round(
        (
          coalesce(hv.helpful_votes_received, 0)::numeric * 0.1
          + coalesce(fr.first_rating_count, 0)::numeric * 5
          + rs.city_count::numeric * 10
          + rs.rating_count::numeric
          + rs.notes_count::numeric * 3
        ),
        1
      ) as grapevine_score
    from review_stats rs
    left join helpful_vote_stats hv on hv.user_id = rs.user_id
    left join first_rating_stats fr on fr.user_id = rs.user_id
  ),
  leaderboard_ranked as (
    select
      row_number() over (
        order by
          s.grapevine_score desc,
          s.first_rating_count desc,
          s.helpful_votes_received desc,
          s.city_count desc,
          s.rating_count desc,
          s.notes_count desc,
          coalesce(prf.updated_at, prf.created_at) asc,
          prf.id asc
      )::int as rank,
      prf.id as user_id
    from scored s
    join public.profiles prf on prf.id = s.user_id
    where coalesce(prf.hide_score, false) = false
      and coalesce(prf.is_frozen, false) = false
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
    coalesce(s.rating_count, 0)::int as rating_count,
    coalesce(s.city_count, 0)::int as city_count,
    coalesce(s.notes_count, 0)::int as notes_count,
    coalesce(s.first_rating_count, 0)::int as first_rating_count,
    coalesce(s.helpful_votes_received, 0)::int as helpful_votes_received,
    coalesce(s.grapevine_score, 0)::numeric as grapevine_score,
    case when t.hide_score then null else lr.rank end as leaderboard_rank,
    t.created_at
  from target t
  left join scored s on s.user_id = t.id
  left join leaderboard_ranked lr on lr.user_id = t.id;
$function$;

revoke execute on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;

create or replace function public.get_public_profile_notes(
  p_username text,
  p_limit integer default 300
)
returns table (
  rating_id uuid,
  place_id uuid,
  place_name text,
  place_city text,
  note text,
  noted_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $function$
  with target as (
    select
      p.id,
      coalesce(p.show_public_notes, true) as show_public_notes
    from public.profiles p
    where lower(p.username) = lower(trim(p_username))
      and coalesce(p.is_frozen, false) = false
    limit 1
  )
  select
    pr.id as rating_id,
    pl.id as place_id,
    pl.name as place_name,
    pl.city as place_city,
    pr.note,
    coalesce(pr.updated_at, pr.created_at) as noted_at
  from target t
  join public.place_ratings pr
    on pr.user_id = t.id
   and pr.rating_status = 'active'
  join public.places pl
    on pl.id = pr.place_id
  where t.show_public_notes = true
    and nullif(trim(pr.note), '') is not null
  order by coalesce(pr.updated_at, pr.created_at) desc
  limit greatest(1, least(coalesce(p_limit, 300), 1000));
$function$;

revoke execute on function public.get_public_profile_notes(text, integer) from public;
grant execute on function public.get_public_profile_notes(text, integer) to anon, authenticated;

create or replace function public.get_place_note_feed(
  p_place_id uuid,
  p_limit integer default 6
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
  my_vote smallint,
  flagged_by_me boolean
)
language sql
stable
security definer
set search_path = public
as $function$
  with note_rows as (
    select
      pr.id as rating_id,
      pr.user_id,
      coalesce(nullif(pf.username, ''), concat('user_', left(pr.user_id::text, 6))) as username,
      pf.avatar_url,
      coalesce(nullif(pf.emoji, ''), '🦊') as emoji,
      coalesce(nullif(pf.gradient_from, ''), '#F59E0B') as gradient_from,
      coalesce(nullif(pf.gradient_to, ''), '#EF4444') as gradient_to,
      pr.note,
      pr.note_original,
      coalesce(pr.updated_at, pr.created_at) as noted_at,
      pr.note_edited_at
    from public.place_ratings pr
    join public.profiles pf on pf.id = pr.user_id
    where pr.place_id = p_place_id
      and pr.rating_status = 'active'
      and coalesce(pf.is_frozen, false) = false
      and nullif(trim(pr.note), '') is not null
    order by coalesce(pr.updated_at, pr.created_at) desc
    limit greatest(1, least(coalesce(p_limit, 6), 50))
  )
  select
    nr.rating_id,
    nr.user_id,
    nr.username,
    nr.avatar_url,
    nr.emoji,
    nr.gradient_from,
    nr.gradient_to,
    nr.note,
    nr.note_original,
    nr.noted_at,
    nr.note_edited_at,
    (nr.note_edited_at is not null or nullif(trim(nr.note_original), '') is not null) as is_edited,
    coalesce((
      select count(*)
      from public.place_rating_note_votes v
      where v.rating_id = nr.rating_id and v.vote = 1
    ), 0)::int as upvotes,
    coalesce((
      select count(*)
      from public.place_rating_note_votes v
      where v.rating_id = nr.rating_id and v.vote = -1
    ), 0)::int as downvotes,
    (
      select v.vote
      from public.place_rating_note_votes v
      where v.rating_id = nr.rating_id
        and v.user_id = auth.uid()
      limit 1
    )::smallint as my_vote,
    exists (
      select 1
      from public.place_rating_note_flags f
      where f.rating_id = nr.rating_id
        and f.user_id = auth.uid()
    ) as flagged_by_me
  from note_rows nr
  order by nr.noted_at desc;
$function$;

revoke execute on function public.get_place_note_feed(uuid, integer) from public;
grant execute on function public.get_place_note_feed(uuid, integer) to anon, authenticated;
