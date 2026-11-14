-- Migration 015: Matriculation verification workflow
-- Adds review metadata to profiles and an audit trail so admins can review,
-- approve, or reject student submissions without allowing students to mutate
-- verification decisions.

alter table public.profiles
  add column if not exists verification_reviewed_at timestamptz,
  add column if not exists verification_reviewed_by uuid references auth.users(id),
  add column if not exists verification_rejection_reason text
    check (verification_rejection_reason is null or length(trim(verification_rejection_reason)) between 12 and 500);

create index if not exists idx_profiles_verification_reviewed_by
  on public.profiles(verification_reviewed_by);

create index if not exists idx_profiles_verification_reviewed_at
  on public.profiles(verification_reviewed_at);

create table if not exists public.profile_verification_history (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  previous_status text not null
    check (previous_status in ('pending', 'verified', 'rejected', 'suspended')),
  new_status text not null
    check (new_status in ('pending', 'verified', 'rejected', 'suspended')),
  reviewed_by uuid not null references auth.users(id) on delete restrict,
  rejection_reason text null,
  created_at timestamptz not null default now(),
  constraint verification_history_reason_required_for_rejection
    check (
      (new_status <> 'rejected' and rejection_reason is null)
      or (new_status = 'rejected' and length(trim(coalesce(rejection_reason, ''))) >= 12)
    )
);

create index if not exists idx_profile_verification_history_profile
  on public.profile_verification_history(profile_id, created_at desc);

create index if not exists idx_profile_verification_history_admin
  on public.profile_verification_history(reviewed_by, created_at desc);

create or replace view public.matric_verification_history as
select *
from public.profile_verification_history;

create or replace function public.record_profile_verification_decision(
  p_profile_id uuid,
  p_previous_status text,
  p_new_status text,
  p_reviewed_by uuid,
  p_rejection_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_history_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required to review student matriculation submissions.';
  end if;

  if p_profile_id is null or p_previous_status is null or p_new_status is null then
    raise exception 'Verification details are incomplete.';
  end if;

  if p_new_status = 'rejected' and length(trim(coalesce(p_rejection_reason, ''))) < 12 then
    raise exception 'Rejection reason must be at least 12 characters.';
  end if;

  update public.profiles
  set verification_status = p_new_status,
      verification_reviewed_at = now(),
      verification_reviewed_by = p_reviewed_by,
      verification_rejection_reason = case when p_new_status = 'rejected' then trim(p_rejection_reason) else null end
  where id = p_profile_id;

  if not found then
    raise exception 'Student profile not found.';
  end if;

  insert into public.profile_verification_history (
    profile_id,
    previous_status,
    new_status,
    reviewed_by,
    rejection_reason,
    created_at
  )
  values (
    p_profile_id,
    p_previous_status,
    p_new_status,
    p_reviewed_by,
    case when p_new_status = 'rejected' then trim(p_rejection_reason) else null end,
    now()
  )
  returning id into v_history_id;

  return v_history_id;
end;
$$;

revoke all on function public.record_profile_verification_decision(uuid, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.record_profile_verification_decision(uuid, text, text, uuid, text) to authenticated;

-- Students can read their own profile and history.
-- Administrators can read all pending, verified, and rejected submissions.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_select_admin'
  ) then
    create policy "profiles_select_admin"
    on public.profiles
    for select
    to authenticated
    using (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_update_verification_admin'
  ) then
    create policy "profiles_update_verification_admin"
    on public.profiles
    for update
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profile_verification_history'
      and policyname = 'profile_verification_history_select_own'
  ) then
    create policy "profile_verification_history_select_own"
    on public.profile_verification_history
    for select
    to authenticated
    using (profile_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profile_verification_history'
      and policyname = 'profile_verification_history_select_admin'
  ) then
    create policy "profile_verification_history_select_admin"
    on public.profile_verification_history
    for select
    to authenticated
    using (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profile_verification_history'
      and policyname = 'profile_verification_history_insert_admin'
  ) then
    create policy "profile_verification_history_insert_admin"
    on public.profile_verification_history
    for insert
    to authenticated
    with check (public.is_admin() and reviewed_by = auth.uid());
  end if;
end;
$$;

-- Align the existing student identity protector with admin approval flows.
create or replace function public.prevent_profile_identity_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'User ID is immutable.';
  end if;

  if new.verification_status is distinct from old.verification_status then
    raise exception 'Only administrators can update student verification status.';
  end if;

  if new.matric_number is distinct from old.matric_number and old.matric_number is not null then
    raise exception 'Matriculation number is immutable once set.';
  end if;

  if new.department is distinct from old.department
     or new.level is distinct from old.level
     or new.created_at is distinct from old.created_at then
    raise exception 'Academic identity fields are read-only for students.';
  end if;

  return new;
end;
$$;

-- Ensure only the admin review function can determine and log verification decisions.
-- Students may still edit non-verification fields via the existing profile policy.
drop trigger if exists profiles_protect_identity on public.profiles;
create trigger profiles_protect_identity
before update on public.profiles
for each row
execute function public.prevent_profile_identity_changes();
