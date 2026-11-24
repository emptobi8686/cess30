-- E2E seed users for the CI Supabase stack (never run against production).
-- Password for every account: Blueprint-e2e-2026!
-- Accounts: verified, pending, rejected, suspended students; one admin (also a student);
-- placed (confirmed level 200) and carry (confirmed level 300) for the enrolment journey.
create extension if not exists pgcrypto with schema extensions;

do $$
declare
  v_accounts jsonb := '[
    {"email":"verified@e2e.test","name":"Vera Verified","matric":"900000001","status":"verified","admin":false},
    {"email":"pending@e2e.test","name":"Peter Pending","matric":"900000002","status":"pending","admin":false},
    {"email":"rejected@e2e.test","name":"Rita Rejected","matric":"900000003","status":"rejected","admin":false},
    {"email":"suspended@e2e.test","name":"Sam Suspended","matric":"900000004","status":"suspended","admin":false},
    {"email":"admin@e2e.test","name":"Ada Admin","matric":"900000005","status":"verified","admin":true},
    {"email":"placed@e2e.test","name":"Paula Placed","matric":"900000006","status":"verified","admin":false},
    {"email":"carry@e2e.test","name":"Carl Carryover","matric":"900000007","status":"verified","admin":false}
  ]';
  v_account jsonb;
  v_id uuid;
begin
  for v_account in select * from jsonb_array_elements(v_accounts) loop
    if exists (select 1 from auth.users where email = v_account->>'email') then
      continue;
    end if;

    v_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      v_account->>'email', extensions.crypt('Blueprint-e2e-2026!', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', v_account->>'name', 'matric_number', v_account->>'matric'),
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_id, v_id::text,
            jsonb_build_object('sub', v_id::text, 'email', v_account->>'email'),
            'email', now(), now(), now());

    alter table public.profiles disable trigger user;
    update public.profiles set verification_status = v_account->>'status' where id = v_id;
    alter table public.profiles enable trigger user;

    if (v_account->>'admin')::boolean then
      insert into public.user_roles (user_id, role, assigned_by) values
        (v_id, 'student', v_id), (v_id, 'admin', v_id)
      on conflict (user_id, role) do nothing;
    end if;
  end loop;
end $$;

-- A current session and semester so placement and offering journeys have a term to act on.
insert into public.academic_sessions (label, starts_on, ends_on, is_current)
values ('2026/2027', '2026-10-01', '2027-09-30', true)
on conflict (label) do nothing;
insert into public.semesters (session_id, number, label, starts_on, ends_on, is_current)
select id, 1, 'First semester', '2026-10-01', '2027-02-28', true
from public.academic_sessions where label = '2026/2027'
on conflict (session_id, number) do nothing;

-- Confirmed placements (200 and 300) and a level-200 GET209 offering for the enrolment journey.
insert into public.student_placements (student_id, session_id, level_code, status, source, confirmed_at)
select p.id, s.id, v.level, 'confirmed', 'admin', now()
from (values ('900000006', '200'), ('900000007', '300')) as v(matric, level)
join public.profiles p on p.matric_number = v.matric
cross join public.academic_sessions s
where s.label = '2026/2027'
on conflict (student_id, session_id) do nothing;

insert into public.course_offerings (course_id, semester_id, level_code, status)
select c.id, sem.id, '200', 'active'
from public.courses c
join public.semesters sem on sem.number = 1
join public.academic_sessions s on s.id = sem.session_id and s.label = '2026/2027'
where c.course_code = 'GET209'
on conflict (course_id, semester_id, level_code) do nothing;

-- A legacy level announcement for the migration review journey (E4): the backfill hides it
-- and queues it for an administrator.
insert into public.announcements (title, content, scope, created_by, is_published, published_at)
select 'Legacy level notice', 'Posted before levels existed.', 'level', p.id, true, now() - interval '1 day'
from public.profiles p where p.matric_number = '900000005'
and not exists (select 1 from public.announcements where title = 'Legacy level notice');
select public.run_legacy_backfill();

-- Library (P8): a published level-200 resource. Its file row exists for publishing rules;
-- the storage object is not uploaded in CI, so the journey covers search, detail,
-- bookmarks, reports and access denial (404), not the signed download itself.
insert into public.library_resources (id, title, description, resource_type, level_code, copyright_basis, tags, created_by)
select '00000000-0000-0000-0000-0000000e2e01', 'Beam Theory Notes', 'Bending moments and shear in simply supported beams.',
       'course_notes', '200', 'own_work', array['beams', 'statics'], p.id
from public.profiles p where p.matric_number = '900000005'
on conflict (id) do nothing;
insert into public.library_files (id, resource_id, version, storage_path, mime_type, size_bytes, original_filename, uploaded_by, scan_status)
select '00000000-0000-0000-0000-0000000e2e02', '00000000-0000-0000-0000-0000000e2e01', 1,
       'resources/00000000-0000-0000-0000-0000000e2e01/00000000-0000-0000-0000-0000000e2e02.pdf',
       'application/pdf', 1024, 'beam-theory.pdf', created_by, 'not_scanned'
from public.library_resources where id = '00000000-0000-0000-0000-0000000e2e01'
on conflict (id) do nothing;
insert into public.library_resource_audiences (resource_id, audience_kind, level_code)
select '00000000-0000-0000-0000-0000000e2e01', 'level', '200'
where not exists (select 1 from public.library_resource_audiences where resource_id = '00000000-0000-0000-0000-0000000e2e01');
update public.library_resources
set current_file_id = '00000000-0000-0000-0000-0000000e2e02', status = 'published', published_by = created_by
where id = '00000000-0000-0000-0000-0000000e2e01' and status = 'draft';
