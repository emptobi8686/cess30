-- Migration 020: Lock down verification history (audit finding BP-001).
--
-- 015 created public.profile_verification_history with policies but never enabled
-- RLS, and Supabase's default privileges grant table access to anon/authenticated.
-- The companion view matric_verification_history ran with owner rights, bypassing
-- RLS on the base table.
--
-- After this migration:
--   * RLS is enforced on the history table (existing select policies from 015 apply:
--     own rows for students, all rows for admins).
--   * anon has no access; authenticated has SELECT only; writes happen exclusively
--     inside SECURITY DEFINER RPCs (verify_profile_decision and later transitions).
--   * the view runs with the caller's rights (security_invoker) and is not exposed to anon.

alter table public.profile_verification_history enable row level security;

revoke all on table public.profile_verification_history from public, anon, authenticated;
grant select on table public.profile_verification_history to authenticated;
grant all on table public.profile_verification_history to service_role;

create or replace view public.matric_verification_history
with (security_invoker = true) as
select * from public.profile_verification_history;

revoke all on table public.matric_verification_history from public, anon, authenticated;
grant select on table public.matric_verification_history to authenticated;
grant all on table public.matric_verification_history to service_role;
