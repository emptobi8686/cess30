-- LIVE SUPABASE RLS INTEGRATION TESTS — Verification Security (Migrations 014–016)
--
-- These tests validate actual PostgreSQL RLS, grants, triggers, and RPC
-- authorization for the verification workflow. They must be executed against
-- a real Supabase project (local or staging) where migrations 014, 015, 016,
-- and 017 have been applied.
--
-- DO NOT run against production. Do not modify migrations 014–017.
-- All tests run inside transactions and roll back, leaving no test data.
--
-- Test identities (synthetic UUIDs — replace with real auth.users ids when
-- run against a live project):
--   Student A = aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
--   Student B = bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
--   Admin A   = 11111111-1111-1111-111111111111
--   Admin B   = 22222222-2222-2222-222222222222
--
-- Impersonation method:
--   begin;
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}';
--   ... test statements ...
--   rollback;
--
-- Supabase's `auth.uid()` reads `request.jwt.claims.sub`, so `set local
-- request.jwt.claims` effectively simulates a JWT for that identity within
-- the transaction.

-- ═══════════════════════════════════════════════════════════════════════════════
-- PRELIMINARY: Ensure required admin roles exist in user_roles
-- ═══════════════════════════════════════════════════════════════════════════════
-- The is_admin() function reads public.user_roles. Admin test identities must
-- have admin rows, otherwise every admin test will fail with
-- "Administrator access required."
--
-- Run as postgres (RLS bypass) before the identity-specific blocks:
--
--   insert into public.user_roles (user_id, role, assigned_by)
--   values
--     ('11111111-1111-1111-111111111111', 'admin', '11111111-1111-1111-111111111111'),
--     ('22222222-2222-2222-222222222222', 'admin', '11111111-1111-1111-111111111111')
--   on conflict (user_id, role) do nothing;
--
-- Student profiles must also exist for cross-profile tests. Create them as
-- postgres (RLS bypass):
--
--   insert into public.profiles (id, full_name, matric_number, department, level, verification_status)
--   values
--     ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Student A', 'STU000001', 'Civil Engineering', '200', 'pending'),
--     ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Student B', 'STU000002', 'Civil Engineering', '200', 'pending')
--   on conflict (id) do nothing;
--
-- These inserts are NOT part of the test blocks below — they are setup.

-- ═══════════════════════════════════════════════════════════════════════════════
-- TEST GROUP 1: Student isolation
-- ═══════════════════════════════════════════════════════════════════════════════

-- Student A cannot read Student B's profile.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

savepoint student_a_reads_student_b_profile;
select id, full_name, verification_status
from public.profiles
where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
-- Expected: zero rows (profiles_select_own: auth.uid() = id).
rollback to savepoint student_a_reads_student_b_profile;
rollback;

-- Student A cannot update Student B's profile.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

savepoint student_a_updates_student_b_profile;
update public.profiles
set nickname = 'Hacked Nickname'
where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
-- Expected: zero rows updated (profiles_update_own + trigger).
rollback to savepoint student_a_updates_student_b_profile;
rollback;

-- Student A cannot read Student B's verification history.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

savepoint student_a_reads_student_b_history;
select id, profile_id, new_status
from public.profile_verification_history
where profile_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
-- Expected: zero rows (profile_verification_history_select_own: profile_id = auth.uid()).
rollback to savepoint student_a_reads_student_b_history;
rollback;

-- ═══════════════════════════════════════════════════════════════════════════════
-- TEST GROUP 2: Protected fields — Student A cannot modify verification metadata
-- ═══════════════════════════════════════════════════════════════════════════════

-- Student A cannot change verification_status.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

savepoint student_a_changes_verification_status;
update public.profiles
set verification_status = 'verified'
where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
-- Expected: rejected by prevent_profile_identity_changes trigger.
rollback to savepoint student_a_changes_verification_status;
rollback;

-- Student A cannot change verification_reviewed_at.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

savepoint student_a_changes_reviewed_at;
update public.profiles
set verification_reviewed_at = now()
where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
-- Expected: rejected by prevent_profile_identity_changes trigger.
rollback to savepoint student_a_changes_reviewed_at;
rollback;

-- Student A cannot change verification_reviewed_by.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

savepoint student_a_changes_reviewed_by;
update public.profiles
set verification_reviewed_by = '11111111-1111-1111-111111111111'
where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
-- Expected: rejected by prevent_profile_identity_changes trigger.
rollback to savepoint student_a_changes_reviewed_by;
rollback;

-- Student A cannot change verification_rejection_reason.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

savepoint student_a_changes_rejection_reason;
update public.profiles
set verification_rejection_reason = 'Forged rejection reason'
where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
-- Expected: rejected by prevent_profile_identity_changes trigger.
rollback to savepoint student_a_changes_rejection_reason;
rollback;

-- ═══════════════════════════════════════════════════════════════════════════════
-- TEST GROUP 3: History integrity
-- ═══════════════════════════════════════════════════════════════════════════════

-- Student cannot insert history.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

savepoint student_inserts_history;
insert into public.profile_verification_history
  (profile_id, previous_status, new_status, reviewed_by, rejection_reason)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'pending', 'verified', auth.uid(), null);
-- Expected: rejected — no INSERT grant/policy for authenticated on profile_verification_history
--           (profile_verification_history_insert_admin was dropped in migration 016).
rollback to savepoint student_inserts_history;
rollback;

-- Student cannot update history.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

-- First insert a history row as postgres (setup), then attempt student update.
-- This block only tests the UPDATE rejection.
savepoint student_updates_history;
update public.profile_verification_history
set new_status = 'verified'
where profile_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
-- Expected: zero rows updated (no UPDATE policy for authenticated).
rollback to savepoint student_updates_history;
rollback;

-- Student cannot delete history.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

savepoint student_deletes_history;
delete from public.profile_verification_history
where profile_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
-- Expected: zero rows deleted (no DELETE policy for authenticated).
rollback to savepoint student_deletes_history;
rollback;

-- Student can read their own history.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

select id, profile_id, previous_status, new_status, reviewed_by, created_at
from public.profile_verification_history
where profile_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
-- Expected: zero or more rows owned by Student A (profile_verification_history_select_own).
rollback;

-- ═══════════════════════════════════════════════════════════════════════════════
-- TEST GROUP 4: RPC authorization
-- ═══════════════════════════════════════════════════════════════════════════════

-- Student cannot execute verify_profile_decision().
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

savepoint_student_executes_rpc;
select public.verify_profile_decision(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'verified',
  null
);
-- Expected: exception 'Administrator access required.' (is_admin() returns false).
rollback to savepoint_student_executes_rpc;
rollback;

-- Admin can approve a pending submission.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-111111111111","role":"authenticated"}';

savepoint admin_approves;
select public.verify_profile_decision(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'verified',
  null
);
-- Expected: success text message. Profile A moves from pending to verified.
rollback;
-- NOTE: rollback undoes the verification. For a persistent test, remove rollback
-- and use a dedicated disposable profile.

-- Admin can reject a pending submission with a valid reason.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-111111111111","role":"authenticated"}';

-- Reset Student B to pending first (as postgres setup would be needed;
-- here we test the RPC logic against a pending profile).
savepoint admin_rejects;
select public.verify_profile_decision(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'rejected',
  'Matriculation number does not match registration records.'
);
-- Expected: success text message. Profile B moves from pending to rejected,
--           history record inserted with rejection reason.
rollback;

-- Rejection without a valid reason fails.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-111111111111","role":"authenticated"}';

savepoint admin_rejects_no_reason;
select public.verify_profile_decision(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'rejected',
  ''
);
-- Expected: exception 'Rejection reason must be at least 12 characters.'
rollback to savepoint admin_rejects_no_reason;
rollback;

-- Rejection with a short reason fails.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-111111111111","role":"authenticated"}';

savepoint admin_rejects_short_reason;
select public.verify_profile_decision(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'rejected',
  'too short'
);
-- Expected: exception 'Rejection reason must be at least 12 characters.'
rollback to savepoint admin_rejects_short_reason;
rollback;

-- Admin cannot review their own profile.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-111111111111","role":"authenticated"}';

savepoint admin_self_review;
select public.verify_profile_decision(
  '11111111-1111-1111-111111111111',
  'verified',
  null
);
-- Expected: exception 'Administrators cannot review their own profile.'
rollback to savepoint admin_self_review;
rollback;

-- Already-reviewed profile cannot be reviewed again.
-- Student A was set to 'verified' in the Admin approval test above, but that
-- transaction was rolled back. Here we test against a profile that is already
-- in a terminal state by first setting it via postgres setup, then testing
-- the RPC rejection. This block tests the RPC's status validation only.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-111111111111","role":"authenticated"}';

savepoint admin_reviews_already_reviewed;
select public.verify_profile_decision(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'verified',
  null
);
-- Expected: either 'This profile has already been reviewed with status: ...'
--           (if B was left rejected from a prior non-rolled-back test) or
--           success (if B is still pending). Result depends on prior test
--           execution order. Run this block in isolation against a known
--           pending profile for a deterministic pass.
rollback;

-- ═══════════════════════════════════════════════════════════════════════════════
-- TEST GROUP 5: Atomicity — history insertion failure rolls back profile update
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- The verify_profile_decision() RPC performs profile UPDATE and history INSERT
-- in a single PL/pgSQL transaction. If the INSERT fails, the UPDATE rolls back.
--
-- This test deliberately causes the history INSERT to fail by adding a
-- temporary CHECK (false) constraint on profile_verification_history, then
-- calls verify_profile_decision(). The RPC should fail, and the profile
-- must remain pending with no history record created.
--
-- All changes are transaction-scoped: the constraint is created and removed
-- within the same transaction, and the entire test rolls back, leaving no
-- persistent database modifications. This is a STAGING-ONLY test — do not run
-- against production.
--
-- Step 1: Reset Student A to pending (as postgres setup, outside this block).
-- Step 2: Run the atomicity test as an admin.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-111111111111","role":"authenticated"}';

-- Outer savepoint: everything after this point is rolled back at the end.
savepoint atomicity_outer;

-- Add a temporary constraint that forces every history INSERT to fail.
-- CHECK (false) is always violated, so the RPC's INSERT will error.
alter table public.profile_verification_history
  add constraint staging_atomicity_fail check (false);

-- Inner savepoint: recover from the expected RPC failure.
savepoint atomicity_rpc;

-- Call the RPC. It will update the profile, then attempt to INSERT history,
-- which will violate the CHECK (false) constraint and abort.
select public.verify_profile_decision(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'verified',
  null
);
-- Expected: exception due to history INSERT constraint violation.
-- The PL/pgSQL transaction aborts, rolling back both the UPDATE and INSERT.

-- Recover from the aborted subtransaction.
rollback to savepoint atomicity_rpc;

-- Confirm the profile is still pending (UPDATE was rolled back).
select verification_status
from public.profiles
where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
-- Expected: 'pending'

-- Confirm no history record was created for Student A.
select count(*)
from public.profile_verification_history
where profile_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
-- Expected: 0

-- Remove the temporary constraint (restores original schema).
rollback to savepoint atomicity_outer;

-- Clean up the outer transaction.
rollback;
-- End of atomicity test — no persistent changes remain.

-- ══════════════════════════════════════════════════════════════════════════════
-- TEST GROUP 6: Concurrency — two administrators conflicting decisions
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- This test requires TWO separate database sessions (or two sequential
-- transactions that simulate the race). A single SQL file cannot execute
-- truly concurrent statements. The pattern below shows the sequential
-- simulation:
--
--   Session 1 (Admin A): begin; set claims to Admin A; SELECT ... FOR UPDATE;
--   Session 2 (Admin B): begin; set claims to Admin B; SELECT ... FOR UPDATE;  -- blocks until Session 1 commits/rolls back
--   Session 1 (Admin A): verify_profile_decision(...); commit;
--   Session 2 (Admin B): verify_profile_decision(...);  -- now sees status <> 'pending', raises exception
--
-- Because the RPC locks the profile row with SELECT ... FOR UPDATE, the second
-- administrator's transaction will block until the first commits. After the
-- first commits, the second sees verification_status <> 'pending' and raises
-- 'This profile has already been reviewed with status: ...'.
--
-- To run this test:
-- 1. Open two psql/SQL editor connections to the same project.
-- 2. In Connection 1, run the Admin A block up to (but not including) commit.
-- 3. In Connection 2, run the Admin B block — it will block on the row lock.
-- 4. In Connection 1, commit.
-- 5. In Connection 2, observe the exception.
-- 6. Roll back both connections.
--
-- Expected outcome: Exactly one history entry exists. The first administrator's
-- decision succeeds; the second is rejected because the profile is no longer
-- pending.
--
-- This test is documented but not executed here because it requires two
-- live sessions. Do not claim concurrency has been tested until actually executed.

-- ═══════════════════════════════════════════════════════════════════════════════
-- END OF TESTS — All transactions rolled back, no data persisted.
-- ═══════════════════════════════════════════════════════════════════════════════
