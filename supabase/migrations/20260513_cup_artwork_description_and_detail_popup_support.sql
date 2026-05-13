-- Cup artwork + description upgrade:
-- - supports non-SVG artwork uploads as data:image URLs
-- - keeps legacy svg_markup for backward compatibility and safe fallback rendering
-- - exposes cup description/artwork in active/admin/profile placement RPCs

alter table public.cups
  add column if not exists description text,
  add column if not exists artwork_url text;

alter table public.cups
  drop constraint if exists cups_description_length_check;

alter table public.cups
  add constraint cups_description_length_check
  check (description is null or char_length(description) <= 800);

create or replace function public.get_default_cup_artwork_svg()
returns text
language sql
immutable
as $$
  select '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140" role="img" aria-label="Cup"><defs><linearGradient id="cupDefault" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#ef4444"/></linearGradient></defs><rect x="10" y="10" width="120" height="120" rx="28" fill="url(#cupDefault)" /><text x="70" y="80" text-anchor="middle" font-size="56">🏆</text></svg>';
$$;

create or replace function public.validate_cup_artwork_url()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_artwork text := trim(coalesce(new.artwork_url, ''));
  v_max_chars integer := 6000000;
begin
  if v_artwork = '' then
    return new;
  end if;

  if v_artwork !~* '^data:image/(svg\\+xml|png|jpe?g|webp|gif|avif|bmp);base64,[a-z0-9+/=]+$' then
    raise exception 'Cup artwork must be a supported base64 data:image payload.' using errcode = '22000';
  end if;

  if char_length(v_artwork) > v_max_chars then
    raise exception 'Cup artwork is too large. Please upload a smaller image.' using errcode = '22000';
  end if;

  return new;
end;
$$;

update public.cups
set description = nullif(trim(description), '')
where description is not null;

update public.cups
set artwork_url = 'data:image/svg+xml;base64,' || encode(convert_to(coalesce(svg_markup, public.get_default_cup_artwork_svg()), 'UTF8'), 'base64')
where artwork_url is null
   or btrim(artwork_url) = '';

drop trigger if exists validate_cup_artwork_url_trigger on public.cups;
create trigger validate_cup_artwork_url_trigger
before insert or update of artwork_url on public.cups
for each row
execute function public.validate_cup_artwork_url();

