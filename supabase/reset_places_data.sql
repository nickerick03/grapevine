-- DANGER: This clears all place content data while keeping user accounts/profiles.
-- Run in Supabase SQL Editor when you want a clean place dataset.

begin;

delete from public.saved_places;
delete from public.place_ratings;
delete from public.places;

commit;
