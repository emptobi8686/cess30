-- E2E seed users for the CI Supabase stack (never run against production).
-- Password for every account: Blueprint-e2e-2026!
-- Accounts: verified, pending, rejected, suspended students; one admin (also a student).
create extension if not exists pgcrypto with schema extensions;

do $$
declare
  v_accounts jsonb := '[
    {"email":"verified@e2e.test","name":"Vera Verified","matric":"900000001","status":"verified","admin":false},
    {"email":"pending@e2e.test","name":"Peter Pending","matric":"900000002","status":"pending","admin":false},
    {"email":"rejected@e2e.test","name":"Rita Rejected","matric":"900000003","status":"rejected","admin":false},
    {"email":"suspended@e2e.test","name":"Sam Suspended","matric":"900000004","status":"suspended","admin":false},
    {"email":"admin@e2e.test","name":"Ada Admin","matric":"900000005","status":"verified","admin":true}
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
