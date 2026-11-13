create or replace function public.grant_admin_role(p_user_id uuid, p_assigned_by uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_assigned_by is null then
    raise exception 'user_id and assigned_by are required';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_assigned_by
      and ur.role = 'admin'
  ) then
    raise exception 'Only an existing administrator can assign admin privileges.';
  end if;

  insert into public.user_roles (user_id, role, assigned_by)
  values (p_user_id, 'admin', p_assigned_by)
  on conflict (user_id, role) do nothing;
end;
$$;

-- Example manual database-owner invocation:
-- select public.grant_admin_role('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111');
-- Replace the UUIDs with the actual auth.users ids for the project owner and course representative.
-- This is intentionally server-side only and not exposed to the browser or client application.
