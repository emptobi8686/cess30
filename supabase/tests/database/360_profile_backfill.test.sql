-- Accounts created before 030 had no profile row; 042 backfills students only.
begin;
\ir _helpers.psql
select plan(3);

-- An account from before 030 with no profile, and an admin with no profile.
alter table auth.users disable trigger on_auth_user_created;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000a360', 'early@example.test', '{"name":"Early Student"}'),
  ('00000000-0000-0000-0000-00000000b360', 'boss@example.test', '{}');
alter table auth.users enable trigger on_auth_user_created;
select tests.make_admin('00000000-0000-0000-0000-00000000b360');

\ir ../../migrations/042_profile_backfill.sql

select is(
  (select verification_status::text from public.profiles where id = '00000000-0000-0000-0000-00000000a360'),
  'pending', 'early sign-up now has a pending profile');
select is(
  (select full_name from public.profiles where id = '00000000-0000-0000-0000-00000000a360'),
  'Early Student', 'name copied from Google metadata');
select is(
  (select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-00000000b360'),
  0, 'admin account left without a student profile');

select * from finish();
rollback;
