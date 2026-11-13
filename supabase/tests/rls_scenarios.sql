-- LIVE SUPABASE RLS SCENARIOS
-- These checks require a real Supabase project with separate student and admin identities.
-- They are prepared for SQL execution in the Supabase SQL editor or with a database test runner.

-- EXECUTED LOCALLY IN THIS WORKSPACE
-- Local validation was limited to TypeScript, lint, build, and node-based config checks.
-- No live Supabase RLS tests were executed here because no real project credentials exist in this environment.

-- PREPARED TESTS (LIVE ONLY)
-- Student A: own profile and own study sessions should be readable and editable.
select *
from public.profiles
where id = auth.uid();

select *
from public.study_sessions
where user_id = auth.uid();

-- Student A should not read Student B's private study sessions.
select *
from public.study_sessions
where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
-- Expected result: zero rows due to RLS.

-- Student A should not self-promote to admin via role insert.
insert into public.user_roles (user_id, role, assigned_by)
values (auth.uid(), 'admin', auth.uid());
-- Expected result: rejected by RLS/policy.

-- Student A should not update protected profile fields.
update public.profiles
set matric_number = '99999999', department = 'Psychology', level = '300'
where id = auth.uid();
-- Expected result: rejected by trigger or policy.

-- Student B should not read Student A's study session rows.
select *
from public.study_sessions
where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
-- Expected result: zero rows due to RLS.

-- Administrator should be able to publish an announcement.
insert into public.announcements (title, content, scope, created_by)
values ('Department update', 'A new message has been released.', 'department', auth.uid());
-- Expected result: succeeds for an admin identity only.

-- Student should not create an announcement.
insert into public.announcements (title, content, scope, created_by)
values ('Student forged notice', 'unauthorised notice', 'all', auth.uid());
-- Expected result: rejected by admin-only policy.

-- Administrator should manage the course catalogue.
insert into public.courses (course_code, course_title, credit_units, level, department)
values ('GET212', 'Engineering Mathematics II', 3, '200', 'Civil Engineering');
-- Expected result: succeeds for an admin identity.

-- Student should not insert an admin role through a direct table insert.
insert into public.user_roles (user_id, role, assigned_by)
values (auth.uid(), 'admin', '11111111-1111-1111-1111-111111111111');
-- Expected result: rejected by RLS.

-- Student should not promote themselves through an UPDATE either.
update public.user_roles
set role = 'admin'
where user_id = auth.uid();
-- Expected result: zero rows updated (user_roles_update_admin_only).

-- ═════════════════════════════════════════════════════════════════════════════
-- PHASE 4.1 SCENARIOS (migration 009)
--
-- These blocks assume two real administrator identities and two student
-- identities. Replace the placeholder UUIDs with real auth.users ids.
--
--   student A = aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
--   student B = bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
--   admin A   = 11111111-1111-1111-1111-111111111111
--   admin B   = 22222222-2222-2222-2222-222222222222
--
-- The Supabase SQL editor connects as `postgres`, which bypasses RLS. To make
-- the policies apply, every block impersonates an identity with:
--
--   begin;
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}';
--   ...
--   rollback;
--
-- Re-setting request.jwt.claims inside the same transaction switches the
-- effective user, which lets a single block test "admin A creates, admin B
-- edits". Always finish with rollback so no test rows are left behind.
--
-- In PostgreSQL an expected error aborts the current transaction. Expected
-- failures below are wrapped in SAVEPOINT / ROLLBACK TO SAVEPOINT so later
-- checks in the same block still run. If your SQL runner stops on the first
-- error, run each expected-failure statement as its own block.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── Student cannot mutate lecture sessions ──────────────────────────────────
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

savepoint student_lecture_insert;
insert into public.lecture_sessions
  (course_id, lecture_date, start_time, end_time, venue, created_by)
select id, date '2030-01-07', time '09:00', time '10:00', 'Hall A', auth.uid()
from public.courses
limit 1;
-- Expected: rejected by lecture_sessions_insert_admin_only.
rollback to savepoint student_lecture_insert;

update public.lecture_sessions set venue = 'Hacked Hall';
-- Expected: zero rows updated.

delete from public.lecture_sessions;
-- Expected: zero rows deleted.
rollback;

