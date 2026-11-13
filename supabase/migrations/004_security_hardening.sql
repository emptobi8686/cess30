create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  );
$$;

create or replace function public.prevent_profile_identity_changes()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.id is distinct from old.id
     or new.matric_number is distinct from old.matric_number
     or new.department is distinct from old.department
     or new.level is distinct from old.level
     or new.created_at is distinct from old.created_at then
    raise exception 'Profile identity fields are protected.';
  end if;

  return new;
end;
$$;

create or replace function public.grant_admin_role(p_user_id uuid, p_assigned_by uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_has_admin_role boolean;
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

  if not exists (select 1 from auth.users where id = p_assigned_by) then
    raise exception 'Assigning user does not exist in auth.users.';
  end if;

  if current_user <> 'service_role' and current_user <> 'postgres' then
    if auth.uid() is null or auth.uid() <> p_assigned_by then
      raise exception 'This operation is restricted to trusted server-side execution.';
    end if;
  end if;

  v_has_admin_role := exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_assigned_by
      and ur.role = 'admin'
  );

  if not v_has_admin_role then
    raise exception 'Only an existing administrator may assign admin privileges.';
  end if;

  if exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_user_id
      and ur.role = 'admin'
  ) then
    return;
  end if;

  insert into public.user_roles (user_id, role, assigned_by)
  values (p_user_id, 'admin', p_assigned_by)
  on conflict (user_id, role) do nothing;

  return;
end;
$$;

revoke all on function public.is_admin() from public, authenticated, anon;
revoke all on function public.grant_admin_role(uuid, uuid) from public, authenticated, anon;
revoke all on function public.prevent_profile_identity_changes() from public, authenticated, anon;

grant execute on function public.is_admin() to service_role, postgres;
grant execute on function public.grant_admin_role(uuid, uuid) to service_role, postgres;
grant execute on function public.prevent_profile_identity_changes() to postgres;
