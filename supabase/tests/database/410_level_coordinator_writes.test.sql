-- Decision 0004: a course representative (level_coordinator) runs their own level only.
begin;
\ir _helpers.psql
select plan(28);

select tests.create_user('lc-admin@test.local', '{"full_name":"Admin","matric_number":"960000001"}') as adm \gset
select tests.create_user('lc-rep@test.local', '{"full_name":"Rep Two","matric_number":"960000002"}') as rep \gset
select tests.create_user('lc-s200@test.local', '{"full_name":"Student Two","matric_number":"960000003"}') as s200 \gset
select tests.create_user('lc-s300@test.local', '{"full_name":"Student Three","matric_number":"960000004"}') as s300 \gset
select tests.create_user('lc-out@test.local', '{"full_name":"Outsider","matric_number":"960000005"}') as outsider \gset
select tests.make_admin(:'adm');
select tests.set_verification(:'adm', 'verified');
select tests.set_verification(:'rep', 'verified');
select tests.set_verification(:'s200', 'verified');
select tests.set_verification(:'s300', 'verified');
select tests.set_verification(:'outsider', 'pending');

insert into public.academic_sessions (id, label, starts_on, ends_on, is_current)
values ('00000000-0000-0000-0000-00000000e411', '2026/2027', '2026-10-01', '2027-09-30', true);
insert into public.semesters (id, session_id, number, label, starts_on, ends_on, is_current)
values ('00000000-0000-0000-0000-00000000f411', '00000000-0000-0000-0000-00000000e411', 1, 'First Semester', '2026-10-05', '2027-02-26', true);
insert into public.courses (id, course_code, course_title, credit_units, level, department)
values ('00000000-0000-0000-0000-0000000c0301', 'CEE301', 'Structural Analysis I', 3, '300', 'Civil Engineering');
select id as get209 from public.courses where course_code = 'GET209' \gset
insert into public.course_offerings (id, course_id, semester_id, level_code) values
  ('00000000-0000-0000-0000-0000000a0411', :'get209', '00000000-0000-0000-0000-00000000f411', '200'),
  ('00000000-0000-0000-0000-0000000a0412', '00000000-0000-0000-0000-0000000c0301', '00000000-0000-0000-0000-00000000f411', '300');
insert into public.student_placements (id, student_id, session_id, level_code) values
  ('00000000-0000-0000-0000-0000000b0411', :'s200', '00000000-0000-0000-0000-00000000e411', '200'),
  ('00000000-0000-0000-0000-0000000b0412', :'s300', '00000000-0000-0000-0000-00000000e411', '300'),
  ('00000000-0000-0000-0000-0000000b0413', :'rep',  '00000000-0000-0000-0000-00000000e411', '200');
insert into public.quests (id, title, description, xp_reward, is_active, created_by, level_code) values
  ('00000000-0000-0000-0000-0000000d0412', 'Level 300 quest', 'A quest for level 300 students.', 50, true, :'adm', '300');

select tests.authenticate_as(:'adm');
select public.grant_capability(:'rep', 'level_coordinator', '200', null, null, null, 'course rep for level 200');

select tests.authenticate_as(:'rep');
-- Courses: own level only; no level moves; no deletes.
select lives_ok($$insert into public.courses (course_code, course_title, credit_units, level, department) values ('CEE205', 'Surveying I', 2, '200', 'Civil Engineering')$$, 'rep adds a level-200 course');
select throws_ok($$insert into public.courses (course_code, course_title, credit_units, level, department) values ('CEE305', 'Hydraulics', 2, '300', 'Civil Engineering')$$, '42501', null, 'rep cannot add a level-300 course');
select throws_ok($$update public.courses set level = '300' where course_code = 'CEE205'$$, '42501', null, 'moving a course to level 300 is refused');
delete from public.courses where course_code = 'CEE205';
select is((select count(*)::int from public.courses where course_code = 'CEE205'), 1, 'rep cannot delete courses');

-- Offerings.
select lives_ok(format($$insert into public.course_offerings (course_id, semester_id, level_code) values (%L, '00000000-0000-0000-0000-00000000f411', '200')$$, (select id from public.courses where course_code = 'GET211')), 'rep offers a course to level 200');
select throws_ok(format($$insert into public.course_offerings (course_id, semester_id, level_code) values (%L, '00000000-0000-0000-0000-00000000f411', '300')$$, (select id from public.courses where course_code = 'GET211')), '42501', null, 'rep cannot offer to level 300');

-- Timetable.
select lives_ok(format($$insert into public.lecture_sessions (course_id, lecture_date, start_time, end_time, venue, created_by) values (%L, '2026-11-30', '09:00', '11:00', 'LT1', auth.uid())$$, :'get209'), 'rep schedules a level-200 lecture');
select throws_ok($$insert into public.lecture_sessions (course_id, lecture_date, start_time, end_time, venue, created_by) values ('00000000-0000-0000-0000-0000000c0301', '2026-11-30', '09:00', '11:00', 'LT1', auth.uid())$$, '42501', null, 'rep cannot schedule a level-300 lecture');

