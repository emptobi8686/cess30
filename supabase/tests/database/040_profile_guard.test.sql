-- BP-016 / BP-017 / BP-018 / BP-046: profile identity guard.
begin;
\ir _helpers.psql
select plan(12);

select tests.create_user('pg-admin@test.local', '{"full_name":"Guard Admin","matric_number":"400000001"}') as adm \gset
select tests.create_user('pg-verified@test.local', '{"full_name":"Verified Student","matric_number":"400000002"}') as ver \gset
select tests.create_user('pg-pending@test.local', '{"full_name":"Pending Student","matric_number":"400000003"}') as pen \gset
select tests.make_admin(:'adm');
select tests.set_verification(:'ver', 'verified');

-- BP-016: no admin self-verification via the own-row policy.
select tests.authenticate_as(:'adm');
select throws_ok(
  format($$update public.profiles set verification_status = 'verified' where id = %L$$, :'adm'),
  'P0001', null, 'admin cannot change their own verification status directly');

-- BP-017: names lock after verification; avatars must live in the user's own folder.
select tests.authenticate_as(:'ver');
select throws_ok(
  format($$update public.profiles set full_name = 'Someone Else' where id = %L$$, :'ver'),
  'P0001', null, 'verified student cannot rename themselves');
select throws_ok(
  format($$update public.profiles set avatar_url = 'https://evil.example/x.png' where id = %L$$, :'ver'),
  'P0001', null, 'avatar must point at the user''s own storage folder');
select throws_ok(
  format($$update public.profiles set avatar_url = 'https://evil.example/storage/v1/object/public/profile-pictures/%s/a.png' where id = %L$$, :'ver', :'ver'),
  'P0001', null, 'avatar on a foreign host is rejected even with a matching path');
select lives_ok(
  format($$update public.profiles set avatar_url = 'https://p.supabase.co/storage/v1/object/public/profile-pictures/%s/a.png' where id = %L$$, :'ver', :'ver'),
  'avatar in own storage folder is accepted');

select tests.authenticate_as(:'pen');
select lives_ok(
  format($$update public.profiles set full_name = 'Pending Student Renamed' where id = %L$$, :'pen'),
  'pending student can correct their name');

-- BP-046: no self-inserted profiles.
select tests.as_postgres();
select is(has_table_privilege('authenticated', 'public.profiles', 'INSERT'), false, 'authenticated cannot insert profiles');

-- BP-018: client-supplied cohort metadata is ignored.
select tests.create_user('pg-meta@test.local', '{"full_name":"Meta Student","matric_number":"400000009","level":"400","department":"Mechanical"}') as meta \gset
select results_eq(
  format($$select level, department from public.profiles where id = %L$$, :'meta'),
  $$values ('200'::text, 'Civil Engineering'::text)$$,
  'sign-up metadata cannot choose level or department');
select is(
  (select avatar_url from public.profiles where id = :'meta'),
  null, 'external sign-up pictures are not copied');

-- Duplicate matric at sign-up does not block account creation.
select tests.create_user('pg-dupe@test.local', '{"full_name":"Dupe Student","matric_number":"400000002"}') as dupe \gset
select is(
  (select matric_number from public.profiles where id = :'dupe'),
  null, 'duplicate matric at sign-up leaves matric empty instead of failing');

-- The verification RPC still works.
select tests.authenticate_as(:'adm');
select lives_ok(
  format($$select public.verify_profile_decision(%L, 'verified', null)$$, :'pen'),
  'admin can verify a pending student through the RPC');
select tests.as_postgres();
select is((select verification_status from public.profiles where id = :'pen'), 'verified', 'RPC decision is stored');

select * from finish();
rollback;