create or replace function public.normalize_cup_artwork_payload(
  p_artwork_url text,
  p_svg_markup text default null
)
returns table (
  artwork_url text,
  svg_markup text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_artwork text := trim(coalesce(p_artwork_url, ''));
  v_mime text;
  v_svg text;
  v_max_chars integer := 6000000;
  v_matches text[];
begin
  if v_artwork = '' then
    raise exception 'Cup artwork is required';
  end if;

  if char_length(v_artwork) > v_max_chars then
    raise exception 'Cup artwork is too large. Please upload a smaller image.';
  end if;

  if v_artwork !~* '^data:image/(svg\\+xml|png|jpe?g|webp|gif|avif|bmp);base64,[a-z0-9+/=]+$' then
    raise exception 'Cup artwork must be a supported base64 data:image payload.';
  end if;

  v_matches := regexp_match(v_artwork, '^data:image/([^;]+);base64,', 'i');
  if v_matches is null then
    raise exception 'Cup artwork is invalid.';
  end if;

  v_mime := lower(v_matches[1]);

  if v_mime = 'svg+xml' then
    if nullif(trim(coalesce(p_svg_markup, '')), '') is not null then
      v_svg := public.sanitize_cup_svg_markup(p_svg_markup);
    else
      begin
        v_svg := convert_from(decode(split_part(v_artwork, ',', 2), 'base64'), 'UTF8');
      exception
        when others then
          raise exception 'Cup SVG payload is invalid or unreadable.';
      end;
      v_svg := public.sanitize_cup_svg_markup(v_svg);
    end if;

    v_artwork := 'data:image/svg+xml;base64,' || encode(convert_to(v_svg, 'UTF8'), 'base64');
    return query
    select
      v_artwork,
      v_svg;
    return;
  end if;

  return query
  select
    v_artwork,
    public.get_default_cup_artwork_svg();
end;
$$;

-- Active cup payload for leaderboard header/details.
drop function if exists public.get_active_cup();
create function public.get_active_cup()
returns table (
  id uuid,
  name text,
  description text,
  artwork_url text,
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
    c.description,
    coalesce(c.artwork_url, 'data:image/svg+xml;base64,' || encode(convert_to(coalesce(c.svg_markup, public.get_default_cup_artwork_svg()), 'UTF8'), 'base64')) as artwork_url,
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

-- Admin create/update now accepts description + general artwork data URL.
drop function if exists public.admin_create_cup(text, timestamptz, timestamptz, integer, text, boolean);
drop function if exists public.admin_create_cup(text, timestamptz, timestamptz, integer, text, text, text, boolean);
create function public.admin_create_cup(
  p_name text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_reward_points integer,
  p_description text,
  p_artwork_url text,
  p_svg_markup text default null,
  p_is_active boolean default false
)
returns public.cups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cup public.cups;
  v_artwork_url text;
  v_svg_markup text;
begin
  perform public.assert_super_admin();

  select n.artwork_url, n.svg_markup
  into v_artwork_url, v_svg_markup
  from public.normalize_cup_artwork_payload(p_artwork_url, p_svg_markup) n;

  insert into public.cups (
    name,
    description,
    artwork_url,
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
    nullif(trim(coalesce(p_description, '')), ''),
    v_artwork_url,
    p_start_at,
    p_end_at,
    p_start_at::date,
    p_end_at::date,
    greatest(coalesce(p_reward_points, 0), 0),
    coalesce(v_svg_markup, public.get_default_cup_artwork_svg()),
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

revoke execute on function public.admin_create_cup(text, timestamptz, timestamptz, integer, text, text, text, boolean) from public;
grant execute on function public.admin_create_cup(text, timestamptz, timestamptz, integer, text, text, text, boolean) to authenticated;

drop function if exists public.admin_update_cup(uuid, text, timestamptz, timestamptz, integer, text, boolean);
drop function if exists public.admin_update_cup(uuid, text, timestamptz, timestamptz, integer, text, text, text, boolean);
create function public.admin_update_cup(
  p_cup_id uuid,
  p_name text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_reward_points integer,
  p_description text,
  p_artwork_url text,
  p_svg_markup text default null,
  p_is_active boolean default false
)
returns public.cups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cup public.cups;
  v_artwork_url text;
  v_svg_markup text;
begin
  perform public.assert_super_admin();

  select n.artwork_url, n.svg_markup
  into v_artwork_url, v_svg_markup
  from public.normalize_cup_artwork_payload(p_artwork_url, p_svg_markup) n;

  update public.cups
  set
    name = trim(p_name),
    description = nullif(trim(coalesce(p_description, '')), ''),
    artwork_url = v_artwork_url,
    start_at = p_start_at,
    end_at = p_end_at,
    start_date = p_start_at::date,
    end_date = p_end_at::date,
    reward_points = greatest(coalesce(p_reward_points, 0), 0),
    svg_markup = coalesce(v_svg_markup, public.get_default_cup_artwork_svg()),
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

revoke execute on function public.admin_update_cup(uuid, text, timestamptz, timestamptz, integer, text, text, text, boolean) from public;
grant execute on function public.admin_update_cup(uuid, text, timestamptz, timestamptz, integer, text, text, text, boolean) to authenticated;

-- Admin list now includes description + artwork URL.
drop function if exists public.get_admin_cups();
create function public.get_admin_cups()
returns table (
  id uuid,
  name text,
  description text,
  artwork_url text,
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
    c.description,
    coalesce(c.artwork_url, 'data:image/svg+xml;base64,' || encode(convert_to(coalesce(c.svg_markup, public.get_default_cup_artwork_svg()), 'UTF8'), 'base64')) as artwork_url,
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

-- Public cup placements now include cup description/artwork/reward for detail popup content.
drop function if exists public.get_public_profile_cup_placements(text, integer);
create function public.get_public_profile_cup_placements(
  p_username text,
  p_limit integer default 12
)
returns table (
  cup_id uuid,
  cup_name text,
  cup_description text,
  cup_artwork_url text,
  cup_reward_points integer,
  placement smallint,
  cup_score numeric,
  reward_points_awarded integer,
  badge_svg_markup text,
  cup_start_at timestamptz,
  cup_end_at timestamptz,
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
    c.description as cup_description,
    coalesce(c.artwork_url, 'data:image/svg+xml;base64,' || encode(convert_to(coalesce(c.svg_markup, public.get_default_cup_artwork_svg()), 'UTF8'), 'base64')) as cup_artwork_url,
    c.reward_points as cup_reward_points,
    cp.placement,
    cp.cup_score,
    cp.reward_points_awarded,
    case when cp.placement in (2, 3) then public.get_default_cup_badge_svg(cp.placement) else null end as badge_svg_markup,
    coalesce(c.start_at, c.start_date::timestamptz) as cup_start_at,
    coalesce(c.end_at, (c.end_date::timestamptz + interval '1 day' - interval '1 second')) as cup_end_at,
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

-- Own profile cup placements (does not depend on public score visibility setting).
drop function if exists public.get_my_cup_placements(integer);
create function public.get_my_cup_placements(
  p_limit integer default 50
)
returns table (
  cup_id uuid,
  cup_name text,
  cup_description text,
  cup_artwork_url text,
  cup_reward_points integer,
  placement smallint,
  cup_score numeric,
  reward_points_awarded integer,
  badge_svg_markup text,
  cup_start_at timestamptz,
  cup_end_at timestamptz,
  awarded_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $function$
  with me as (
    select auth.uid() as user_id
  )
  select
    cp.cup_id,
    c.name as cup_name,
    c.description as cup_description,
    coalesce(c.artwork_url, 'data:image/svg+xml;base64,' || encode(convert_to(coalesce(c.svg_markup, public.get_default_cup_artwork_svg()), 'UTF8'), 'base64')) as cup_artwork_url,
    c.reward_points as cup_reward_points,
    cp.placement,
    cp.cup_score,
    cp.reward_points_awarded,
    case when cp.placement in (2, 3) then public.get_default_cup_badge_svg(cp.placement) else null end as badge_svg_markup,
    coalesce(c.start_at, c.start_date::timestamptz) as cup_start_at,
    coalesce(c.end_at, (c.end_date::timestamptz + interval '1 day' - interval '1 second')) as cup_end_at,
    cp.created_at as awarded_at
  from me
  join public.cup_placements cp on cp.user_id = me.user_id
  join public.cups c on c.id = cp.cup_id
  where me.user_id is not null
  order by cp.created_at desc, cp.placement asc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
$function$;

revoke execute on function public.get_my_cup_placements(integer) from public;
grant execute on function public.get_my_cup_placements(integer) to authenticated;