-- Announcements: course announcements for own level only.
select lives_ok(format($$insert into public.announcements (title, content, scope, course_id, created_by) values ('GET209 test moved', 'The GET209 test now holds on Friday.', 'course', %L, auth.uid())$$, :'get209'), 'rep posts a GET209 announcement');
select throws_ok($$insert into public.announcements (title, content, scope, course_id, created_by) values ('CEE301 notice', 'Notice for level 300 students.', 'course', '00000000-0000-0000-0000-0000000c0301', auth.uid())$$, '42501', null, 'rep cannot post for a level-300 course');
select throws_ok($$insert into public.announcements (title, content, scope, created_by) values ('Department notice', 'A notice for the whole department.', 'all', auth.uid())$$, '42501', null, 'rep cannot post department-wide');

-- Quests: own level only.
select lives_ok($$insert into public.quests (title, description, xp_reward, is_active, created_by, level_code) values ('Level 200 quest', 'Solve the tutorial sheet for level 200.', 50, true, auth.uid(), '200')$$, 'rep creates a level-200 quest');
select throws_ok($$insert into public.quests (title, description, xp_reward, is_active, created_by, level_code) values ('Another 300 quest', 'Something for level 300 students.', 50, true, auth.uid(), '300')$$, '42501', null, 'rep cannot create a level-300 quest');
select throws_ok($$insert into public.quests (title, description, xp_reward, is_active, created_by) values ('Department quest', 'A department-wide quest for everyone.', 50, true, auth.uid())$$, '42501', null, 'rep cannot create a department-wide quest');

-- Quest review: own level, never own submission.
select id as q200 from public.quests where title = 'Level 200 quest' \gset
select tests.authenticate_as(:'s200');
insert into public.quest_submissions (quest_id, student_id, evidence_url) values (:'q200', auth.uid(), 'https://example.com/s200');
select tests.authenticate_as(:'s300');
insert into public.quest_submissions (quest_id, student_id, evidence_url) values ('00000000-0000-0000-0000-0000000d0412', auth.uid(), 'https://example.com/s300');
select tests.authenticate_as(:'rep');
insert into public.quest_submissions (quest_id, student_id, evidence_url) values (:'q200', auth.uid(), 'https://example.com/rep');
select tests.as_postgres();
select id as sub200 from public.quest_submissions where student_id = :'s200' \gset
select id as sub300 from public.quest_submissions where student_id = :'s300' \gset
select id as subrep from public.quest_submissions where student_id = :'rep' \gset
select tests.authenticate_as(:'rep');
select lives_ok(format($$select public.review_quest_submission(%L, 'approved', null)$$, :'sub200'), 'rep approves a level-200 submission');
select tests.as_postgres();
select is((select xp_amount from public.xp_ledger where user_id = :'s200'), 50, 'XP is awarded on a rep approval');
select tests.authenticate_as(:'rep');
select throws_ok(format($$select public.review_quest_submission(%L, 'approved', null)$$, :'sub300'), 'P0001', 'You cannot review submissions for this quest.', 'rep cannot review a level-300 submission');
select throws_ok(format($$select public.review_quest_submission(%L, 'approved', null)$$, :'subrep'), 'P0001', 'Administrators cannot review their own quest submissions.', 'rep cannot review their own submission');

-- Placements: own level, never own.
select is((select count(*)::int from public.student_placements), 2, 'rep sees level-200 placements only (own + classmate)');
select lives_ok($$select public.confirm_placements(array['00000000-0000-0000-0000-0000000b0411'::uuid], 'confirmed', null)$$, 'rep confirms a classmate');
select throws_ok($$select public.confirm_placements(array['00000000-0000-0000-0000-0000000b0413'::uuid], 'confirmed', null)$$, 'P0001', 'You cannot confirm your own placement.', 'rep cannot confirm own placement');
select throws_ok($$select public.confirm_placements(array['00000000-0000-0000-0000-0000000b0412'::uuid], 'confirmed', null)$$, 'P0001', 'You can only confirm placements for levels you coordinate.', 'rep cannot confirm level 300');

-- Enrolments.
select lives_ok($$select public.enroll_level_core('00000000-0000-0000-0000-00000000f411', '200')$$, 'rep enrols level 200');
select throws_ok($$select public.enroll_level_core('00000000-0000-0000-0000-00000000f411', '300')$$, 'P0001', 'You can only manage enrolments for levels you coordinate.', 'rep cannot enrol level 300');

-- Profiles: classmates visible, others not.
select is((select count(*)::int from public.profiles where id in (:'s200', :'s300', :'outsider')), 1, 'rep reads level-200 classmates only');

-- Never verification or granting.
select throws_ok(format($$select public.verify_profile_decision(%L, 'verified', null)$$, :'outsider'), 'P0001', null, 'rep cannot verify identities');
select throws_ok(format($$select public.grant_capability(%L, 'level_coordinator', '200', null, null, null, 'rep tries to delegate')$$, :'s200'), 'P0001', 'Department administrator access required.', 'rep cannot grant');

-- Expiry stops everything immediately.
select tests.as_postgres();
update public.staff_assignments set expires_at = now() - interval '1 second' where user_id = :'rep';
select tests.authenticate_as(:'rep');
select throws_ok($$insert into public.courses (course_code, course_title, credit_units, level, department) values ('CEE207', 'Geology', 2, '200', 'Civil Engineering')$$, '42501', null, 'expired rep loses write access');

select * from finish();
rollback;
