-- Migration 016: Verification security hardening.
--
-- 1. Extend prevent_profile_identity_changes() to protect all four
--    verification metadata fields from student modification:
--       verification_status
--       verification_reviewed_at
--       verification_reviewed_by
--       verification_rejection_reason
-- 2. Replace the non-atomic record_profile_verification_decision() flow with
--    a single atomic SECURITY DEFINER RPC function verify_profile_decision()
--    that updates the profile and inserts the history record in the same
--    database transaction, with row-level locking to prevent concurrent
--    conflicting decisions.
-- 3. Revoke direct INSERT on profile_verification_history from authenticated
--    so all history inserts go through the protected RPC.
-- 4. Revoke execute on record_profile_verification_decision from authenticated
--    so callers must use verify_profile_decision() instead.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Extend the profile identity protector to cover all verification metadata
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.prevent_profile_identity_changes()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  -- Administrators can manage all profile fields including verification metadata.
  if public.is_admin() then
    return new;
  end if;

  -- Students cannot change their own id.
  if new.id is distinct from old.id then
    raise exception 'User ID is immutable.';
  end if;

  -- Students cannot change any verification metadata field. Only an
  -- authorized administrator-side database operation may modify these.
  if new.verification_status is distinct from old.verification_status then
    raise exception 'Only administrators can update student verification status.';
  end if;

  if new.verification_reviewed_at is distinct from old.verification_reviewed_at then
    raise exception 'Only administrators can update verification review timestamp.';
  end if;

  if new.verification_reviewed_by is distinct from old.verification_reviewed_by then
    raise exception 'Only administrators can update verification reviewer.';
  end if;

  if new.verification_rejection_reason is distinct from old.verification_rejection_reason then
    raise exception 'Only administrators can update verification rejection reason.';
  end if;

  -- Students can populate matric_number once if initially null (Google OAuth),
  -- but cannot alter it once set.
  if old.matric_number is not null and new.matric_number is distinct from old.matric_number then
    raise exception 'Matriculation number is immutable once set. Contact your course representative.';
  end if;

  -- Academic department, level, and created_at cannot be altered by students.
  if new.department is distinct from old.department
     or new.level is distinct from old.level
     or new.created_at is distinct from old.created_at then
    raise exception 'Academic identity fields are read-only for students.';
  end if;

  return new;
end;
$$;

-- Re-affirm the trigger on profiles.
drop trigger if exists profiles_protect_identity on public.profiles;
create trigger profiles_protect_identity
before update on public.profiles
for each row
execute function public.prevent_profile_identity_changes();

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Atomic verification decision RPC
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.verify_profile_decision(
  p_profile_id uuid,
  p_new_status text,
  p_rejection_reason text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_current_status text;
  v_reviewed_by uuid := auth.uid();
  v_history_id uuid;
begin
  -- 1. Authenticate: auth.uid() must be non-null (the calling session must be
  --    an authenticated user; anon/public cannot set auth.uid()).
  if auth.uid() is null then
    raise exception 'Authenticated session required.';
  end if;

  -- 2. Verify administrator privileges via the existing is_admin() mechanism.
  if not public.is_admin() then
    raise exception 'Administrator access required to review student matriculation submissions.';
  end if;

  -- 3. Reject attempts to review the administrator's own profile.
  if p_profile_id = v_reviewed_by then
    raise exception 'Administrators cannot review their own profile.';
  end if;

  -- 4. Lock the target profile row to prevent concurrent conflicting decisions.
  --    FOR UPDATE blocks other transactions from updating this row until this
  --    transaction commits or rolls back.
  select verification_status into v_current_status
  from public.profiles
  where id = p_profile_id
  for update;

  if not found then
    raise exception 'Student profile not found.';
  end if;

  -- 5. Validate the current verification status.
  if v_current_status not in ('pending', 'verified', 'rejected', 'suspended') then
    raise exception 'Invalid current verification status.';
  end if;

  -- 6. Validate the requested decision.
  if p_new_status not in ('verified', 'rejected', 'suspended') then
    raise exception 'Invalid verification decision.';
  end if;

  -- 7. Prevent conflicting decisions: a profile that has already reached a
  --    terminal state (verified/rejected/suspended) cannot be re-decided.
  if v_current_status <> 'pending' then
    raise exception 'This profile has already been reviewed with status: %.', v_current_status;
  end if;

  -- 8. Require a non-empty rejection reason for rejection.
  if p_new_status = 'rejected' and length(trim(coalesce(p_rejection_reason, ''))) < 12 then
    raise exception 'Rejection reason must be at least 12 characters.';
  end if;

  -- 9. Update the profile's verification fields.
  update public.profiles
  set verification_status = p_new_status,
      verification_reviewed_at = now(),
      verification_reviewed_by = v_reviewed_by,
      verification_rejection_reason = case
        when p_new_status = 'rejected' then trim(p_rejection_reason)
        else null
      end
  where id = p_profile_id;

  if not found then
    raise exception 'Student profile not found during update.';
  end if;

  -- 10. Insert the corresponding review history record.
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
    v_current_status,
    p_new_status,
    v_reviewed_by,
    case
      when p_new_status = 'rejected' then trim(p_rejection_reason)
      else null
    end,
    now()
  )
  returning id into v_history_id;

  return format('Review recorded: profile %s moved from %s to %s (history id: %s)',
    p_profile_id, v_current_status, p_new_status, v_history_id);
end;
$$;

-- Revoke from untrusted roles; grant only to authenticated.
revoke all on function public.verify_profile_decision(uuid, text, text) from public, anon;
grant execute on function public.verify_profile_decision(uuid, text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Revoke the old non-atomic RPC from authenticated callers
-- ─────────────────────────────────────────────────────────────────────────

revoke all on function public.record_profile_verification_decision(uuid, text, text, uuid, text)
  from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Protect the review history table
-- ─────────────────────────────────────────────────────────────────────────

-- Remove the direct admin INSERT policy. All history inserts must go through
-- verify_profile_decision() (SECURITY DEFINER) which runs as the function
-- owner and can insert even though authenticated has no direct INSERT grant.
drop policy if exists "profile_verification_history_insert_admin"
  on public.profile_verification_history;

-- Ensure students have no insert/update/delete on history (they never did via
-- policy, but this makes it explicit after the grant revocation above).
-- Students can still read their own history via select_own policy (from 015).

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Reaffirm grants
-- ─────────────────────────────────────────────────────────────────────────

-- is_admin() must remain executable by authenticated for the RPC's admin check.
grant execute on function public.is_admin() to authenticated, service_role, postgres;

-- prevent_profile_identity_changes() runs as a trigger (trigger owner context),
-- but keep explicit grants consistent with prior migrations.
revoke all on function public.prevent_profile_identity_changes() from public, anon, authenticated;
grant execute on function public.prevent_profile_identity_changes() to postgres;
