-- Migration 042: create the missing profile rows for accounts made before 030.
--
-- Until 030, handle_new_user skipped sign-ups without a matric number, so early
-- Google sign-ups have an auth account but no profile. Such a student never shows
-- in the verification queue and cannot submit a matric number (the update matches
-- no row), so they see no content. This applies the 030 defaults to those accounts.
-- Admin accounts are left alone. Safe to re-run.

insert into public.profiles (id, full_name, matric_number, department, department_id, level, avatar_url, verification_status)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''),
  null,
  'Civil Engineering',
  (select id from public.departments where name = 'Civil Engineering'),
  '200',
  null,
  'pending'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
  and not exists (select 1 from public.user_roles r where r.user_id = u.id and r.role = 'admin')
on conflict (id) do nothing;
