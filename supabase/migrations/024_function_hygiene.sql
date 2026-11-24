-- Migration 024: Function hygiene (audit findings BP-043, BP-044, dead code).
--
--   * update_updated_at_column(): 018 redefined it without a pinned search_path,
--     undoing 009's hardening. Restore SECURITY INVOKER + search_path.
--   * grant_admin_role(): inside a SECURITY DEFINER function current_user is always the
--     owner, so 004's "trusted caller" branch never ran. Remove it; execution stays
--     limited to service_role (provisioning is a server-side/SQL-editor operation).
--   * record_profile_verification_decision(): superseded by verify_profile_decision()
--     in 016 and revoked from API roles; remove the dead function.
--   * get_lagos_date(): needs no elevated rights; make it SECURITY INVOKER.

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.update_updated_at_column() from public, anon, authenticated;

create or replace function public.grant_admin_role(p_user_id uuid, p_assigned_by uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_user_id is null or p_assigned_by is null then
    raise exception 'Target user and assigned_by are required.';
  end if;

  if p_user_id = p_assigned_by then
    raise exception 'A user cannot grant admin privileges to themselves.';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Target user does not exist in auth.users.';
  end if;

  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = p_assigned_by and ur.role = 'admin'
  ) then
    raise exception 'Only an existing administrator may assign admin privileges.';
  end if;

  insert into public.user_roles (user_id, role, assigned_by)
  values (p_user_id, 'admin', p_assigned_by)
  on conflict (user_id, role) do nothing;
end;
$$;

revoke all on function public.grant_admin_role(uuid, uuid) from public, anon, authenticated;
grant execute on function public.grant_admin_role(uuid, uuid) to service_role;

drop function if exists public.record_profile_verification_decision(uuid, text, text, uuid, text);

create or replace function public.get_lagos_date()
returns date
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select (now() at time zone 'Africa/Lagos')::date;
$$;

revoke all on function public.get_lagos_date() from public, anon;
grant execute on function public.get_lagos_date() to authenticated, service_role;
