alter table public.place_ratings
  add column if not exists visit_contexts text[];

update public.place_ratings
set visit_contexts = array[visit_context]
where visit_context is not null
  and (visit_contexts is null or cardinality(visit_contexts) = 0);

alter table public.place_ratings
  drop constraint if exists place_ratings_visit_contexts_check;

alter table public.place_ratings
  add constraint place_ratings_visit_contexts_check
  check (
    visit_contexts is null
    or (
      cardinality(visit_contexts) <= 5
      and visit_contexts <@ array[
        'Weekday afternoon',
        'Weekday evening',
        'Weekend afternoon',
        'Weekend evening',
        'Late night'
      ]::text[]
    )
  );

create or replace function public.sync_place_rating_visit_context_fields()
returns trigger
language plpgsql
as $$
begin
  if new.visit_contexts is not null and cardinality(new.visit_contexts) > 0 then
    new.visit_context := new.visit_contexts[1];
  elsif new.visit_context is not null then
    new.visit_contexts := array[new.visit_context];
  end if;

  return new;
end;
$$;

drop trigger if exists sync_place_rating_visit_context_fields_trigger on public.place_ratings;

create trigger sync_place_rating_visit_context_fields_trigger
before insert or update on public.place_ratings
for each row
execute function public.sync_place_rating_visit_context_fields();
