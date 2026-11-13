-- Migration 011: Phase 4.3 Google OAuth, student verification, and profile handling.
--
-- Changes:
--   1. Add verification_status to public.profiles ('pending', 'verified', 'rejected', 'suspended')
--      with default 'pending'.
--   2. Allow matric_number to be initially nullable on public.profiles to support
--      Google OAuth registration before matriculation details are completed.
--   3. Update handle_new_user() trigger to automatically provision profile rows for both
--      email/password and Google OAuth users, extracting name and avatar metadata.
--   4. Update prevent_profile_identity_changes() trigger to ensure:
--      - Only administrators can change verification_status.
--      - Students can provide their matric_number once (if initially null from Google OAuth),
--        but cannot alter it once set.
--      - Department, level, id, and created_at remain strictly protected.
--   5. Maintain strict separation between authentication metadata and privileges:
--      OAuth metadata NEVER grants admin roles or auto-verified status.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. verification_status column and index
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected', 'suspended'));

comment on column public.profiles.verification_status is
  'Current verification status of the student account. Newly registered accounts start as pending.';

create index if not exists idx_profiles_verification_status
  on public.profiles(verification_status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Allow matric_number to be nullable for Google OAuth onboarding
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles
  alter column matric_number drop not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Update handle_new_user trigger to handle Google OAuth and email signups
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_full_name   text;
  v_matric      text;
  v_department  text;
  v_level       text;
  v_avatar      text;
begin
  -- Read metadata supplied at sign-up or via Google OAuth
  v_full_name  := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    ''
  );
  v_matric     := nullif(trim(coalesce(new.raw_user_meta_data->>'matric_number', '')), '');
  v_department := coalesce(new.raw_user_meta_data->>'department', 'Civil Engineering');
  v_level      := coalesce(new.raw_user_meta_data->>'level', '200');
  v_avatar     := coalesce(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture',
    null
  );

  -- Insert profile with pending verification status. Never grant admin role here.
  insert into public.profiles (
    id,
    full_name,
    matric_number,
    department,
    level,
    avatar_url,
    verification_status
  )
  values (
    new.id,
    v_full_name,
    v_matric,
    v_department,
    v_level,
    v_avatar,
    'pending'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Update prevent_profile_identity_changes to enforce verification security
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.prevent_profile_identity_changes()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  -- Administrators can manage student verification status and profile attributes
  if public.is_admin() then
    return new;
  end if;

  -- For non-administrators (students):
  -- 1. id cannot be changed
  if new.id is distinct from old.id then
    raise exception 'User ID is immutable.';
  end if;

  -- 2. verification_status cannot be changed by students
  if new.verification_status is distinct from old.verification_status then
    raise exception 'Only administrators can update student verification status.';
  end if;

  -- 3. matric_number can only be populated if it was null (e.g. after Google OAuth signup)
  --    Once set, students cannot change it.
  if old.matric_number is not null and new.matric_number is distinct from old.matric_number then
    raise exception 'Matriculation number is immutable once set. Contact your course representative.';
  end if;

  -- 4. Academic department, level, and created_at cannot be altered by students
  if new.department is distinct from old.department
     or new.level is distinct from old.level
     or new.created_at is distinct from old.created_at then
    raise exception 'Academic identity fields are read-only for students.';
  end if;

  return new;
end;
$$;

