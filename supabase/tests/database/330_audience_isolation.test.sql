-- E5 isolation matrix. Expected visible counts (direct table reads):
--   who \ what        announcements  lectures  active quests
--   level-200 (s200)        4            1          1
--   level-300 + carry-over  4            2          1
--   pending (claimed 200)   1            1          0
--   suspended               0            0          0
--   admin                   7            2          3
-- Announcements: dept, L200, L300, GET209@200 offering, L200+L300, legacy level (no audience),
-- and an unpublished draft. Quests: L200, L300, no audience.
begin;
\ir _helpers.psql
select plan(22);

select tests.create_user('iso-admin@test.local', '{"full_name":"Admin","matric_number":"990000001"}') as adm \gset
select tests.create_user('iso-s200@test.local', '{"full_name":"Two","matric_number":"990000002"}') as s200 \gset
select tests.create_user('iso-s300@test.local', '{"full_name":"Three","matric_number":"990000003"}') as s300 \gset
select tests.create_user('iso-pend@test.local', '{"full_name":"Pending","matric_number":"990000004"}') as pend \gset
select tests.create_user('iso-susp@test.local', '{"full_name":"Suspended","matric_number":"990000005"}') as susp \gset
select tests.make_admin(:'adm');
select tests.set_verification(:'adm', 'verified');
select tests.set_verification(:'s200', 'verified');
select tests.set_verification(:'s300', 'verified');
select tests.set_verification(:'susp', 'suspended');

insert into public.academic_sessions (id, label, starts_on, ends_on, is_current)
values ('00000000-0000-0000-0000-00000000e330', '2026/2027', '2026-10-01', '2027-09-30', true);
insert into public.semesters (id, session_id, number, label, starts_on, ends_on, is_current)
values ('00000000-0000-0000-0000-00000000f330', '00000000-0000-0000-0000-00000000e330', 1, 'First Semester', '2026-10-05', '2027-02-26', true);
insert into public.courses (id, course_code, course_title, credit_units, level, department)
values ('00000000-0000-0000-0000-0000000c0330', 'CEE301', 'Structural Analysis I', 3, '300', 'Civil Engineering');
select id as get209 from public.courses where course_code = 'GET209' \gset
select id as dept from public.departments where code = 'CVE' \gset
insert into public.course_offerings (id, course_id, semester_id, level_code) values
  ('00000000-0000-0000-0000-0000000a0331', :'get209', '00000000-0000-0000-0000-00000000f330', '200'),
  ('00000000-0000-0000-0000-0000000a0332', '00000000-0000-0000-0000-0000000c0330', '00000000-0000-0000-0000-00000000f330', '300');
insert into public.student_placements (student_id, session_id, level_code, status) values
  (:'s200', '00000000-0000-0000-0000-00000000e330', '200', 'confirmed'),
  (:'s300', '00000000-0000-0000-0000-00000000e330', '300', 'confirmed'),
  (:'pend', '00000000-0000-0000-0000-00000000e330', '200', 'claimed'),
  (:'susp', '00000000-0000-0000-0000-00000000e330', '200', 'confirmed');
insert into public.course_enrollments (student_id, offering_id, enrolment_type) values
  (:'s200', '00000000-0000-0000-0000-0000000a0331', 'core'),
  (:'s300', '00000000-0000-0000-0000-0000000a0332', 'core'),
  (:'s300', '00000000-0000-0000-0000-0000000a0331', 'carryover'),
  (:'susp', '00000000-0000-0000-0000-0000000a0331', 'core');

insert into public.announcements (id, title, content, scope, created_by, is_published, published_at) values
  ('00000000-0000-0000-0000-00000000a331', 'Department', 'Department-wide notice.', 'department', :'adm', true, now() - interval '1 hour'),
  ('00000000-0000-0000-0000-00000000a332', 'Level 200', 'Level 200 notice text.', 'level', :'adm', true, now() - interval '1 hour'),
  ('00000000-0000-0000-0000-00000000a333', 'Level 300', 'Level 300 notice text.', 'level', :'adm', true, now() - interval '1 hour'),
  ('00000000-0000-0000-0000-00000000a334', 'GET209', 'GET209 offering notice.', 'department', :'adm', true, now() - interval '1 hour'),
  ('00000000-0000-0000-0000-00000000a335', 'Shared', 'Shared with 200 and 300.', 'level', :'adm', true, now() - interval '1 hour'),
  ('00000000-0000-0000-0000-00000000a336', 'Legacy level', 'Legacy level notice.', 'level', :'adm', true, now() - interval '1 hour'),
  ('00000000-0000-0000-0000-00000000a337', 'Draft', 'Unpublished department draft.', 'department', :'adm', false, now() - interval '1 hour');
insert into public.announcement_audiences (announcement_id, audience_kind, department_id, level_code, offering_id) values
  ('00000000-0000-0000-0000-00000000a331', 'department', :'dept', null, null),
  ('00000000-0000-0000-0000-00000000a332', 'level', null, '200', null),
  ('00000000-0000-0000-0000-00000000a333', 'level', null, '300', null),
  ('00000000-0000-0000-0000-00000000a334', 'offering', null, null, '00000000-0000-0000-0000-0000000a0331'),
  ('00000000-0000-0000-0000-00000000a335', 'level', null, '200', null),
  ('00000000-0000-0000-0000-00000000a335', 'level', null, '300', null),
  ('00000000-0000-0000-0000-00000000a337', 'department', :'dept', null, null);
