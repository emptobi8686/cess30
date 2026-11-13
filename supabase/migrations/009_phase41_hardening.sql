-- Migration 009: Phase 4.1 security and timetable hardening.
--
-- Findings addressed here
-- -----------------------
-- 1. `lecture_sessions_manage_admin_only` and `announcements_manage_admin_only`
--    were FOR ALL policies whose WITH CHECK included `created_by = auth.uid()`.
--    That conflated INSERT and UPDATE rules: an administrator could not edit or
--    delete a row created by another administrator. The policies are replaced
--    with explicit INSERT / UPDATE / DELETE policies. INSERT still requires
--    `created_by = auth.uid()`; UPDATE and DELETE only require `is_admin()`.
--
-- 2. Removing the announcements FOR ALL policy also removed its implicit SELECT
--    branch. A separate admin SELECT policy is added so administrators can still
--    see drafts, while the student-facing policy continues to require
--    `is_published = true AND published_at <= now()`.
--
-- 3. Trigger/helper functions are hardened with an explicit search_path and
--    direct EXECUTE privileges are revoked.
--
-- 4. Audit columns (`created_by`, `created_at`) are protected from UPDATE so a
--    row's provenance cannot be rewritten.
--
-- 5. A partial unique index prevents duplicate active lecture slots when the
--    existing data is clean. If duplicates already exist, the index is skipped
--    with a notice so the migration remains non-destructive.
--
-- This migration does not weaken any existing control.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. lecture_sessions policies
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "lecture_sessions_manage_admin_only" on public.lecture_sessions;
drop policy if exists "lecture_sessions_insert_admin_only" on public.lecture_sessions;
drop policy if exists "lecture_sessions_update_admin_only" on public.lecture_sessions;
drop policy if exists "lecture_sessions_delete_admin_only" on public.lecture_sessions;

-- Students keep read access through the existing
-- `lecture_sessions_select_authenticated` policy.
create policy "lecture_sessions_insert_admin_only"
on public.lecture_sessions
for insert
to authenticated
with check (public.is_admin() and created_by = auth.uid());

create policy "lecture_sessions_update_admin_only"
on public.lecture_sessions
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "lecture_sessions_delete_admin_only"
on public.lecture_sessions
for delete
to authenticated
using (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. announcements policies
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "announcements_manage_admin_only" on public.announcements;
drop policy if exists "announcements_select_admin" on public.announcements;
drop policy if exists "announcements_insert_admin_only" on public.announcements;
drop policy if exists "announcements_update_admin_only" on public.announcements;
drop policy if exists "announcements_delete_admin_only" on public.announcements;

-- Administrators can see drafts and future-dated rows. This is OR'd with the
-- student-facing `announcements_select_authenticated` policy from migration 007.
create policy "announcements_select_admin"
on public.announcements
for select
to authenticated
using (public.is_admin());

create policy "announcements_insert_admin_only"
on public.announcements
for insert
to authenticated
with check (public.is_admin() and created_by = auth.uid());

create policy "announcements_update_admin_only"
on public.announcements
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "announcements_delete_admin_only"
on public.announcements
for delete
to authenticated
using (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Function hardening
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.validate_announcement_scope()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if new.scope = 'course' and new.course_id is null then
    raise exception 'course announcements require a course_id';
  end if;

  if new.scope <> 'course' and new.course_id is not null then
    raise exception 'only course-scoped announcements may reference a course_id';
  end if;

  return new;
end;
$$;

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

revoke all on function public.validate_announcement_scope() from public, anon, authenticated;
revoke all on function public.update_updated_at_column() from public, anon, authenticated;
grant execute on function public.validate_announcement_scope() to postgres, service_role;
grant execute on function public.update_updated_at_column() to postgres, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Protect audit columns from UPDATE
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.prevent_audit_column_changes()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Audit fields (created_by, created_at) are read-only.';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_audit_column_changes() from public, anon, authenticated;
grant execute on function public.prevent_audit_column_changes() to postgres, service_role;

drop trigger if exists lecture_sessions_protect_audit on public.lecture_sessions;
create trigger lecture_sessions_protect_audit
before update on public.lecture_sessions
for each row
execute function public.prevent_audit_column_changes();

drop trigger if exists announcements_protect_audit on public.announcements;
create trigger announcements_protect_audit
before update on public.announcements
for each row
execute function public.prevent_audit_column_changes();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Duplicate active-session prevention (safe for existing data)
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if exists (
    select 1
    from (
      select course_id, lecture_date, start_time
      from public.lecture_sessions
      where is_cancelled = false
      group by course_id, lecture_date, start_time
      having count(*) > 1
    ) duplicate_slots
  ) then
    raise notice 'Skipped lecture_sessions_active_slot_unique: duplicate active sessions already exist. Resolve them before adding the index.';
  else
    create unique index if not exists lecture_sessions_active_slot_unique
      on public.lecture_sessions(course_id, lecture_date, start_time)
      where is_cancelled = false;
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Reaffirm grants (RLS remains the authority)
-- ─────────────────────────────────────────────────────────────────────────────

grant select on public.lecture_sessions, public.announcements to authenticated;
grant insert, update, delete on public.lecture_sessions, public.announcements to authenticated;