-- ── Student cannot mutate announcements ─────────────────────────────────────
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

savepoint student_announcement_insert;
insert into public.announcements (title, content, scope, created_by)
values ('Student forged notice', 'unauthorised', 'all', auth.uid());
-- Expected: rejected by announcements_insert_admin_only.
rollback to savepoint student_announcement_insert;

update public.announcements set title = 'Hijacked';
-- Expected: zero rows updated.

delete from public.announcements;
-- Expected: zero rows deleted.
rollback;

-- ── Admin A can create; Admin B can edit and delete the same row ─────────────
-- This is the regression fixed by migration 009: the old FOR ALL policy required
-- created_by = auth.uid() for UPDATE as well, so Admin B could not manage it.
begin;
set local role authenticated;

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
insert into public.lecture_sessions
  (course_id, lecture_date, start_time, end_time, venue, created_by)
select id, date '2030-01-08', time '11:00', time '12:00', 'Hall A', auth.uid()
from public.courses
limit 1;
-- Expected: succeeds (created_by = admin A).

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
update public.lecture_sessions
set venue = 'Hall B'
where created_by = '11111111-1111-1111-1111-111111111111';
-- Expected: one row updated (lecture_sessions_update_admin_only).

delete from public.lecture_sessions
where created_by = '11111111-1111-1111-1111-111111111111';
-- Expected: one row deleted (lecture_sessions_delete_admin_only).
rollback;

-- ── Admin B cannot forge created_by on INSERT ───────────────────────────────
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

insert into public.lecture_sessions
  (course_id, lecture_date, start_time, end_time, venue, created_by)
select id, date '2030-01-09', time '09:00', time '10:00', 'Hall A',
       '11111111-1111-1111-1111-111111111111'
from public.courses
limit 1;
-- Expected: rejected by lecture_sessions_insert_admin_only (created_by <> auth.uid()).
rollback;

-- ── Audit columns are read-only on UPDATE ───────────────────────────────────
begin;
set local role authenticated;

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
insert into public.lecture_sessions
  (course_id, lecture_date, start_time, end_time, venue, created_by)
select id, date '2030-01-10', time '09:00', time '10:00', 'Hall A', auth.uid()
from public.courses
limit 1;

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
update public.lecture_sessions
set created_by = '22222222-2222-2222-2222-222222222222'
where created_by = '11111111-1111-1111-1111-111111111111';
-- Expected: rejected by prevent_audit_column_changes trigger.
rollback;

-- ── Announcement visibility: drafts and future rows are admin-only ──────────
begin;
set local role authenticated;

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
insert into public.announcements
  (title, content, scope, created_by, is_published, published_at)
values
  ('Draft notice',     'draft',     'all', auth.uid(), false, now()),
  ('Scheduled notice', 'scheduled', 'all', auth.uid(), true,  now() + interval '1 day'),
  ('Live notice',      'live',      'all', auth.uid(), true,  now() - interval '1 day');

set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
select title
from public.announcements
where title in ('Draft notice', 'Scheduled notice', 'Live notice');
-- Expected: only 'Live notice' (announcements_select_authenticated).

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select title
from public.announcements
where title in ('Draft notice', 'Scheduled notice', 'Live notice');
-- Expected: all three rows (announcements_select_admin).
rollback;

-- ── Admin B can edit and delete an announcement created by Admin A ──────────
begin;
set local role authenticated;

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
insert into public.announcements (title, content, scope, created_by)
values ('Admin A notice', 'created by admin A', 'all', auth.uid());

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
update public.announcements
set title = 'Edited by admin B'
where created_by = '11111111-1111-1111-1111-111111111111';
-- Expected: one row updated (announcements_update_admin_only).

delete from public.announcements
where created_by = '11111111-1111-1111-1111-111111111111';
-- Expected: one row deleted (announcements_delete_admin_only).
rollback;

-- ── Announcement scope guard ────────────────────────────────────────────────
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

savepoint bad_course_scope;
insert into public.announcements (title, content, scope, course_id, created_by)
values ('Bad course scope', 'missing course', 'course', null, auth.uid());
-- Expected: rejected by validate_announcement_scope.
rollback to savepoint bad_course_scope;

