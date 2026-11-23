-- E2: course offerings (course × semester × level).
begin;
\ir _helpers.psql
select plan(6);

select tests.create_user('co-admin@test.local', '{"full_name":"Admin","matric_number":"930000001"}') as adm \gset
select tests.create_user('co-student@test.local', '{"full_name":"Student","matric_number":"930000002"}') as stu \gset
select tests.make_admin(:'adm');

insert into public.academic_sessions (id, label, starts_on, ends_on)
values ('00000000-0000-0000-0000-00000000e101', '2026/2027', '2026-10-01', '2027-09-30');
insert into public.semesters (id, session_id, number, label, starts_on, ends_on)
values ('00000000-0000-0000-0000-00000000f101', '00000000-0000-0000-0000-00000000e101', 1, 'First Semester', '2026-10-05', '2027-02-26');
select id as ent from public.courses where course_code = 'ENT211' \gset

select tests.authenticate_as(:'adm');
select lives_ok(format($$insert into public.course_offerings (course_id, semester_id, level_code) values (%L, '00000000-0000-0000-0000-00000000f101', '200')$$, :'ent'),
  'admin offers a course to level 200');
select lives_ok(format($$insert into public.course_offerings (course_id, semester_id, level_code) values (%L, '00000000-0000-0000-0000-00000000f101', '300')$$, :'ent'),
  'the same course can be offered to another level in the same semester');
select throws_ok(format($$insert into public.course_offerings (course_id, semester_id, level_code) values (%L, '00000000-0000-0000-0000-00000000f101', '200')$$, :'ent'),
  '23505', null, 'duplicate offerings are rejected');
select is(public.offering_for(:'ent', '2026-11-24', '300') is not null, true, 'offering_for resolves by course, date and level');

select tests.authenticate_as(:'stu');
select throws_ok(format($$insert into public.course_offerings (course_id, semester_id, level_code) values (%L, '00000000-0000-0000-0000-00000000f101', '400')$$, :'ent'),
  '42501', null, 'students cannot create offerings');

select tests.as_postgres();
select throws_ok($$delete from public.semesters where id = '00000000-0000-0000-0000-00000000f101'$$,
  '23503', null, 'a semester with offerings cannot be deleted');

select * from finish();
rollback;
