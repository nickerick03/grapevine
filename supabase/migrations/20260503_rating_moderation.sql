-- Rating moderation and anti-bombing controls
-- Keeps each rating row individual, but allows admin revocation without deleting evidence.

alter table public.place_ratings
  add column if not exists rating_status text not null default 'active'
    check (rating_status in ('active', 'revoked')),
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid references public.profiles(id),
  add column if not exists revocation_reason text check (char_length(revocation_reason) <= 280);

update public.place_ratings
set rating_status = 'active'
where rating_status is null;

create index if not exists idx_place_ratings_active_place
  on public.place_ratings(place_id)
  where rating_status = 'active';

create index if not exists idx_place_ratings_status
  on public.place_ratings(rating_status);

create or replace function public.prevent_place_rating_moderation_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_is_admin boolean;
begin
  if (
    new.rating_status is distinct from old.rating_status
    or new.revoked_at is distinct from old.revoked_at
    or new.revoked_by is distinct from old.revoked_by
    or new.revocation_reason is distinct from old.revocation_reason
  ) then
    select exists (
      select 1
      from public.profiles profile
      where profile.id = auth.uid()
        and profile.role = 'admin'
    ) into actor_is_admin;

    if not actor_is_admin then
      raise exception 'Only admins can modify rating moderation fields';
    end if;
  end if;

  if new.rating_status = 'active' then
    new.revoked_at = null;
    new.revoked_by = null;
    new.revocation_reason = null;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_place_rating_moderation_changes_trigger on public.place_ratings;
create trigger prevent_place_rating_moderation_changes_trigger
before update on public.place_ratings
for each row
execute function public.prevent_place_rating_moderation_changes();

create or replace function public.admin_revoke_place_rating(
  p_rating_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_is_admin boolean;
begin
  select exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'admin'
  ) into actor_is_admin;

  if not actor_is_admin then
    raise exception 'Only admins can revoke ratings';
  end if;

  update public.place_ratings
  set
    rating_status = 'revoked',
    revoked_at = now(),
    revoked_by = auth.uid(),
    revocation_reason = nullif(trim(p_reason), ''),
    updated_at = now()
  where id = p_rating_id;

  if not found then
    raise exception 'Rating not found';
  end if;
end;
$$;

create or replace function public.admin_restore_place_rating(
  p_rating_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_is_admin boolean;
begin
  select exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'admin'
  ) into actor_is_admin;

  if not actor_is_admin then
    raise exception 'Only admins can restore ratings';
  end if;

  update public.place_ratings
  set
    rating_status = 'active',
    revoked_at = null,
    revoked_by = null,
    revocation_reason = null,
    updated_at = now()
  where id = p_rating_id;

  if not found then
    raise exception 'Rating not found';
  end if;
end;
$$;

revoke execute on function public.admin_revoke_place_rating(uuid, text) from public;
revoke execute on function public.admin_revoke_place_rating(uuid, text) from anon;
grant execute on function public.admin_revoke_place_rating(uuid, text) to authenticated;

revoke execute on function public.admin_restore_place_rating(uuid) from public;
revoke execute on function public.admin_restore_place_rating(uuid) from anon;
grant execute on function public.admin_restore_place_rating(uuid) to authenticated;

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
group by p.id;

drop policy if exists "place_ratings_select_all" on public.place_ratings;
create policy "place_ratings_select_active_or_admin"
on public.place_ratings
for select
to anon, authenticated
using (
  rating_status = 'active'
  or exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'admin'
  )
);
