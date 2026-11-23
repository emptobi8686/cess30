-- BP-029: students can cancel their own pending submissions and resubmit afterwards.
begin;
\ir _helpers.psql
select plan(6);

select tests.create_user('qc-admin@test.local', '{"full_name":"Admin","matric_number":"800000001"}') as adm \gset
select tests.create_user('qc-a@test.local', '{"full_name":"Student A","matric_number":"800000002"}') as a \gset
select tests.create_user('qc-b@test.local', '{"full_name":"Student B","matric_number":"800000003"}') as b \gset
select tests.make_admin(:'adm');
select tests.set_verification(:'a', 'verified');
select tests.set_verification(:'b', 'verified');

insert into public.quests (id, title, description, xp_reward, is_active, created_by)
values ('00000000-0000-0000-0000-0000000000d1', 'Open quest', 'Open quest for cancel tests', 10, true, :'adm');

-- Department-wide audience so verified students can see (and submit to) the quests (E5).
insert into public.quest_audiences (quest_id, audience_kind, department_id)
select id, 'department', (select id from public.departments where code = 'CVE') from public.quests;
select tests.authenticate_as(:'a');
insert into public.quest_submissions (quest_id, student_id, evidence_url)
values ('00000000-0000-0000-0000-0000000000d1', :'a', 'https://example.com/first');
select tests.as_postgres();
select id as sub from public.quest_submissions where student_id = :'a' \gset

select tests.authenticate_as(:'b');
select throws_ok(format($$select public.cancel_quest_submission(%L)$$, :'sub'), 'P0001', null, 'another student cannot cancel it');

select tests.authenticate_as(:'a');
select lives_ok(format($$select public.cancel_quest_submission(%L)$$, :'sub'), 'owner cancels a pending submission');
select tests.as_postgres();
select is((select status from public.quest_submissions where id = :'sub'), 'cancelled', 'status becomes cancelled');

select tests.authenticate_as(:'a');
select lives_ok(
  format($$insert into public.quest_submissions (quest_id, student_id, evidence_url) values ('00000000-0000-0000-0000-0000000000d1', %L, 'https://example.com/second')$$, :'a'),
  'student can resubmit after cancelling');
select throws_ok(
  format($$insert into public.quest_submissions (quest_id, student_id, evidence_url) values ('00000000-0000-0000-0000-0000000000d1', %L, 'https://example.com/third')$$, :'a'),
  '23505', null, 'only one active submission per quest');

select tests.authenticate_as(:'adm');
select tests.as_postgres();
select id as sub2 from public.quest_submissions where student_id = :'a' and status = 'pending' \gset
select tests.authenticate_as(:'adm');
select public.review_quest_submission(:'sub2', 'approved', null);
select tests.authenticate_as(:'a');
select throws_ok(format($$select public.cancel_quest_submission(%L)$$, :'sub2'), 'P0001', null, 'approved submissions cannot be cancelled');

select * from finish();
rollback;
