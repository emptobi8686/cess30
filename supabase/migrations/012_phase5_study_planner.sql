-- Migration 012: Phase 5 Personal Study Planner additions.
--
-- Changes:
--   1. Add location, reminder_preference, completed_at, recurrence_id,
--      recurrence_pattern, and recurrence_end_date to study_sessions.
--   2. Add composite indexes for efficient user date-range and recurrence queries.
--   3. Split study_sessions RLS into explicit SELECT, INSERT, UPDATE, DELETE policies.
--   4. Ensure students can only access and modify their own study sessions.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. study_sessions column additions
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.study_sessions
  add column if not exists location text,
  add column if not exists reminder_preference text not null default '15_min'
    check (reminder_preference in ('none', '15_min', '30_min', '1_hour', '1_day')),
  add column if not exists completed_at timestamptz,
  add column if not exists recurrence_id uuid,
  add column if not exists recurrence_pattern text
    check (recurrence_pattern in ('daily', 'weekly', 'selected_weekdays')),
  add column if not exists recurrence_end_date date;

comment on column public.study_sessions.location is
  'Optional location for the personal study session (e.g. Main Library, Home, Faculty Lab).';
comment on column public.study_sessions.reminder_preference is
  'Reminder alert preference: none, 15_min, 30_min, 1_hour, or 1_day before the session.';
comment on column public.study_sessions.completed_at is
  'Timestamp when the study session was marked completed by the student.';
comment on column public.study_sessions.recurrence_id is
  'UUID grouping all study sessions belonging to the same recurring series.';
comment on column public.study_sessions.recurrence_pattern is
  'Recurrence rule cadence: daily, weekly, or selected_weekdays.';
comment on column public.study_sessions.recurrence_end_date is
  'End date for the recurring study session series.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Indexes for fast filtering and conflict detection
-- ─────────────────────────────────────────────────────────────────────────────

create index if not exists idx_study_sessions_user_schedule
  on public.study_sessions(user_id, study_date, start_time);

create index if not exists idx_study_sessions_recurrence
  on public.study_sessions(recurrence_id)
  where recurrence_id is not null;

create index if not exists idx_study_sessions_completed
  on public.study_sessions(user_id, completed, study_date);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Explicit RLS policies (Split for security clarity)
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "study_sessions_manage_own" on public.study_sessions;
drop policy if exists "study_sessions_select_own" on public.study_sessions;
drop policy if exists "study_sessions_insert_own" on public.study_sessions;
drop policy if exists "study_sessions_update_own" on public.study_sessions;
drop policy if exists "study_sessions_delete_own" on public.study_sessions;

create policy "study_sessions_select_own"
on public.study_sessions
for select
to authenticated
using (auth.uid() = user_id);

create policy "study_sessions_insert_own"
on public.study_sessions
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "study_sessions_update_own"
on public.study_sessions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "study_sessions_delete_own"
on public.study_sessions
for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on public.study_sessions to authenticated;

