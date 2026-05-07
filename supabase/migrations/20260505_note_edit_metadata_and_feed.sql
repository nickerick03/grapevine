-- Note edit metadata + note-feed fields for "show original" and note owner actions
-- Run after:
-- - 20260503_init_grapevine.sql
-- - 20260503_rating_moderation.sql
-- - 20260504_note_cards_feedback_and_public_profiles.sql

alter table public.place_ratings
  add column if not exists note_original text,
  add column if not exists note_edited_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'place_ratings_note_original_length_check'
      and conrelid = 'public.place_ratings'::regclass
  ) then
    alter table public.place_ratings
      add constraint place_ratings_note_original_length_check
      check (note_original is null or char_length(note_original) <= 160);
  end if;
end $$;

create or replace function public.track_place_rating_note_edits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_note text := nullif(trim(old.note), '');
  new_note text := nullif(trim(new.note), '');
  old_original text := nullif(trim(old.note_original), '');
begin
  if tg_op = 'UPDATE' then
    if new_note is distinct from old_note then
      if new_note is null then
        new.note = null;
        new.note_original = null;
        new.note_edited_at = null;
      else
        new.note = left(new_note, 160);

        if old_note is not null then
          if old_original is null then
            new.note_original = left(old_note, 160);
          else
            new.note_original = old.note_original;
          end if;

          new.note_edited_at = now();
        else
          -- First note add is not considered an edit.
          new.note_original = null;
          new.note_edited_at = null;
        end if;
      end if;
    else
      if new_note is null then
        new.note_original = null;
        new.note_edited_at = null;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists set_place_rating_note_edit_metadata on public.place_ratings;
create trigger set_place_rating_note_edit_metadata
before update on public.place_ratings
for each row
execute function public.track_place_rating_note_edits();

drop function if exists public.get_place_note_feed(uuid, integer);
create function public.get_place_note_feed(
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
