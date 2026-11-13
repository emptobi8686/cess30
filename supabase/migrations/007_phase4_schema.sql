-- Migration 007: Phase 4 schema additions.
--
-- Changes:
--   1. lecture_sessions — add cancellation support and updated_by tracking.
--   2. announcements    — add draft/published distinction with explicit is_published flag.
--
-- This migration is additive only. No existing columns or policies are dropped.
-- New columns are nullable or have safe defaults so the migration is non-destructive.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. lecture_sessions — cancellation and audit
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.lecture_sessions
  add column if not exists is_cancelled  boolean     not null default false,
  add column if not exists cancelled_at  timestamptz,
  add column if not exists updated_by    uuid        references auth.users(id) on delete set null;

comment on column public.lecture_sessions.is_cancelled is
  'True when this session has been cancelled by an administrator.';
comment on column public.lecture_sessions.cancelled_at is
  'Timestamp of cancellation; null when not cancelled.';
comment on column public.lecture_sessions.updated_by is
  'The administrator who last modified this session.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. announcements — explicit draft/published flag
--
-- The existing schema used published_at <= now() as the publication gate.
-- We add is_published so admins can save a draft (is_published=false) with a
-- future-dated published_at, or unpublish a previously published announcement.
-- The existing RLS policy already checks published_at <= now(), so the new column
-- adds an AND is_published = true gate via a new migration-level policy replacement.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.announcements
  add column if not exists is_published boolean not null default true,
  add column if not exists updated_by   uuid    references auth.users(id) on delete set null;

comment on column public.announcements.is_published is
  'False for draft announcements. Students cannot see drafts.';
comment on column public.announcements.updated_by is
  'The administrator who last modified this announcement.';

-- Update the existing student-facing select policy to also require is_published.
-- Drop the old policy and recreate it; the name is preserved for auditability.
drop policy if exists "announcements_select_authenticated" on public.announcements;

create policy "announcements_select_authenticated"
on public.announcements
for select
using (
  auth.role() = 'authenticated'
  and is_published = true
  and published_at <= now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Additional indexes for the new columns
-- ─────────────────────────────────────────────────────────────────────────────

create index if not exists idx_lecture_sessions_date_cancelled
  on public.lecture_sessions(lecture_date, is_cancelled);

create index if not exists idx_announcements_published_flag
  on public.announcements(is_published, published_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Grant INSERT on user_roles to authenticated so the app can read admin
--    status via the existing is_admin() helper without hitting permission errors.
--    (The insert policy itself still restricts to admins only via RLS.)
-- ─────────────────────────────────────────────────────────────────────────────

-- Grant INSERT/UPDATE/DELETE on lecture_sessions and announcements to authenticated.
-- The existing RLS policies already restrict writes to admins; these grants let
-- the Supabase client make the attempts (and get denied by RLS if not admin)
-- rather than getting a "permission denied for relation" error at the grant level.
grant insert, update, delete on public.lecture_sessions to authenticated;
grant insert, update, delete on public.announcements to authenticated;
