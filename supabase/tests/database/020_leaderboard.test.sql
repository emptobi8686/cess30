-- BP-004: get_leaderboard must return rows (bigint outputs), validate periods,
-- and rank only verified, non-admin students.
begin;
\ir _helpers.psql
select plan(6);

select tests.create_user('lb-a@test.local', '{"full_name":"Ada A","matric_number":"200000001"}') as a \gset
select tests.create_user('lb-b@test.local', '{"full_name":"Bola B","matric_number":"200000002"}') as b \gset
select tests.create_user('lb-c@test.local', '{"full_name":"Chi C","matric_number":"200000003"}') as c \gset
select tests.create_user('lb-admin@test.local', '{"full_name":"Admin","matric_number":"200000004"}') as adm \gset
select tests.set_verification(:'a', 'verified');
select tests.set_verification(:'b', 'verified');
select tests.set_verification(:'adm', 'verified');
select tests.make_admin(:'adm');

insert into public.xp_ledger (user_id, quest_id, xp_amount, reason, created_at) values
  (:'a', null, 100, 'recent award', now()),
  (:'a', null, 200, 'old award', now() - interval '40 days'),
  (:'b', null, 100, 'recent award', now()),
  (:'c', null, 500, 'pending student award', now()),
  (:'adm', null, 900, 'admin award', now());

select tests.authenticate_as(:'b');

select results_eq(
  $$select user_id, total_xp, rank from public.get_leaderboard('all-time') order by rank$$,
  format($$values (%L::uuid, 300::bigint, 1::bigint), (%L::uuid, 100::bigint, 2::bigint)$$, :'a', :'b'),
  'all-time ranks verified students by total XP');
select results_eq(
  format($$select total_xp from public.get_leaderboard('monthly') where user_id = %L$$, :'a'),
  array[100::bigint],
  'monthly excludes XP older than the current Lagos month');
select throws_ok($$select * from public.get_leaderboard('yearly')$$, '22023', null, 'unsupported period raises');
select is_empty(format($$select 1 from public.get_leaderboard() where user_id = %L$$, :'c'), 'pending students are excluded');
select is_empty(format($$select 1 from public.get_leaderboard() where user_id = %L$$, :'adm'), 'admins are excluded');

select tests.as_anon();
select throws_ok($$select * from public.get_leaderboard()$$, '42501', null, 'anon cannot call the leaderboard');

select * from finish();
rollback;
