-- Migration 017: Remove broad admin profile update policy.
--
-- Migration 015 created "profiles_update_verification_admin" which permits
-- any authenticated admin to update any column on any profile. Migration 016
-- introduced verify_profile_decision() as the secure, atomic, audited path
-- for verification decisions. No application code relies on the broad
-- policy. Removing it closes a bypass path where admins could modify
-- verification fields (and other profile fields) without creating history
-- records or acquiring the FOR UPDATE row lock.
--
-- Preserved:
--   profiles_select_admin          (admin read access for verification queue)
--   profiles_update_own            (student self-update via RLS)
--   prevent_profile_identity_changes() trigger
--   verify_profile_decision() RPC
--   All other RLS policies unchanged

drop policy if exists "profiles_update_verification_admin"
  on public.profiles;
