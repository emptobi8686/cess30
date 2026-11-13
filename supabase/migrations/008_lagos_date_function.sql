-- Migration 008: Add get_lagos_date() helper function.
--
-- Returns the current calendar date in Africa/Lagos (WAT, UTC+1).
-- Used by server-side queries to determine "today" without relying on the
-- application server's local timezone configuration.
--
-- Example:
--   select public.get_lagos_date();  -- returns e.g. '2025-10-07'

create or replace function public.get_lagos_date()
returns date
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select (now() at time zone 'Africa/Lagos')::date;
$$;

-- Grant read access to authenticated users (the function is called from
-- server-side data fetching helpers on behalf of authenticated sessions).
revoke all on function public.get_lagos_date() from public, anon;
grant execute on function public.get_lagos_date() to authenticated, service_role, postgres;
