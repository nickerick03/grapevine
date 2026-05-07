-- Enforce birth date collection and 16+ registration gate.

alter table public.profiles
  add column if not exists birth_date date;

alter table public.profiles
  drop constraint if exists profiles_birth_date_min_age_check;

alter table public.profiles
  add constraint profiles_birth_date_min_age_check
  check (
    birth_date is null
    or birth_date <= (current_date - interval '16 years')::date
  );

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_birth_date_text text;
  v_birth_date date;
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

  insert into public.profiles (id, username, display_name, avatar_url, birth_date, role)
  values (
    new.id,
    null,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    v_birth_date,
    'user'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
