-- Migration 026: Verification state transitions (audit finding BP-007).
--
-- verify_profile_decision() only decides pending profiles, so before this migration a
-- rejected student could never resubmit, and nobody could be suspended or reinstated
-- after their first review.
--
--   request_reverification(matric)          student: rejected → pending (may correct matric)
--   admin_change_status(profile, status, reason)
--       verified  → suspended   (reason ≥ 12 characters, stored in history.note)
--       suspended → verified
--       rejected  → pending     (admin reopen)
--
-- Both RPCs set the transaction-local flag that the profile identity guard (023)
-- requires, write a history row, and clear the flag again.

alter table public.profile_verification_history
  add column if not exists note text
    check (note is null or length(trim(note)) between 1 and 500);

create or replace function public.request_reverification(p_matric_number text)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_matric text := upper(trim(coalesce(p_matric_number, '')));
begin
  if v_uid is null then
    raise exception 'Authenticated session required.';
  end if;

  if v_matric !~ '^[A-Z0-9/_-]{6,15}$' then
    raise exception 'Enter a valid matriculation number.';
  end if;

  select verification_status into v_status
  from public.profiles
  where id = v_uid
  for update;

  if not found then
    raise exception 'Profile not found.';
  end if;

  if v_status <> 'rejected' then
    raise exception 'Only rejected verification requests can be resubmitted.';
  end if;

  perform set_config('blueprint.verification_rpc', 'on', true);

  update public.profiles
  set matric_number = v_matric,
      verification_status = 'pending',
      verification_reviewed_at = null,
      verification_reviewed_by = null,
      verification_rejection_reason = null
  where id = v_uid;

  perform set_config('blueprint.verification_rpc', 'off', true);

  insert into public.profile_verification_history (profile_id, previous_status, new_status, reviewed_by)
  values (v_uid, 'rejected', 'pending', v_uid);

  return 'pending';
end;
$$;

revoke all on function public.request_reverification(text) from public, anon;
grant execute on function public.request_reverification(text) to authenticated;

create or replace function public.admin_change_status(
  p_profile_id uuid,
  p_new_status text,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_current text;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if v_uid is null then
    raise exception 'Authenticated session required.';
  end if;

  if not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;

  if p_profile_id = v_uid then
    raise exception 'Administrators cannot change their own verification status.';
  end if;

  select verification_status into v_current
  from public.profiles
  where id = p_profile_id
  for update;

  if not found then
    raise exception 'Student profile not found.';
  end if;

  if not (
       (v_current = 'verified'  and p_new_status = 'suspended')
    or (v_current = 'suspended' and p_new_status = 'verified')
    or (v_current = 'rejected'  and p_new_status = 'pending')
  ) then
    raise exception 'A % profile cannot be changed to %.', v_current, p_new_status;
  end if;

  if p_new_status = 'suspended' and length(coalesce(v_reason, '')) < 12 then
    raise exception 'A suspension reason of at least 12 characters is required.';
  end if;

  perform set_config('blueprint.verification_rpc', 'on', true);

  update public.profiles
  set verification_status = p_new_status,
      verification_reviewed_at = now(),
      verification_reviewed_by = v_uid,
      verification_rejection_reason = null
  where id = p_profile_id;

  perform set_config('blueprint.verification_rpc', 'off', true);

  insert into public.profile_verification_history (profile_id, previous_status, new_status, reviewed_by, note)
  values (p_profile_id, v_current, p_new_status, v_uid, v_reason);

  return p_new_status;
end;
$$;

revoke all on function public.admin_change_status(uuid, text, text) from public, anon;
grant execute on function public.admin_change_status(uuid, text, text) to authenticated;
