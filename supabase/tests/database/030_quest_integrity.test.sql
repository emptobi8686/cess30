-- BP-014 / BP-015 / BP-008: quest submissions can only be created as honest pending
-- rows for open quests; XP can only be awarded through review; quests record their author.
begin;
\ir _helpers.psql
select plan(9);

select tests.create_user('q-admin@test.local', '{"full_name":"Quest Admin","matric_number":"300000001"}') as adm \gset
select tests.create_user('q-admin2@test.local', '{"full_name":"Other Admin","matric_number":"300000002"}') as adm2 \gset
select tests.create_user('q-student@test.local', '{"full_name":"Quest Student","matric_number":"300000003"}') as stu \gset
select tests.make_admin(:'adm');
select tests.make_admin(:'adm2');
select tests.set_verification(:'stu', 'verified');

insert into public.quests (id, title, description, xp_reward, due_date, is_active, created_by) values
  ('00000000-0000-0000-0000-0000000000a1', 'Open quest', 'An open quest for testing', 50, now() + interval '7 days', true, :'adm'),
  ('00000000-0000-0000-0000-0000000000a2', 'Inactive quest', 'An inactive quest for testing', 50, null, false, :'adm'),
  ('00000000-0000-0000-0000-0000000000a3', 'Overdue quest', 'An overdue quest for testing', 50, now() - interval '1 day', true, :'adm');

-- Department-wide audience so verified students can see (and submit to) the quests (E5).
insert into public.quest_audiences (quest_id, audience_kind, department_id)
select id, 'department', (select id from public.departments where code = 'CVE') from public.quests;
select tests.authenticate_as(:'stu');
select throws_ok(
  format($$insert into public.quest_submissions (quest_id, student_id, evidence_url, status) values ('00000000-0000-0000-0000-0000000000a1', %L, 'https://example.com/e', 'approved')$$, :'stu'),
  '42501', null, 'student cannot insert an approved submission');
select throws_ok(
  format($$insert into public.quest_submissions (quest_id, student_id, evidence_url) values ('00000000-0000-0000-0000-0000000000a2', %L, 'https://example.com/e')$$, :'stu'),
  '42501', null, 'student cannot submit to an inactive quest');
select throws_ok(
  format($$insert into public.quest_submissions (quest_id, student_id, evidence_url) values ('00000000-0000-0000-0000-0000000000a3', %L, 'https://example.com/e')$$, :'stu'),
  '42501', null, 'student cannot submit to an overdue quest');
select lives_ok(
  format($$insert into public.quest_submissions (quest_id, student_id, evidence_url) values ('00000000-0000-0000-0000-0000000000a1', %L, 'https://example.com/e')$$, :'stu'),
  'student can submit pending evidence to an open quest');

select tests.as_postgres();
select id as sub from public.quest_submissions where student_id = :'stu' \gset

select tests.authenticate_as(:'adm');
select throws_ok(
  format($$select public.award_xp(%L, null, 10000, 'self award')$$, :'adm'),
  '42501', null, 'admin cannot call award_xp directly');
select throws_ok(
  format($$insert into public.quests (title, description, xp_reward, created_by) values ('Forged author', 'Quest with a forged author', 10, %L)$$, :'adm2'),
  '42501', null, 'admin cannot create a quest attributed to someone else');
select lives_ok(
  format($$insert into public.quests (title, description, xp_reward, created_by) values ('Own quest', 'Quest with the correct author', 10, %L)$$, :'adm'),
  'admin can create a quest attributed to themselves');
select lives_ok(
  format($$select public.review_quest_submission(%L, 'approved', null)$$, :'sub'),
  'admin can approve a pending submission');

select tests.as_postgres();
select results_eq(
  format($$select count(*)::int from public.xp_ledger where user_id = %L$$, :'stu'),
  array[1], 'approval writes exactly one XP ledger row');

select * from finish();
rollback;
