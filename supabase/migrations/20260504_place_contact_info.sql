-- Persist optional contact details for places discovered from OSM.

alter table public.places
  add column if not exists opening_hours text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists website text;

drop function if exists public.upsert_external_place_first_rating(
  text,
  text,
  text,
  text,
  text,
  integer,
  text,
  text,
  text,
  double precision,
  double precision,
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  integer,
  text,
  text
);

drop function if exists public.upsert_external_place_first_rating(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  double precision,
  double precision,
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  integer,
  text,
  text
);

create or replace function public.upsert_external_place_first_rating(
  p_source_provider text,
  p_source_place_id text,
  p_name text,
  p_category text,
  p_venue_type text,
  p_price_range integer,
  p_address text,
  p_city text,
  p_country text,
  p_latitude double precision,
  p_longitude double precision,
  p_description text,
  p_image_url text,
  p_opening_hours text,
  p_phone text,
  p_email text,
  p_website text,
  p_classic_modern integer,
  p_quiet_lively integer,
  p_cheap_premium integer,
  p_local_touristy integer,
  p_cozy_spacious integer,
  p_visit_context text,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid;
  v_place_id uuid;
  v_slug_base text;
  v_slug text;
  v_category text;
  v_venue_type text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_source_provider is null or btrim(p_source_provider) = '' then
    raise exception 'source provider is required';
  end if;

  if p_source_place_id is null or btrim(p_source_place_id) = '' then
    raise exception 'source place id is required';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'place name is required';
  end if;

  if p_classic_modern not between 0 and 100
    or p_quiet_lively not between 0 and 100
    or p_cheap_premium not between 0 and 100
    or p_local_touristy not between 0 and 100
    or p_cozy_spacious not between 0 and 100
  then
    raise exception 'rating values must be between 0 and 100';
  end if;

  if p_note is not null and char_length(p_note) > 160 then
    raise exception 'note must be at most 160 chars';
  end if;

  if p_visit_context is not null and p_visit_context not in ('Weekday afternoon', 'Weekday evening', 'Weekend afternoon', 'Weekend evening', 'Late night') then
    raise exception 'invalid visit context';
  end if;

  if p_price_range is not null and (p_price_range < 1 or p_price_range > 4) then
    raise exception 'price range must be between 1 and 4';
  end if;

  v_category := coalesce(nullif(lower(btrim(p_category)), ''), 'bar');

  v_venue_type := nullif(lower(btrim(coalesce(p_venue_type, ''))), '');
  if v_venue_type is null then
    if v_category in ('restaurant', 'fast_food', 'fast food') then
      v_venue_type := 'restaurant';
    elsif v_category in ('cafe', 'coffee') then
      v_venue_type := 'cafe';
    else
      v_venue_type := 'bar';
    end if;
  end if;

  if v_venue_type not in ('bar', 'cafe', 'restaurant') then
    raise exception 'invalid venue type';
  end if;

  select p.id
    into v_place_id
  from public.places p
  where p.source_provider = lower(btrim(p_source_provider))
    and p.source_place_id = btrim(p_source_place_id)
  limit 1;

  if v_place_id is null then
    v_slug_base := regexp_replace(lower(btrim(p_name)), '[^a-z0-9]+', '-', 'g');
    v_slug_base := regexp_replace(v_slug_base, '^-+|-+$', '', 'g');

    if v_slug_base = '' then
      v_slug_base := 'place';
    end if;

    v_slug := left(v_slug_base, 50) || '-' || substring(md5(lower(btrim(p_source_provider)) || ':' || btrim(p_source_place_id)) for 8);

    insert into public.places (
      name,
      slug,
      category,
      venue_type,
      address,
      city,
      country,
      latitude,
      longitude,
      description,
      image_url,
      opening_hours,
      phone,
      email,
      website,
      source_provider,
      source_place_id,
      created_by,
      is_published
    )
    values (
      btrim(p_name),
      v_slug,
      v_category,
      v_venue_type,
      nullif(btrim(p_address), ''),
      coalesce(nullif(btrim(p_city), ''), 'Budapest'),
      coalesce(nullif(btrim(p_country), ''), 'Hungary'),
      p_latitude,
      p_longitude,
      nullif(p_description, ''),
      nullif(p_image_url, ''),
      nullif(p_opening_hours, ''),
      nullif(p_phone, ''),
      nullif(p_email, ''),
      nullif(p_website, ''),
      lower(btrim(p_source_provider)),
      btrim(p_source_place_id),
      v_user_id,
      true
    )
    on conflict (source_provider, source_place_id)
    do update set
      name = excluded.name,
      category = excluded.category,
      venue_type = excluded.venue_type,
      address = coalesce(excluded.address, public.places.address),
      city = excluded.city,
      country = excluded.country,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      description = coalesce(excluded.description, public.places.description),
      image_url = coalesce(excluded.image_url, public.places.image_url),
      opening_hours = coalesce(excluded.opening_hours, public.places.opening_hours),
      phone = coalesce(excluded.phone, public.places.phone),
      email = coalesce(excluded.email, public.places.email),
      website = coalesce(excluded.website, public.places.website),
      updated_at = now()
    returning id into v_place_id;
  else
    update public.places
    set
      name = coalesce(nullif(btrim(p_name), ''), name),
      category = v_category,
      venue_type = v_venue_type,
      address = coalesce(nullif(btrim(p_address), ''), address),
      city = coalesce(nullif(btrim(p_city), ''), city),
      country = coalesce(nullif(btrim(p_country), ''), country),
      latitude = p_latitude,
      longitude = p_longitude,
      description = coalesce(nullif(p_description, ''), description),
      image_url = coalesce(nullif(p_image_url, ''), image_url),
      opening_hours = coalesce(nullif(p_opening_hours, ''), opening_hours),
      phone = coalesce(nullif(p_phone, ''), phone),
      email = coalesce(nullif(p_email, ''), email),
      website = coalesce(nullif(p_website, ''), website),
      updated_at = now()
    where id = v_place_id;
  end if;

  insert into public.place_ratings (
    place_id,
    user_id,
    classic_modern,
    quiet_lively,
    cheap_premium,
    local_touristy,
    cozy_spacious,
    price_range,
    visit_context,
    note
  )
  values (
    v_place_id,
    v_user_id,
    p_classic_modern,
    p_quiet_lively,
    p_cheap_premium,
    p_local_touristy,
    p_cozy_spacious,
    p_price_range,
    p_visit_context,
    nullif(p_note, '')
  )
  on conflict (place_id, user_id)
  do update set
    classic_modern = excluded.classic_modern,
    quiet_lively = excluded.quiet_lively,
    cheap_premium = excluded.cheap_premium,
    local_touristy = excluded.local_touristy,
    cozy_spacious = excluded.cozy_spacious,
    price_range = excluded.price_range,
    visit_context = excluded.visit_context,
    note = excluded.note,
    updated_at = now();

  return v_place_id;
end;
$function$;

revoke execute on function public.upsert_external_place_first_rating(
  text,
  text,
  text,
  text,
  text,
  integer,
  text,
  text,
  text,
  double precision,
  double precision,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  integer,
  text,
  text
) from public;

revoke execute on function public.upsert_external_place_first_rating(
  text,
  text,
  text,
  text,
  text,
  integer,
  text,
  text,
  text,
  double precision,
  double precision,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  integer,
  text,
  text
) from anon;

grant execute on function public.upsert_external_place_first_rating(
  text,
  text,
  text,
  text,
  text,
  integer,
  text,
  text,
  text,
  double precision,
  double precision,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  integer,
  text,
  text
) to authenticated;
