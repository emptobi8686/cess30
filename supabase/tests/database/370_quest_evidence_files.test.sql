-- 043: file evidence is allowed, but only from the student's own folder; at least one of
-- link or file is required. Deleting a quest removes its submissions and keeps earned XP.
begin;
\ir _helpers.psql
select plan(7);

select tests.create_user('qe-admin@test.local', '{"full_name":"QE Admin","matric_number":"995000001"}') as adm \gset
select tests.create_user('qe-stu@test.local', '{"full_name":"QE Student","matric_number":"995000002"}') as stu \gset
select tests.create_user('qe-other@test.local', '{"full_name":"QE Other","matric_number":"995000003"}') as oth \gset
select tests.make_admin(:'adm');
select tests.set_verification(:'stu', 'verified');
select tests.set_verification(:'oth', 'verified');

insert into public.quests (id, title, description, xp_reward, due_date, is_active, created_by) values
  ('00000000-0000-0000-0000-0000000e0001', 'Evidence quest', 'Quest that takes a file', 40, now() + interval '7 days', true, :'adm');
insert into public.quest_audiences (quest_id, audience_kind, department_id)
values ('00000000-0000-0000-0000-0000000e0001', 'department', (select id from public.departments where code = 'CVE'));

select tests.authenticate_as(:'stu');
select lives_ok(
  format($$insert into public.quest_submissions (quest_id, student_id, evidence_path) values ('00000000-0000-0000-0000-0000000e0001', %L, %L)$$,
         :'stu', :'stu' || '/00000000-0000-0000-0000-0000000f0001.jpg'),
  'student can submit an uploaded file from their own folder');

select tests.authenticate_as(:'oth');
select throws_ok(
  format($$insert into public.quest_submissions (quest_id, student_id, evidence_path) values ('00000000-0000-0000-0000-0000000e0001', %L, %L)$$,
         :'oth', :'stu' || '/00000000-0000-0000-0000-0000000f0002.jpg'),
  '42501', null, 'student cannot point at another student''s file');
select throws_ok(
  format($$insert into public.quest_submissions (quest_id, student_id) values ('00000000-0000-0000-0000-0000000e0001', %L)$$, :'oth'),
  '23514', null, 'a submission needs a link or a file');
select throws_ok(
  format($$insert into public.quest_submissions (quest_id, student_id, evidence_path) values ('00000000-0000-0000-0000-0000000e0001', %L, %L)$$,
         :'oth', :'oth' || '/x.exe'),
  '23514', null, 'only server-shaped paths for photos and PDFs are accepted');

select tests.as_postgres();
select id as sub from public.quest_submissions where student_id = :'stu' \gset
select tests.authenticate_as(:'adm');
select public.review_quest_submission(:'sub', 'approved', null);
delete from public.quests where id = '00000000-0000-0000-0000-0000000e0001';

select tests.as_postgres();
select is((select count(*)::int from public.quests where id = '00000000-0000-0000-0000-0000000e0001'), 0, 'admin can delete a quest');
select is((select count(*)::int from public.quest_submissions where quest_id = '00000000-0000-0000-0000-0000000e0001'), 0, 'its submissions go with it');
select is((select coalesce(sum(xp_amount), 0)::int from public.xp_ledger where user_id = :'stu'), 40, 'XP already earned is kept');

select * from finish();
rollback;
