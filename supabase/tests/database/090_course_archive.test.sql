-- BP-030: courses can be archived; referenced courses cannot be deleted.
begin;
\ir _helpers.psql
select plan(5);

select tests.create_user('ca-admin@test.local', '{"full_name":"Admin","matric_number":"900100001"}') as adm \gset
select tests.create_user('ca-student@test.local', '{"full_name":"Student","matric_number":"900100002"}') as stu \gset
select tests.make_admin(:'adm');

select id as course from public.courses where course_code = 'GET209' \gset
insert into public.lecture_sessions (course_id, lecture_date, start_time, end_time, venue, created_by)
values (:'course', current_date, '09:00', '11:00', 'LT1', :'adm');

select has_column('public', 'courses', 'archived_at', 'courses have an archive timestamp');

select tests.authenticate_as(:'adm');
select throws_ok(format($$delete from public.courses where id = %L$$, :'course'), '23503', null,
  'a course with lectures cannot be deleted (no cascade)');
select lives_ok(format($$update public.courses set archived_at = now() where id = %L$$, :'course'),
  'admin can archive a course');

select tests.authenticate_as(:'stu');
select lives_ok(format($$update public.courses set archived_at = null where id = %L$$, :'course'),
  'student update is silently filtered by RLS');
select tests.as_postgres();
select ok((select archived_at is not null from public.courses where id = :'course'), 'archive persisted (student update changed nothing)');

select * from finish();
rollback;
