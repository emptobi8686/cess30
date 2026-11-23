-- Migration 023: Profile identity guard (audit findings BP-016, BP-017, BP-018, BP-046).
--
--   * Verification fields (status, reviewer, timestamps, rejection reason) can change only
--     while a verification RPC has set the transaction-local flag
--     blueprint.verification_rpc = 'on'. There is no blanket admin exemption any more, so an
--     administrator cannot self-verify through the own-row update policy (BP-016).
--   * department and level change only under blueprint.placement_rpc = 'on' (used by the
--     placement workflow introduced in a later migration).
--   * full_name is locked once a profile is verified (BP-017).
--   * avatar_url must be null or a public Supabase Storage URL (*.supabase.co, or localhost for
--     local development) inside the user's own profile-pictures folder. A custom storage
--     domain would require extending this pattern in a new migration.
--   * handle_new_user() no longer trusts client metadata for department, level or picture
--     (BP-018). A duplicate matric number at sign-up no longer aborts account creation; the
--     profile is created without a matric number and the student is asked again in-app.
--   * Students can no longer INSERT or DELETE profiles directly (BP-046).
--   * The duplicate identity trigger from 002 is removed.
--
-- The flags are ordinary custom settings. PostgREST does not expose pg_catalog.set_config,
-- so API clients cannot set them; only SECURITY DEFINER RPCs in this schema do.

create or replace function public.prevent_profile_identity_changes()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_verification_rpc boolean := coalesce(current_setting('blueprint.verification_rpc', true), '') = 'on';
  v_placement_rpc boolean := coalesce(current_setting('blueprint.placement_rpc', true), '') = 'on';
begin
  if new.id is distinct from old.id then
    raise exception 'User ID is immutable.';
  end if;

  if not v_verification_rpc and (
       new.verification_status is distinct from old.verification_status
    or new.verification_reviewed_at is distinct from old.verification_reviewed_at
    or new.verification_reviewed_by is distinct from old.verification_reviewed_by
    or new.verification_rejection_reason is distinct from old.verification_rejection_reason
  ) then
    raise exception 'Verification details can only be changed through the verification workflow.';
  end if;

  if not v_verification_rpc
     and old.matric_number is not null
     and new.matric_number is distinct from old.matric_number then
    raise exception 'Matriculation number is immutable once set. Contact your course representative.';
  end if;

  if not v_placement_rpc and (
       new.department is distinct from old.department
    or new.level is distinct from old.level
  ) then
    raise exception 'Academic placement can only be changed through the placement workflow.';
  end if;

  if new.created_at is distinct from old.created_at then
    raise exception 'Profile creation time is immutable.';
  end if;

  if not v_verification_rpc
     and old.verification_status = 'verified'
     and new.full_name is distinct from old.full_name then
    raise exception 'Your name is locked after verification. Contact your course representative to change it.';
  end if;

  if new.avatar_url is distinct from old.avatar_url
     and new.avatar_url is not null
     and new.avatar_url !~ ('^https?://([a-z0-9-]+\.supabase\.co|localhost:[0-9]+|127\.0\.0\.1:[0-9]+)'
                            || '/storage/v1/object/public/profile-pictures/' || new.id::text || '/[^/?#]+$') then
    raise exception 'Profile pictures must be uploaded through BLUEPRINT.';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_profile_identity_changes() from public, anon, authenticated;

drop trigger if exists profiles_protect_identity_fields on public.profiles;
drop trigger if exists profiles_protect_identity on public.profiles;
create trigger profiles_protect_identity
before update on public.profiles
for each row
execute function public.prevent_profile_identity_changes();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_full_name text := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '');
  v_matric text := nullif(trim(coalesce(new.raw_user_meta_data->>'matric_number', '')), '');
begin
  begin
    insert into public.profiles (id, full_name, matric_number, department, level, avatar_url, verification_status)
    values (new.id, v_full_name, v_matric, 'Civil Engineering', '200', null, 'pending')
    on conflict (id) do nothing;
  exception when unique_violation then
    insert into public.profiles (id, full_name, matric_number, department, level, avatar_url, verification_status)
    values (new.id, v_full_name, null, 'Civil Engineering', '200', null, 'pending')
    on conflict (id) do nothing;
  end;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

revoke insert, delete on public.profiles from authenticated;
drop policy if exists "profiles_insert_own" on public.profiles;

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

  -- 9. Update the profile's verification fields. The transaction-local flag lets the
  --    identity guard trigger accept this change (and only this change).
  perform set_config('blueprint.verification_rpc', 'on', true);

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

  perform set_config('blueprint.verification_rpc', 'off', true);

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

revoke all on function public.verify_profile_decision(uuid, text, text) from public, anon;
grant execute on function public.verify_profile_decision(uuid, text, text) to authenticated;
