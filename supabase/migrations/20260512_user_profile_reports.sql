-- User profile reporting flow
-- Adds report storage, anti-spam submission RPC, and admin moderation RPCs.

create table if not exists public.user_profile_reports (
  id uuid primary key default gen_random_uuid(),
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text null,
  message text null,
  status text not null default 'open',
  admin_note text null,
  reviewed_at timestamptz null,
  reviewed_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profile_reports_status_check check (status in ('open', 'reviewed', 'dismissed', 'resolved')),
  constraint user_profile_reports_reason_check check (
    reason is null or reason in ('harassment', 'spam', 'impersonation', 'inappropriate', 'other')
  ),
  constraint user_profile_reports_message_len_check check (message is null or char_length(message) <= 280),
  constraint user_profile_reports_not_self check (reported_user_id <> reporter_id)
);

create index if not exists idx_user_profile_reports_reported_status_created
  on public.user_profile_reports (reported_user_id, status, created_at desc);

create index if not exists idx_user_profile_reports_reporter_created
  on public.user_profile_reports (reporter_id, created_at desc);

create index if not exists idx_user_profile_reports_status_created
  on public.user_profile_reports (status, created_at desc);

alter table public.user_profile_reports enable row level security;

drop trigger if exists set_user_profile_reports_updated_at on public.user_profile_reports;
create trigger set_user_profile_reports_updated_at
before update on public.user_profile_reports
for each row execute procedure public.handle_updated_at();

drop policy if exists "user_profile_reports_insert_own" on public.user_profile_reports;
create policy "user_profile_reports_insert_own"
on public.user_profile_reports
for insert
to authenticated
with check (auth.uid() = reporter_id and reported_user_id <> auth.uid());

drop policy if exists "user_profile_reports_select_own" on public.user_profile_reports;
create policy "user_profile_reports_select_own"
on public.user_profile_reports
for select
to authenticated
using (auth.uid() = reporter_id);

drop policy if exists "user_profile_reports_admin_select_all" on public.user_profile_reports;
create policy "user_profile_reports_admin_select_all"
on public.user_profile_reports
for select
to authenticated
using (public.is_super_admin());

drop policy if exists "user_profile_reports_admin_update_all" on public.user_profile_reports;
create policy "user_profile_reports_admin_update_all"
on public.user_profile_reports
for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "user_profile_reports_admin_delete_all" on public.user_profile_reports;
create policy "user_profile_reports_admin_delete_all"
on public.user_profile_reports
for delete
to authenticated
using (public.is_super_admin());

create or replace function public.submit_user_profile_report(
  p_reported_user_id uuid,
  p_reason text default null,
  p_message text default null
)
returns table(
  report_id uuid,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_message text := nullif(trim(coalesce(p_message, '')), '');
  v_existing_id uuid;
  v_existing_created_at timestamptz;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = 'P0001';
  end if;

  if p_reported_user_id is null then
    raise exception 'Reported user is required' using errcode = 'P0001';
  end if;

  if p_reported_user_id = v_actor then
    raise exception 'You cannot report your own profile' using errcode = 'P0001';
  end if;

  if v_reason is not null and v_reason not in ('harassment', 'spam', 'impersonation', 'inappropriate', 'other') then
    raise exception 'Invalid report reason' using errcode = 'P0001';
  end if;

  if v_message is not null and char_length(v_message) > 280 then
    raise exception 'Message is too long' using errcode = 'P0001';
  end if;

  select r.id, r.created_at
  into v_existing_id, v_existing_created_at
  from public.user_profile_reports r
  where r.reporter_id = v_actor
    and r.reported_user_id = p_reported_user_id
    and coalesce(r.reason, '') = coalesce(v_reason, '')
    and coalesce(r.message, '') = coalesce(v_message, '')
    and r.created_at > now() - interval '12 hours'
  order by r.created_at desc
  limit 1;

  if v_existing_id is not null then
    return query select v_existing_id, 'duplicate_blocked'::text, v_existing_created_at;
    return;
  end if;

  insert into public.user_profile_reports (
    reported_user_id,
    reporter_id,
    reason,
    message,
    status
  )
  values (
    p_reported_user_id,
    v_actor,
    v_reason,
    v_message,
    'open'
  )
  returning id, user_profile_reports.status, user_profile_reports.created_at
  into report_id, status, created_at;

  return next;
end;
$$;

revoke execute on function public.submit_user_profile_report(uuid, text, text) from public;
revoke execute on function public.submit_user_profile_report(uuid, text, text) from anon;
grant execute on function public.submit_user_profile_report(uuid, text, text) to authenticated;

create or replace function public.get_admin_user_profile_reports(
  p_limit integer default 200,
  p_offset integer default 0,
  p_query text default null,
  p_status text default null
)
returns table(
  id uuid,
  reported_user_id uuid,
  reported_username text,
  reported_email text,
  reporter_id uuid,
  reporter_username text,
  reporter_email text,
  reason text,
  message text,
  status text,
  admin_note text,
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 200), 1000));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_query text := nullif(trim(coalesce(p_query, '')), '');
  v_status text := nullif(trim(coalesce(p_status, '')), '');
