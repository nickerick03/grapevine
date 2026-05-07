# Grapevine MVP

Grapevine is a place-discovery web app where each place gets a community-built vibe profile from five sliders.

This repository keeps the Figma Make visual direction and now connects it to Supabase for real auth, data, ratings, and saved places.

## Stack

- React + Vite + TypeScript
- Tailwind CSS
- React Router
- Leaflet + OpenStreetMap
- Supabase (Auth + Postgres + RLS)

## Local setup

1. Install dependencies:
   - `npm install`
2. Create local env file:
   - `cp .env.example .env.local`
3. Fill env variables:
   - `VITE_SUPABASE_URL=...`
   - `VITE_SUPABASE_ANON_KEY=...`
   - `VITE_SITE_URL=http://localhost:5173`
4. Start app:
   - `npm run dev`

## Database setup (Supabase)

Run these SQL files in Supabase SQL Editor, in order:

1. `supabase/migrations/20260503_init_grapevine.sql`
2. `supabase/migrations/20260503_external_osm_first_rating.sql`
3. `supabase/migrations/20260503_rating_moderation.sql`
4. `supabase/migrations/20260504_place_venue_type_price_range.sql`
5. `supabase/migrations/20260504_profile_preferences_and_leaderboard.sql`

This creates:

- `profiles`
- `places`
- `place_ratings`
- `saved_places`
- `place_vibe_summary` view
- RLS policies
- profile auto-create trigger on signup
- `updated_at` triggers

`supabase/seed.sql` is intentionally empty now (no sample/demo places).

If you want to wipe existing place content and start fresh, run:

- `supabase/reset_places_data.sql`

This clears `places`, `place_ratings`, and `saved_places`, but keeps auth users/profiles.

## What is connected

- Explore loads real `places` from Supabase
- Place detail shows live summary, notes, and similar places
- Login/register works with Supabase Auth
- Edit profile, avatar/photo, and password update are wired to Supabase
- Leaderboard loads real ranked users from Supabase (and respects hidden scores)
- Rating submit/update upserts one rating per user/place
- Saved places are Supabase-backed (no local-only fallback)
- Nearby uses geolocation + map markers from loaded places
- Explore can include OSM places without stored profiles, and first rating creates the Supabase place row automatically

## Auth notes

- Frontend uses only publishable URL + anon key.
- Do not expose service role key in client code.
- For production, configure Auth redirect URLs in Supabase:
  - `http://localhost:5173`
  - your deployed domain

## RLS summary

- `profiles`: user can read/update own profile; role escalation blocked by trigger.
- `places`: public can read published; only admins can write.
- `place_ratings`: public read; authenticated users can CRUD only their own rows.
- `saved_places`: authenticated users can CRUD only their own rows.

## Useful scripts

- `npm run dev`
- `npm run typecheck`
- `npm run build`

## Legal and launch TODO

- Finalize legal pages and GDPR text.
- Add a certified CMP before enabling AdSense for EEA/UK/Swiss traffic.
- Keep ad placeholders only until real ad integration is approved.
