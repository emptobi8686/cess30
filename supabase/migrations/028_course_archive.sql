-- Migration 028: Course archive and delete protection (audit finding BP-030).
--
--   * courses.archived_at: archived courses stay in the catalogue for history but are
--     hidden from new timetable entries and student course lists.
--   * lecture_sessions.course_id was ON DELETE CASCADE: deleting a course silently deleted
--     its whole timetable history. It is now ON DELETE RESTRICT; archive instead.

alter table public.courses
  add column if not exists archived_at timestamptz;

create index if not exists idx_courses_active on public.courses (course_code) where archived_at is null;

alter table public.lecture_sessions
  drop constraint if exists lecture_sessions_course_id_fkey;
alter table public.lecture_sessions
  add constraint lecture_sessions_course_id_fkey
  foreign key (course_id) references public.courses(id) on delete restrict not valid;
alter table public.lecture_sessions
  validate constraint lecture_sessions_course_id_fkey;