begin
  perform public.assert_super_admin();

  return query
  select
    r.id,
    r.reported_user_id,
    coalesce(reported.username, 'grapevine_user') as reported_username,
    reported_user.email::text as reported_email,
    r.reporter_id,
    coalesce(reporter.username, 'grapevine_user') as reporter_username,
    reporter_user.email::text as reporter_email,
    r.reason,
    r.message,
    r.status,
    r.admin_note,
    r.reviewed_at,
    r.reviewed_by,
    r.created_at,
    r.updated_at
  from public.user_profile_reports r
  join public.profiles reported on reported.id = r.reported_user_id
  join public.profiles reporter on reporter.id = r.reporter_id
  left join auth.users reported_user on reported_user.id = r.reported_user_id
  left join auth.users reporter_user on reporter_user.id = r.reporter_id
  where (
    v_status is null
    or r.status = v_status
  )
  and (
    v_query is null
    or coalesce(reported.username, '') ilike '%' || v_query || '%'
    or coalesce(reporter.username, '') ilike '%' || v_query || '%'
    or coalesce(reported_user.email::text, '') ilike '%' || v_query || '%'
    or coalesce(reporter_user.email::text, '') ilike '%' || v_query || '%'
    or coalesce(r.message, '') ilike '%' || v_query || '%'
    or coalesce(r.reason, '') ilike '%' || v_query || '%'
  )
  order by r.created_at desc
  limit v_limit
  offset v_offset;
end;
$$;

revoke execute on function public.get_admin_user_profile_reports(integer, integer, text, text) from public;
revoke execute on function public.get_admin_user_profile_reports(integer, integer, text, text) from anon;
grant execute on function public.get_admin_user_profile_reports(integer, integer, text, text) to authenticated;

create or replace function public.admin_update_user_profile_report(
  p_report_id uuid,
  p_status text default null,
  p_admin_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text := nullif(trim(coalesce(p_status, '')), '');
  v_note text := nullif(trim(coalesce(p_admin_note, '')), '');
begin
  perform public.assert_super_admin();

  if p_report_id is null then
    raise exception 'Report id is required' using errcode = 'P0001';
  end if;

  if v_status is not null and v_status not in ('open', 'reviewed', 'dismissed', 'resolved') then
    raise exception 'Invalid status' using errcode = 'P0001';
  end if;

  update public.user_profile_reports r
  set
    status = coalesce(v_status, r.status),
    admin_note = coalesce(v_note, r.admin_note),
    reviewed_at = case when v_status is not null then now() else r.reviewed_at end,
    reviewed_by = case when v_status is not null then auth.uid() else r.reviewed_by end
  where r.id = p_report_id;

  if not found then
    raise exception 'Report not found' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.admin_update_user_profile_report(uuid, text, text) from public;
revoke execute on function public.admin_update_user_profile_report(uuid, text, text) from anon;
grant execute on function public.admin_update_user_profile_report(uuid, text, text) to authenticated;
