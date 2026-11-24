-- E3: student placements, enrolments and the access-context helpers.
begin;
\ir _helpers.psql
select plan(10);

select tests.create_user('pl-admin@test.local', '{"full_name":"Admin","matric_number":"940000001"}') as adm \gset
select tests.create_user('pl-student@test.local', '{"full_name":"Student","matric_number":"940000002"}') as stu \gset
select tests.create_user('pl-other@test.local', '{"full_name":"Other","matric_number":"940000003"}') as oth \gset
select tests.make_admin(:'adm');
select tests.set_verification(:'stu', 'verified');
select tests.set_verification(:'oth', 'verified');
select tests.set_verification(:'adm', 'verified');

insert into public.academic_sessions (id, label, starts_on, ends_on, is_current)
values ('00000000-0000-0000-0000-00000000e201', '2026/2027', '2026-10-01', '2027-09-30', true);
insert into public.semesters (id, session_id, number, label, starts_on, ends_on, is_current)
values ('00000000-0000-0000-0000-00000000f201', '00000000-0000-0000-0000-00000000e201', 1, 'First Semester', '2026-10-05', '2027-02-26', true);
insert into public.course_offerings (course_id, semester_id, level_code)
select id, '00000000-0000-0000-0000-00000000f201', '400' from public.courses where course_code in ('GET209', 'GET211');

-- Student claims a level; it grants nothing until confirmed.
select tests.authenticate_as(:'stu');
select lives_ok($$select public.request_placement('400')$$, 'student requests a placement for the current session');
select is((select status from public.student_placements where student_id = auth.uid()), 'claimed', 'placement starts as claimed');
select is(public.my_confirmed_level(), null, 'a claimed placement grants no level');
select throws_ok(
  $$insert into public.course_enrollments (student_id, offering_id, enrolment_type) select auth.uid(), id, 'core' from public.course_offerings limit 1$$,
  '42501', null, 'students cannot enrol themselves directly');

-- Admin confirms; level follows.
select tests.authenticate_as(:'adm');
select results_eq(
  format($$select public.confirm_placements(array(select id from public.student_placements where student_id = %L), 'confirmed', null)$$, :'stu'),
  array[1], 'admin confirms the placement');

select tests.authenticate_as(:'stu');
select is(public.my_confirmed_level(), '400', 'confirmed placement sets the level');
select tests.as_postgres();
select is((select level from public.profiles where id = :'stu'), '400', 'profile level is updated by the placement workflow');

-- Admins cannot confirm their own placement.
select tests.authenticate_as(:'adm');
select public.request_placement('300');
select throws_ok(
  $$select public.confirm_placements(array(select id from public.student_placements where student_id = auth.uid()), 'confirmed', null)$$,
  'P0001', null, 'nobody confirms their own placement');

-- Core enrolment is idempotent.
select results_eq($$select public.enroll_level_core('00000000-0000-0000-0000-00000000f201', '400')$$, array[2], 'enrols confirmed level-400 students into both offerings');
select results_eq($$select public.enroll_level_core('00000000-0000-0000-0000-00000000f201', '400')$$, array[0], 'running it again adds nothing');

select * from finish();
rollback;
