-- Make profile bootstrap compatible with Google OAuth users while keeping
-- minimum-age enforcement for non-Google signups.

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider text;
  v_birth_date_text text;
  v_birth_date date;
  v_base_username text;
  v_candidate_username text;
  v_suffix integer := 0;
  v_avatar_url text;
begin
  v_provider := lower(coalesce(new.raw_app_meta_data ->> 'provider', ''));
  v_birth_date_text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'birth_date', '')), '');

  if v_birth_date_text is not null then
    begin
      v_birth_date := v_birth_date_text::date;
    exception
      when others then
        raise exception 'Birth date is invalid';
    end;

    if v_birth_date > (current_date - interval '16 years')::date then
      raise exception 'You must be at least 16 years old to register';
    end if;
  elsif v_provider <> 'google' then
    -- Keep age gate strict for flows that are expected to provide birth date.
    raise exception 'Birth date is required';
  else
    -- Google does not provide birth date in metadata by default.
    v_birth_date := null;
  end if;

  v_base_username := regexp_replace(trim(coalesce(new.raw_user_meta_data ->> 'username', '')), '^@+', '');
  if v_base_username = '' then
    v_base_username := split_part(coalesce(new.email, ''), '@', 1);
  end if;
  if v_base_username = '' then
    v_base_username := concat('user_', left(new.id::text, 8));
  end if;
  v_base_username := lower(regexp_replace(v_base_username, '[^a-zA-Z0-9_]+', '_', 'g'));
  v_base_username := trim(both '_' from regexp_replace(v_base_username, '_{2,}', '_', 'g'));
  if v_base_username = '' then
    v_base_username := concat('user_', left(new.id::text, 8));
  end if;

  v_candidate_username := v_base_username;
  while exists (
    select 1
    from public.profiles p
    where p.id <> new.id
      and p.username = v_candidate_username
  ) loop
    v_suffix := v_suffix + 1;
    v_candidate_username := left(v_base_username, 52) || '_' || v_suffix::text;
  end loop;

  v_avatar_url := nullif(trim(coalesce(new.raw_user_meta_data ->> 'avatar_url', '')), '');
  if v_avatar_url is not null and v_avatar_url !~ '^data:image/(jpeg|png|webp);base64,' then
    -- Keep DB-level avatar payload constraints happy for OAuth providers that send HTTP URLs.
    v_avatar_url := null;
  end if;

  insert into public.profiles (id, username, avatar_url, birth_date, role)
  values (
    new.id,
    v_candidate_username,
    v_avatar_url,
    v_birth_date,
    'user'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
