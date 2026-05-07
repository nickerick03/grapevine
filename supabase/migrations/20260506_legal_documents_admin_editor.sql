-- Legal documents CMS for admin-managed legal pages.

create table if not exists public.legal_documents (
  document_key text primary key,
  title text not null,
  content text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  constraint legal_documents_key_check check (
    document_key in (
      'privacy-policy',
      'cookie-policy',
      'terms-of-service',
      'impressum',
      'data-deletion',
      'contact'
    )
  )
);

create index if not exists idx_legal_documents_updated_at
  on public.legal_documents(updated_at desc);

insert into public.legal_documents (document_key, title, content)
values
  ('privacy-policy', 'Privacy Policy', ''),
  ('cookie-policy', 'Cookie Policy', ''),
  ('terms-of-service', 'Terms of Service / ÁSZF', ''),
  ('impressum', 'Impressum / Company Information', ''),
  ('data-deletion', 'Data Deletion Request', ''),
  ('contact', 'Contact', '')
on conflict (document_key) do nothing;

drop trigger if exists set_legal_documents_updated_at on public.legal_documents;
create trigger set_legal_documents_updated_at
before update on public.legal_documents
for each row
execute function public.set_updated_at();

alter table public.legal_documents enable row level security;

drop policy if exists "legal_documents_select_all" on public.legal_documents;
create policy "legal_documents_select_all"
on public.legal_documents
for select
to anon, authenticated
using (true);

drop policy if exists "legal_documents_insert_super_admin" on public.legal_documents;
create policy "legal_documents_insert_super_admin"
on public.legal_documents
for insert
to authenticated
with check (public.is_super_admin());

drop policy if exists "legal_documents_update_super_admin" on public.legal_documents;
create policy "legal_documents_update_super_admin"
on public.legal_documents
for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "legal_documents_delete_super_admin" on public.legal_documents;
create policy "legal_documents_delete_super_admin"
on public.legal_documents
for delete
to authenticated
using (public.is_super_admin());

create or replace function public.upsert_legal_document(
  p_document_key text,
  p_title text,
  p_content text
)
returns public.legal_documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document public.legal_documents;
  v_title text;
begin
  perform public.assert_super_admin();

  if p_document_key is null or btrim(p_document_key) = '' then
    raise exception 'Document key is required';
  end if;

  v_title := coalesce(nullif(btrim(p_title), ''), initcap(replace(btrim(p_document_key), '-', ' ')));

  insert into public.legal_documents (document_key, title, content, updated_by)
  values (
    btrim(p_document_key),
    v_title,
    coalesce(p_content, ''),
    auth.uid()
  )
  on conflict (document_key)
  do update set
    title = excluded.title,
    content = excluded.content,
    updated_by = auth.uid(),
    updated_at = now()
  returning * into v_document;

  return v_document;
end;
$$;

revoke execute on function public.upsert_legal_document(text, text, text) from public;
revoke execute on function public.upsert_legal_document(text, text, text) from anon;
grant execute on function public.upsert_legal_document(text, text, text) to authenticated;
