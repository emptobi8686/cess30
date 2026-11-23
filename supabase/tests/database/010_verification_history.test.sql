-- BP-001: verification history must not be reachable by anon, and students see only their own rows.
begin;
\ir _helpers.sql
select plan(8);

select tests.create_user('student-a@test.local', '{"full_name":"Student A","matric_number":"100000001"}') as student_a \gset
select tests.create_user('student-b@test.local', '{"full_name":"Student B","matric_number":"100000002"}') as student_b \gset
select tests.create_user('admin@test.local', '{"full_name":"Admin","matric_number":"100000003"}') as admin_id \gset
select tests.make_admin(:'admin_id');

insert into public.profile_verification_history (profile_id, previous_status, new_status, reviewed_by)
values (:'student_a', 'pending', 'verified', :'admin_id');

select tests.as_anon();
select throws_ok($$select * from public.profile_verification_history$$, '42501', null, 'anon cannot read history table');
select throws_ok($$select * from public.matric_verification_history$$, '42501', null, 'anon cannot read history view');

select tests.authenticate_as(:'student_a');
select results_eq($$select count(*)::int from public.profile_verification_history$$, array[1], 'student A sees own history row');
select throws_ok(
  format($$insert into public.profile_verification_history (profile_id, previous_status, new_status, reviewed_by) values (%L, 'pending', 'verified', %L)$$, :'student_a', :'student_a'),
  '42501', null, 'student cannot forge history');
select throws_ok($$delete from public.profile_verification_history$$, '42501', null, 'student cannot delete history');

select tests.authenticate_as(:'student_b');
select results_eq($$select count(*)::int from public.matric_verification_history$$, array[0], 'student B sees nothing through the view');

select tests.authenticate_as(:'admin_id');
select results_eq($$select count(*)::int from public.profile_verification_history$$, array[1], 'admin sees all history');
select results_eq($$select count(*)::int from public.matric_verification_history$$, array[1], 'admin sees all history through the view');

select * from finish();
rollback;