insert into public.lecture_sessions (course_id, offering_id, lecture_date, start_time, end_time, venue, created_by) values
  (:'get209', '00000000-0000-0000-0000-0000000a0331', '2026-11-30', '09:00', '11:00', 'LT1', :'adm'),
  ('00000000-0000-0000-0000-0000000c0330', '00000000-0000-0000-0000-0000000a0332', '2026-11-30', '12:00', '14:00', 'LT2', :'adm');
insert into public.quests (id, title, description, xp_reward, is_active, created_by) values
  ('00000000-0000-0000-0000-00000000d331', 'Quest 200', 'A level 200 quest here.', 10, true, :'adm'),
  ('00000000-0000-0000-0000-00000000d332', 'Quest 300', 'A level 300 quest here.', 10, true, :'adm'),
  ('00000000-0000-0000-0000-00000000d333', 'Quest none', 'A quest with no audience.', 10, true, :'adm');
insert into public.quest_audiences (quest_id, audience_kind, level_code) values
  ('00000000-0000-0000-0000-00000000d331', 'level', '200'),
  ('00000000-0000-0000-0000-00000000d332', 'level', '300');

create function pg_temp.counts() returns text language sql as $$
  select format('%s/%s/%s',
    (select count(*) from public.announcements),
    (select count(*) from public.lecture_sessions),
    (select count(*) from public.quests where is_active))
$$;

select tests.authenticate_as(:'s200');
select is(pg_temp.counts(), '4/1/1', 'level-200 student: announcements/lectures/quests');
select ok(not exists (select 1 from public.announcements where title = 'Level 300'), 'level-200 student cannot read the level-300 announcement directly');
select ok(exists (select 1 from public.announcements where title = 'Shared'), 'shared 200+300 announcement is visible to 200');
select ok(not exists (select 1 from public.announcements where title = 'Legacy level'), 'legacy level announcement without audience is hidden');
select ok(not exists (select 1 from public.quests where title = 'Quest none'), 'quest without audience is hidden');
select is((select count(*)::int from public.announcement_audiences where announcement_id = '00000000-0000-0000-0000-00000000a333'), 0, 'level-300 audience rows are hidden from a 200 student');

select tests.authenticate_as(:'s300');
select is(pg_temp.counts(), '4/2/1', 'level-300 carry-over student: announcements/lectures/quests');
select ok(exists (select 1 from public.announcements where title = 'GET209'), 'carry-over student reads the GET209 announcement');
select ok(not exists (select 1 from public.announcements where title = 'Level 200'), 'carry-over student does not read other level-200 content');
select ok(exists (select 1 from public.announcements where title = 'Shared'), 'shared announcement is visible to 300');
select throws_ok($$insert into public.quest_submissions (quest_id, student_id, evidence_url) values ('00000000-0000-0000-0000-00000000d331', auth.uid(), 'https://example.com/x')$$, '42501', null, 'cannot submit to a quest outside your audience');

select tests.authenticate_as(:'pend');
select is(pg_temp.counts(), '1/1/0', 'pending student: department notices and claimed-level timetable');

select tests.authenticate_as(:'susp');
select is(pg_temp.counts(), '0/0/0', 'suspended student sees nothing');

select tests.authenticate_as(:'adm');
select is(pg_temp.counts(), '7/2/3', 'admin sees everything');

-- Course rep manages, and only within scope.
select tests.authenticate_as(:'adm');
select public.grant_capability(:'s200', 'level_coordinator', '200', null, null, null, 'course rep for level 200');
select tests.authenticate_as(:'s200');
select ok(public.can_manage_announcement('00000000-0000-0000-0000-00000000a334'), 'rep manages the GET209@200 announcement');
select ok(not public.can_manage_announcement('00000000-0000-0000-0000-00000000a335'), 'rep does not manage the shared 200+300 announcement');
update public.announcements set title = 'Hacked' where id = '00000000-0000-0000-0000-00000000a335';
select tests.as_postgres();
select is((select title from public.announcements where id = '00000000-0000-0000-0000-00000000a335'), 'Shared', 'shared announcement unchanged');

-- The rollback restores the pre-E5 reads (everyone signed in reads published content).
\ir ../../rollback/037_audience_rls_down.sql
select tests.authenticate_as(:'s200');
select is((select count(*)::int from public.announcements where is_published), 6, 'after rollback: all published announcements readable');
select is((select count(*)::int from public.lecture_sessions), 2, 'after rollback: all lectures readable');
select is((select count(*)::int from public.quests where is_active), 3, 'after rollback: all active quests readable');
select tests.authenticate_as(:'pend');
select is((select count(*)::int from public.lecture_sessions), 2, 'after rollback: pending student reads every lecture again');
select tests.as_postgres();
select ok(exists (select 1 from pg_policies where tablename = 'announcements' and policyname = 'announcements_select_authenticated'), 'after rollback: old policy back');

select * from finish();
rollback;
