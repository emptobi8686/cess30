begin;
\ir _helpers.psql
select plan(6);
select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'quests', 'quests table exists (migration 018)');
select has_table('public', 'xp_ledger', 'xp_ledger table exists (migration 018)');
select has_table('public', 'profile_verification_history', 'verification history exists (migration 015)');
select has_column('public', 'profiles', 'nickname', 'profiles.nickname exists (migration 014)');
select results_eq('select count(*)::int from public.courses', array[7], 'seed loads the 7 catalogue courses');
select * from finish();
rollback;