savepoint bad_all_scope;
insert into public.announcements (title, content, scope, course_id, created_by)
select 'Bad all scope', 'unexpected course', 'all', id, auth.uid()
from public.courses
limit 1;
-- Expected: rejected by validate_announcement_scope.
rollback to savepoint bad_all_scope;
rollback;

-- ── Duplicate active lecture slot is rejected; cancelled slots are exempt ────
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.lecture_sessions
  (course_id, lecture_date, start_time, end_time, venue, created_by)
select id, date '2030-02-04', time '09:00', time '10:00', 'Hall A', auth.uid()
from public.courses
order by course_code
limit 1;

savepoint duplicate_active_slot;
insert into public.lecture_sessions
  (course_id, lecture_date, start_time, end_time, venue, created_by)
select id, date '2030-02-04', time '09:00', time '10:00', 'Hall A', auth.uid()
from public.courses
order by course_code
limit 1;
-- Expected: unique_violation from lecture_sessions_active_slot_unique.
rollback to savepoint duplicate_active_slot;

update public.lecture_sessions
set is_cancelled = true
where lecture_date = date '2030-02-04' and start_time = time '09:00';

insert into public.lecture_sessions
  (course_id, lecture_date, start_time, end_time, venue, created_by)
select id, date '2030-02-04', time '09:00', time '10:00', 'Hall A', auth.uid()
from public.courses
order by course_code
limit 1;
-- Expected: succeeds because the first slot is cancelled.
rollback;

-- ── Invalid time range is rejected by the table constraint ──────────────────
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.lecture_sessions
  (course_id, lecture_date, start_time, end_time, venue, created_by)
select id, date '2030-02-05', time '11:00', time '10:00', 'Hall A', auth.uid()
from public.courses
limit 1;
-- Expected: check violation from lecture_sessions_time_range_check.
rollback;

-- ═════════════════════════════════════════════════════════════════════════════
-- PHASE 6 NOTIFICATION SCENARIOS (migration 013)
--
-- Run only after migration 013. These checks assume Student A and Student B
-- exist in auth.users. Notification rows are inserted as postgres first; the
-- authenticated role then verifies ownership and column-level permissions.
-- ═════════════════════════════════════════════════════════════════════════════

begin;

insert into public.notification_preferences (user_id)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
on conflict (user_id) do nothing;

insert into public.notifications
  (user_id, title, message, notification_type, source_type, dedupe_key)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Student A notice', 'A private notice.', 'system', 'system', 'rls-test:student-a'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Student B notice', 'Another private notice.', 'system', 'system', 'rls-test:student-b');

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

select title
from public.notifications
where dedupe_key like 'rls-test:%';
-- Expected: only 'Student A notice'.

select user_id
from public.notification_preferences
where user_id in (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
);
-- Expected: Student A's preference row only.

savepoint student_notification_insert;
insert into public.notifications
  (user_id, title, message, notification_type, source_type, dedupe_key)
values
  (auth.uid(), 'Forged notice', 'Students cannot create notifications.', 'system', 'system', 'rls-test:forged');
-- Expected: rejected because authenticated has no INSERT grant or policy.
rollback to savepoint student_notification_insert;

savepoint student_notification_update_other_columns;
update public.notifications
set title = 'Forged title'
where dedupe_key = 'rls-test:student-a';
-- Expected: rejected because authenticated may update only is_read/read_at.
rollback to savepoint student_notification_update_other_columns;

update public.notifications
set is_read = true, read_at = now()
where dedupe_key = 'rls-test:student-a';
-- Expected: one row updated.

delete from public.notifications
where dedupe_key = 'rls-test:student-b';
-- Expected: zero rows deleted.

savepoint student_subscription_select;
select id from public.push_subscriptions;
-- Expected: rejected; authenticated has no table grant or policy.
rollback to savepoint student_subscription_select;

savepoint student_subscription_insert;
insert into public.push_subscriptions
  (user_id, endpoint, p256dh, auth)
values
  (auth.uid(), 'https://fcm.googleapis.com/rls-test', 'test-p256dh', 'test-auth');
-- Expected: rejected; authenticated has no table grant or policy.
rollback to savepoint student_subscription_insert;

set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
select title
from public.notifications
where dedupe_key like 'rls-test:%';
-- Expected: only 'Student B notice'; Student A's read state is private too.

rollback;
