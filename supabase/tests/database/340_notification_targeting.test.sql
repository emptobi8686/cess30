-- E4/E5: notification targeting runs in SQL against audiences and enrolments.
begin;
\ir _helpers.psql
select plan(9);

select tests.create_user('nt-admin@test.local', '{"full_name":"Admin","matric_number":"991000001"}') as adm \gset
select tests.create_user('nt-a300@test.local', '{"full_name":"A300","matric_number":"991000002"}') as a300 \gset
select tests.create_user('nt-b300@test.local', '{"full_name":"B300 muted","matric_number":"991000003"}') as b300 \gset
select tests.create_user('nt-p300@test.local', '{"full_name":"Pending 300","matric_number":"991000004"}') as p300 \gset
select tests.create_user('nt-s200@test.local', '{"full_name":"S200","matric_number":"991000005"}') as s200 \gset
select tests.create_user('nt-drop@test.local', '{"full_name":"Dropped","matric_number":"991000006"}') as dropped \gset
select tests.make_admin(:'adm');
select tests.set_verification(:'a300', 'verified');
select tests.set_verification(:'b300', 'verified');
select tests.set_verification(:'s200', 'verified');
select tests.set_verification(:'dropped', 'verified');
update public.notification_preferences set announcement_notifications_enabled = false where user_id = :'b300';

insert into public.academic_sessions (id, label, starts_on, ends_on, is_current)
values ('00000000-0000-0000-0000-00000000e340', '2026/2027', '2026-10-01', '2027-09-30', true);
insert into public.semesters (id, session_id, number, label, starts_on, ends_on, is_current)
values ('00000000-0000-0000-0000-00000000f340', '00000000-0000-0000-0000-00000000e340', 1, 'First Semester', '2026-10-05', '2027-02-26', true);
select id as get209 from public.courses where course_code = 'GET209' \gset
insert into public.course_offerings (id, course_id, semester_id, level_code)
values ('00000000-0000-0000-0000-0000000a0340', :'get209', '00000000-0000-0000-0000-00000000f340', '200');
insert into public.student_placements (student_id, session_id, level_code, status) values
  (:'a300', '00000000-0000-0000-0000-00000000e340', '300', 'confirmed'),
  (:'b300', '00000000-0000-0000-0000-00000000e340', '300', 'confirmed'),
  (:'p300', '00000000-0000-0000-0000-00000000e340', '300', 'confirmed'),
  (:'s200', '00000000-0000-0000-0000-00000000e340', '200', 'confirmed');
insert into public.course_enrollments (student_id, offering_id, enrolment_type, status) values
  (:'s200', '00000000-0000-0000-0000-0000000a0340', 'core', 'active'),
  (:'a300', '00000000-0000-0000-0000-0000000a0340', 'carryover', 'active'),
  (:'dropped', '00000000-0000-0000-0000-0000000a0340', 'core', 'dropped');

insert into public.announcements (id, title, content, scope, created_by, is_published, published_at)
values ('00000000-0000-0000-0000-00000000a340', 'Level 300', 'For level 300 students.', 'level', :'adm', true, now());
insert into public.announcement_audiences (announcement_id, audience_kind, level_code)
values ('00000000-0000-0000-0000-00000000a340', 'level', '300');
insert into public.lecture_sessions (id, course_id, offering_id, lecture_date, start_time, end_time, venue, created_by)
values ('00000000-0000-0000-0000-00000000b340', :'get209', '00000000-0000-0000-0000-0000000a0340',
        ((now() at time zone 'Africa/Lagos') + interval '1 day')::date, '09:00', '11:00', 'LT1', :'adm');

select results_eq(
  $$select user_id from public.announcement_recipients('00000000-0000-0000-0000-00000000a340') order by 1$$,
  format('select %L::uuid', :'a300'),
  'level-300 recipients: verified level-300 students with the preference on (not muted, not pending, not 200)');

select ok(exists (select 1 from public.lecture_reminder_candidates(now(), now() + interval '3 days') where user_id = :'a300'), 'carry-over student gets the GET209 reminder');
select ok(exists (select 1 from public.lecture_reminder_candidates(now(), now() + interval '3 days') where user_id = :'s200'), 'core student gets the reminder');
select ok(not exists (select 1 from public.lecture_reminder_candidates(now(), now() + interval '3 days') where user_id = :'dropped'), 'dropped enrolment gets no reminder');
select is((select course_code from public.lecture_reminder_candidates(now(), now() + interval '3 days') limit 1), 'GET209', 'candidate carries the course code');
select ok(not exists (select 1 from public.lecture_reminder_candidates(now() + interval '5 days', now() + interval '6 days')), 'window filters by start time');

select tests.authenticate_as(:'a300');
select throws_ok($$select * from public.announcement_recipients('00000000-0000-0000-0000-00000000a340')$$, '42501', null, 'students cannot list recipients');
select throws_ok($$select * from public.lecture_reminder_candidates(now(), now() + interval '1 day')$$, '42501', null, 'students cannot list reminder candidates');
select tests.as_postgres();
select ok(public.audience_matches_for(:'s200', 'offering', null, null, null, '00000000-0000-0000-0000-0000000a0340', null, null), 'audience_matches_for evaluates another user');

select * from finish();
rollback;
