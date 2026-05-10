-- Remove legacy profiles.display_name and make username the canonical public identity.

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_birth_date_text text;
  v_birth_date date;
  v_username text;
begin
  v_birth_date_text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'birth_date', '')), '');

  if v_birth_date_text is null then
    raise exception 'Birth date is required';
  end if;

  begin
    v_birth_date := v_birth_date_text::date;
  exception
    when others then
      raise exception 'Birth date is invalid';
  end;

  if v_birth_date > (current_date - interval '16 years')::date then
    raise exception 'You must be at least 16 years old to register';
  end if;

  v_username := regexp_replace(trim(coalesce(new.raw_user_meta_data ->> 'username', '')), '^@+', '');
  if v_username = '' then
    v_username := split_part(coalesce(new.email, ''), '@', 1);
  end if;
  if v_username = '' then
    v_username := concat('user_', left(new.id::text, 8));
  end if;

  insert into public.profiles (id, username, avatar_url, birth_date, role)
  values (
    new.id,
    v_username,
    new.raw_user_meta_data ->> 'avatar_url',
    v_birth_date,
    'user'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

do $$
declare
  row_record record;
  base_username text;
  candidate_username text;
  suffix_counter integer;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'display_name'
  ) then
    for row_record in
      select p.id, p.display_name
      from public.profiles p
      where coalesce(trim(p.username), '') = ''
        and coalesce(trim(p.display_name), '') <> ''
    loop
      base_username := regexp_replace(trim(row_record.display_name), '^@+', '');
      if base_username = '' then
        base_username := concat('user_', left(row_record.id::text, 8));
      end if;

      candidate_username := base_username;
      suffix_counter := 1;

      while exists (
        select 1
        from public.profiles p2
        where p2.id <> row_record.id
          and p2.username = candidate_username
      ) loop
        candidate_username := concat(base_username, '_', suffix_counter::text);
        suffix_counter := suffix_counter + 1;

        if suffix_counter > 500 then
          candidate_username := concat('user_', left(row_record.id::text, 8));
          exit;
        end if;
      end loop;

      update public.profiles
      set username = candidate_username
      where id = row_record.id;
    end loop;
  end if;

  update public.profiles p
  set username = concat('user_', left(p.id::text, 8))
  where coalesce(trim(p.username), '') = '';
end;
$$;

drop function if exists public.get_leaderboard(integer);
create function public.get_leaderboard(p_limit integer default 50)
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
    from scored s
    join public.profiles prf on prf.id = s.user_id
    where coalesce(prf.hide_score, false) = false
      and coalesce(prf.is_frozen, false) = false
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

alter table public.profiles
  drop column if exists display_name;

