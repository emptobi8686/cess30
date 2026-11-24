-- E1: departments, levels, sessions and semesters.
begin;
\ir _helpers.psql
select plan(11);

select tests.create_user('as-admin@test.local', '{"full_name":"Admin","matric_number":"920000001"}') as adm \gset
select tests.create_user('as-student@test.local', '{"full_name":"Student","matric_number":"920000002"}') as stu \gset
select tests.make_admin(:'adm');

select results_eq($$select code from public.academic_levels order by ordinal$$,
  array['100','200','300','400','500'], 'levels 100–500 are seeded');
select ok((select count(*) = 1 from public.departments where name = 'Civil Engineering'), 'Civil Engineering department exists');
select is_empty($$select 1 from public.courses where department_id is null$$, 'courses are linked to the department');
select is_empty($$select 1 from public.profiles where department = 'Civil Engineering' and department_id is null$$,
  'profiles are linked to the department');

select tests.authenticate_as(:'stu');
select throws_ok($$insert into public.academic_sessions (label, starts_on, ends_on) values ('2030/2031', '2030-10-01', '2031-09-30')$$,
  '42501', null, 'students cannot create sessions');

select tests.authenticate_as(:'adm');
insert into public.academic_sessions (id, label, starts_on, ends_on) values
  ('00000000-0000-0000-0000-00000000e001', '2026/2027', '2026-10-01', '2027-09-30'),
  ('00000000-0000-0000-0000-00000000e002', '2027/2028', '2027-10-01', '2028-09-30');
insert into public.semesters (id, session_id, number, label, starts_on, ends_on) values
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000e001', 1, 'First Semester', '2026-10-05', '2027-02-26'),
  ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000e001', 2, 'Second Semester', '2027-03-15', '2027-07-30');

select throws_ok($$insert into public.semesters (session_id, number, label, starts_on, ends_on) values ('00000000-0000-0000-0000-00000000e001', 3, 'Outside', '2027-08-01', '2027-11-30')$$,
  '23514', null, 'a semester must lie within its session');

select lives_ok($$select public.set_current_session('00000000-0000-0000-0000-00000000e001')$$, 'admin sets the current session');
select lives_ok($$select public.set_current_session('00000000-0000-0000-0000-00000000e002')$$, 'switching the current session succeeds');
select results_eq($$select count(*)::int from public.academic_sessions where is_current$$, array[1], 'exactly one current session');

select is(public.semester_for_date('2026-11-24'), '00000000-0000-0000-0000-00000000f001'::uuid, 'date inside the first semester resolves');
select is(public.semester_for_date('2027-03-01'), null, 'a date between semesters resolves to null');

select * from finish();
rollback;
