-- Migration 033: Scoped, expiring, audited staff capabilities (E6, decision 0004).
--
-- Decision 0004 item 2 approves two capabilities for the first release:
--   department_admin  - everything an administrator does (existing user_roles.admin holders
--                       keep working with zero assignments: they are implicit department admins)
--   level_coordinator - a course representative, scoped to exactly one level
-- library_manager, tutorial_curator and course_content_manager come later; widening the
-- capability check is a one-line follow-up migration.
--
-- Guardrails: no self-grants; every level assignment expires with the academic session;
-- a new department admin needs approval from a different department admin (two-person
-- rule); only verified students can hold a capability; every change is logged in an
-- append-only event table; there are no direct writes, only these RPCs.

create table if not exists public.staff_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  capability text not null check (capability in ('department_admin', 'level_coordinator')),
  level_code text references public.academic_levels(code),
  course_id uuid references public.courses(id) on delete cascade,
  offering_id uuid references public.course_offerings(id) on delete cascade,
  granted_by uuid not null references auth.users(id),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  status text not null default 'active' check (status in ('pending_approval', 'active', 'revoked')),
  approved_by uuid references auth.users(id),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id),
  reason text not null check (length(trim(reason)) >= 8),
  constraint staff_assignments_not_self check (user_id <> granted_by),
  constraint staff_assignments_scope check (
    (capability = 'department_admin' and level_code is null and course_id is null and offering_id is null)
    or (capability = 'level_coordinator' and level_code is not null and course_id is null and offering_id is null)
  ),
  constraint staff_assignments_expiry check (capability = 'department_admin' or expires_at is not null)
);
create index if not exists staff_assignments_user_idx on public.staff_assignments (user_id, capability) where status = 'active';

create table if not exists public.staff_assignment_events (
  id bigint generated always as identity primary key,
  assignment_id uuid not null references public.staff_assignments(id) on delete cascade,
  action text not null check (action in ('granted', 'approved', 'revoked', 'expired')),
  actor uuid references auth.users(id),
  at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb
);
create index if not exists staff_assignment_events_assignment_idx on public.staff_assignment_events (assignment_id, at);

alter table public.staff_assignments enable row level security;
alter table public.staff_assignment_events enable row level security;

revoke all on public.staff_assignments from anon, authenticated;
revoke all on public.staff_assignment_events from anon, authenticated;
grant select on public.staff_assignments to authenticated;
grant select on public.staff_assignment_events to authenticated;

drop policy if exists "staff_assignments_select" on public.staff_assignments;
create policy "staff_assignments_select" on public.staff_assignments for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "staff_assignment_events_select" on public.staff_assignment_events;
create policy "staff_assignment_events_select" on public.staff_assignment_events for select to authenticated
  using (public.is_admin());

