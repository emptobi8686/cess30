-- BP-043 / BP-044 and dead code: function security attributes.
begin;
\ir _helpers.psql
select plan(9);

select is(
  (select prosecdef from pg_proc where oid = 'public.update_updated_at_column()'::regprocedure),
  false, 'update_updated_at_column is security invoker');
select ok(
  (select array_to_string(proconfig, ',') from pg_proc where oid = 'public.update_updated_at_column()'::regprocedure)
    like '%search_path=pg_catalog, public%',
  'update_updated_at_column pins search_path');
select hasnt_function('public', 'record_profile_verification_decision', 'dead non-atomic verification RPC is removed');
select is(
  (select prosecdef from pg_proc where oid = 'public.get_lagos_date()'::regprocedure),
  false, 'get_lagos_date is security invoker');
select is(
  has_function_privilege('authenticated', 'public.grant_admin_role(uuid, uuid)', 'EXECUTE'),
  false, 'authenticated cannot grant admin roles');
select is(
  has_function_privilege('service_role', 'public.grant_admin_role(uuid, uuid)', 'EXECUTE'),
  true, 'service_role can grant admin roles');
select ok(
  position('current_user' in (select prosrc from pg_proc where oid = 'public.grant_admin_role(uuid, uuid)'::regprocedure)) = 0,
  'grant_admin_role has no ineffective current_user branch');

-- Advisor-equivalent guards (would have caught BP-001). Extension-owned objects
-- (e.g. pgTAP's helper views) are excluded.
select is_empty(
  $$select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
      and not exists (select 1 from pg_depend d where d.classid = 'pg_class'::regclass and d.objid = c.oid and d.deptype = 'e')$$,
  'every table in public has row level security enabled');
select is_empty(
  $$select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v'
      and not coalesce(c.reloptions @> array['security_invoker=true'], false)
      and not exists (select 1 from pg_depend d where d.classid = 'pg_class'::regclass and d.objid = c.oid and d.deptype = 'e')$$,
  'every view in public runs with security_invoker');

select * from finish();
rollback;
