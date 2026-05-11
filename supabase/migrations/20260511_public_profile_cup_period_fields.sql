-- Public profile cup cards: expose cup period (from/to) instead of only award timestamp.

drop function if exists public.get_public_profile_cup_placements(text, integer);
create function public.get_public_profile_cup_placements(
  p_username text,
  p_limit integer default 12
)
returns table (
  cup_id uuid,
  cup_name text,
  placement smallint,
  cup_score numeric,
  reward_points_awarded integer,
  cup_svg_markup text,
  badge_svg_markup text,
  cup_start_at timestamptz,
  cup_end_at timestamptz,
  awarded_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $function$
  with target as (
    select
      p.id,
      coalesce(p.hide_score, false) as hide_score
    from public.profiles p
    where lower(p.username) = lower(trim(p_username))
      and coalesce(p.is_frozen, false) = false
      and coalesce(public.is_user_currently_banned(p.id), false) = false
    limit 1
  )
  select
    cp.cup_id,
    c.name as cup_name,
    cp.placement,
    cp.cup_score,
    cp.reward_points_awarded,
    case when cp.placement = 1 then c.svg_markup else null end as cup_svg_markup,
    case when cp.placement in (2, 3) then public.get_default_cup_badge_svg(cp.placement) else null end as badge_svg_markup,
    coalesce(c.start_at, c.start_date::timestamptz) as cup_start_at,
    coalesce(c.end_at, (c.end_date::timestamptz + interval '1 day' - interval '1 second')) as cup_end_at,
    cp.created_at as awarded_at
  from target t
  join public.cup_placements cp on cp.user_id = t.id
  join public.cups c on c.id = cp.cup_id
  where t.hide_score = false
  order by cp.created_at desc, cp.placement asc
  limit greatest(1, least(coalesce(p_limit, 12), 100));
$function$;

revoke execute on function public.get_public_profile_cup_placements(text, integer) from public;
grant execute on function public.get_public_profile_cup_placements(text, integer) to anon, authenticated;