-- Core check, usable by triggers for any user. Not callable by clients.
-- Scope rules: department_admin (and legacy admins) cover everything. A level coordinator
-- covers its level, and any course or offering at that level. With no scope given, only a
-- department-wide holder qualifies (use holds_capability for "holds any").
create or replace function public.user_has_capability(
  p_user uuid, p_cap text, p_level_code text default null, p_course_id uuid default null, p_offering_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_level text := p_level_code;
begin
  if p_user is null then return false; end if;

  if exists (select 1 from public.user_roles where user_id = p_user and role = 'admin')
     or exists (
       select 1 from public.staff_assignments
       where user_id = p_user and capability = 'department_admin' and status = 'active'
         and revoked_at is null and (expires_at is null or expires_at > now())
     ) then
    return true;
  end if;

  if p_cap <> 'level_coordinator' then return false; end if;

  if p_offering_id is not null then
    select level_code into v_level from public.course_offerings where id = p_offering_id;
  elsif p_course_id is not null and v_level is null then
    select level into v_level from public.courses where id = p_course_id;
  end if;
  if v_level is null then return false; end if;

  return exists (
    select 1 from public.staff_assignments
    where user_id = p_user and capability = 'level_coordinator' and level_code = v_level
      and status = 'active' and revoked_at is null and expires_at > now()
  );
end;
$$;

create or replace function public.has_capability(
  p_cap text, p_level_code text default null, p_course_id uuid default null, p_offering_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.user_has_capability(auth.uid(), p_cap, p_level_code, p_course_id, p_offering_id);
$$;

-- The caller's active capabilities, for navigation only (never for authorization).
create or replace function public.my_capabilities()
returns table (capability text, level_code text, expires_at timestamptz)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select 'department_admin'::text, null::text, null::timestamptz
  where exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin')
  union all
  select a.capability, a.level_code, a.expires_at
  from public.staff_assignments a
  where a.user_id = auth.uid() and a.status = 'active' and a.revoked_at is null
    and (a.expires_at is null or a.expires_at > now())
    and not (a.capability = 'department_admin'
             and exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));
$$;

create or replace function public.grant_capability(
  p_user uuid, p_cap text, p_level text, p_course uuid, p_offering uuid, p_expires timestamptz, p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_expires timestamptz := p_expires;
  v_id uuid;
begin
  if not public.user_has_capability(v_uid, 'department_admin') then
    raise exception 'Department administrator access required.';
  end if;
  if p_user = v_uid then raise exception 'You cannot grant a capability to yourself.'; end if;
  if p_cap not in ('department_admin', 'level_coordinator') then
    raise exception 'That capability is not enabled yet.';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 8 then raise exception 'Give a reason of at least 8 characters.'; end if;
  if p_cap = 'level_coordinator' and (p_level is null or p_course is not null or p_offering is not null) then
    raise exception 'A course representative must be assigned to one level.';
  end if;
  if p_cap = 'department_admin' and (p_level is not null or p_course is not null or p_offering is not null) then
    raise exception 'A department administrator has department-wide scope.';
  end if;
  if not exists (select 1 from public.profiles where id = p_user and verification_status = 'verified') then
    raise exception 'Only verified students can be given staff capabilities.';
  end if;

  if p_cap = 'level_coordinator' then
    if v_expires is null then
      select ((ends_on + 1)::timestamp at time zone 'Africa/Lagos') into v_expires
      from public.academic_sessions where is_current;
      if v_expires is null then raise exception 'Open an academic session before appointing course representatives.'; end if;
    end if;
    if v_expires <= now() then raise exception 'The expiry must be in the future.'; end if;
    if exists (
      select 1 from public.staff_assignments
      where user_id = p_user and capability = p_cap and level_code = p_level and status = 'active'
        and revoked_at is null and expires_at > now()
    ) then
      raise exception 'That person is already the course representative for this level.';
    end if;
  end if;

  insert into public.staff_assignments (user_id, capability, level_code, granted_by, expires_at, status, reason)
  values (p_user, p_cap, p_level, v_uid, v_expires,
          case when p_cap = 'department_admin' then 'pending_approval' else 'active' end, trim(p_reason))
  returning id into v_id;

  insert into public.staff_assignment_events (assignment_id, action, actor, details)
  values (v_id, 'granted', v_uid, jsonb_build_object('capability', p_cap, 'level_code', p_level, 'reason', trim(p_reason)));
  return v_id;
end;
$$;

create or replace function public.approve_capability(p_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.staff_assignments%rowtype;
begin
  if not public.user_has_capability(v_uid, 'department_admin') then
    raise exception 'Department administrator access required.';
  end if;
  select * into v_row from public.staff_assignments where id = p_id for update;
  if not found or v_row.status <> 'pending_approval' then raise exception 'There is no pending grant to approve.'; end if;
  if v_row.granted_by = v_uid or v_row.user_id = v_uid then
    raise exception 'Another department administrator must approve this.';
  end if;

  update public.staff_assignments set status = 'active', approved_by = v_uid where id = p_id;
  -- Department admins are administrators for every existing admin-gated policy.
  insert into public.user_roles (user_id, role, assigned_by) values (v_row.user_id, 'admin', v_uid)
  on conflict (user_id, role) do nothing;
  insert into public.staff_assignment_events (assignment_id, action, actor) values (p_id, 'approved', v_uid);
end;
$$;

create or replace function public.revoke_capability(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.staff_assignments%rowtype;
begin
  if not public.user_has_capability(v_uid, 'department_admin') then
    raise exception 'Department administrator access required.';
  end if;
  select * into v_row from public.staff_assignments where id = p_id for update;
  if not found or v_row.status = 'revoked' then raise exception 'That assignment is not active.'; end if;
  if v_row.user_id = v_uid then raise exception 'Ask another department administrator to remove your own access.'; end if;

  update public.staff_assignments set status = 'revoked', revoked_at = now(), revoked_by = v_uid where id = p_id;
  if v_row.capability = 'department_admin' and v_row.status = 'active' then
    delete from public.user_roles where user_id = v_row.user_id and role = 'admin';
  end if;
  insert into public.staff_assignment_events (assignment_id, action, actor, details)
  values (p_id, 'revoked', v_uid, jsonb_build_object('reason', nullif(trim(coalesce(p_reason, '')), '')));
end;
$$;

revoke all on function public.user_has_capability(uuid, text, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.has_capability(text, text, uuid, uuid) from public, anon;
revoke all on function public.my_capabilities() from public, anon;
revoke all on function public.grant_capability(uuid, text, text, uuid, uuid, timestamptz, text) from public, anon;
revoke all on function public.approve_capability(uuid) from public, anon;
revoke all on function public.revoke_capability(uuid, text) from public, anon;
grant execute on function public.has_capability(text, text, uuid, uuid) to authenticated;
grant execute on function public.my_capabilities() to authenticated;
grant execute on function public.grant_capability(uuid, text, text, uuid, uuid, timestamptz, text) to authenticated;
grant execute on function public.approve_capability(uuid) to authenticated;
grant execute on function public.revoke_capability(uuid, text) to authenticated;
