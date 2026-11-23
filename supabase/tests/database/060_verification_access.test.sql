-- BP-005 (database layer): only verified students may create or change study sessions
-- and quest submissions; every status may still read and delete its own data.
begin;
\ir _helpers.sql
select plan(6);

select tests.create_user('va-pending@test.local', '{"full_name":"Pending","matric_number":"600000001"}') as pen \gset
select tests.create_user('va-verified@test.local', '{"full_name":"Verified","matric_number":"600000002"}') as ver \gset
select tests.create_user('va-suspended@test.local', '{"full_name":"Suspended","matric_number":"600000003"}') as sus \gset
select tests.create_user('va-admin@test.local', '{"full_name":"Admin","matric_number":"600000004"}') as adm \gset
select tests.set_verification(:'ver', 'verified');
select tests.set_verification(:'sus', 'suspended');
select tests.make_admin(:'adm');

insert into public.study_sessions (user_id, title, study_date, start_time, end_time)
values (:'sus', 'Old session', current_date, '09:00', '10:00');
insert into public.quests (id, title, description, xp_reward, is_active, created_by)
values ('00000000-0000-0000-0000-0000000000c1', 'Open quest', 'Open quest for access tests', 10, true, :'adm');

select tests.authenticate_as(:'pen');
select throws_ok(
  format($$insert into public.study_sessions (user_id, title, study_date, start_time, end_time) values (%L, 'Plan', current_date, '09:00', '10:00')$$, :'pen'),
  '42501', null, 'pending student cannot create study sessions');
select throws_ok(
  format($$insert into public.quest_submissions (quest_id, student_id, evidence_url) values ('00000000-0000-0000-0000-0000000000c1', %L, 'https://example.com/e')$$, :'pen'),
  '42501', null, 'pending student cannot submit quest evidence');

select tests.authenticate_as(:'ver');
select lives_ok(
  format($$insert into public.study_sessions (user_id, title, study_date, start_time, end_time) values (%L, 'Plan', current_date, '09:00', '10:00')$$, :'ver'),
  'verified student can create study sessions');

select tests.authenticate_as(:'sus');
select results_eq($$select count(*)::int from public.study_sessions$$, array[1], 'suspended student can still read own sessions');
select throws_ok(
  $$update public.study_sessions set title = 'Changed'$$,
  '42501', null, 'suspended student cannot edit sessions');
select lives_ok($$delete from public.study_sessions$$, 'suspended student can delete own sessions');

select * from finish();
rollback;
