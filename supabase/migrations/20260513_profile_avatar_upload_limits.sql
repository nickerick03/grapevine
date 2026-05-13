-- Enforce safe avatar payload shape/size at DB level for profile avatar_url writes.

create or replace function public.validate_profile_avatar_url()
returns trigger
language plpgsql
as $$
declare
  v_avatar text := new.avatar_url;
  v_max_chars integer := 350000;
begin
  if v_avatar is null or btrim(v_avatar) = '' then
    return new;
  end if;

  if left(v_avatar, 11) <> 'data:image/' then
    raise exception 'Avatar must be a data:image payload.' using errcode = '22000';
  end if;

  if v_avatar !~ '^data:image/(jpeg|png|webp);base64,' then
    raise exception 'Avatar format must be JPG, PNG, or WebP.' using errcode = '22000';
  end if;

  if char_length(v_avatar) > v_max_chars then
    raise exception 'Avatar image is too large. Please upload a smaller file.' using errcode = '22000';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_profile_avatar_url_trigger on public.profiles;
create trigger validate_profile_avatar_url_trigger
before insert or update of avatar_url on public.profiles
for each row
execute function public.validate_profile_avatar_url();
