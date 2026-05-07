-- Tighten execute privileges for admin RPCs.

revoke execute on function public.get_admin_place_activity(uuid, integer) from public;
revoke execute on function public.get_admin_place_activity(uuid, integer) from anon;
grant execute on function public.get_admin_place_activity(uuid, integer) to authenticated;

revoke execute on function public.get_admin_users(integer, integer, text) from public;
revoke execute on function public.get_admin_users(integer, integer, text) from anon;
grant execute on function public.get_admin_users(integer, integer, text) to authenticated;
