# P1 Database Blockers and Critical Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make migrations 001–019 apply cleanly, then close the critical and high database-security findings with tested forward migrations.

**Architecture:** SQL-only phase. Syntax fixes follow `MIGRATION_FIX_STRATEGY` from `docs/decisions/0001-migration-fix-strategy.md`. Every security fix is a new forward migration (020–023), proven by pgTAP tests that impersonate anon, students and admins through the P0 helpers.

**Tech Stack:** PostgreSQL 17 (Supabase), pgTAP, Supabase CLI.

**Spec:** `docs/independent-audit-2026-11-23/DATABASE_AND_MIGRATION_AUDIT.md`, `SECURITY_AUDIT.md`, `AUTHORIZATION_AND_RLS_AUDIT.md`.

## Global Constraints

- Every SECURITY DEFINER function: `set search_path = pg_catalog, public` and fully qualified table names; `revoke all … from public, anon` before granting.
- No destructive change to existing rows. New constraints that might fail on existing data use `not valid` and are followed by `validate constraint` in the same migration only after a pre-check query.
- Policies are created with `drop policy if exists …; create policy …` (never `create policy if not exists`).
- Literals: use `''` for apostrophes, never `\'`.
- Do not push to the remote project in this phase 🔐. Local and CI only.

## Review Focus

- An **anonymous** PostgREST client (anon key only) must not read, insert, update or delete `profile_verification_history` or `matric_verification_history`.
- A student inserting a `quest_submissions` row with `status='approved'` must be rejected, even with a valid quest id.
- `get_leaderboard('yearly')` (unsupported period) must raise, not silently return an empty set.
- An admin updating **their own** profile's `verification_status` must be rejected.
- Signing up with metadata `{"level":"400","department":"Mechanical"}` must still create a profile with the default department and level, ignoring the client values.

---

### Task 1: Make migrations 014, 018, 019 parse

**Files:**
- Modify (if `edit-in-place`): `supabase/migrations/014_profile_enhancements.sql:50-85`, `018_quests_and_xp.sql:65`, `019_quests_security_fixes.sql:285-323`
- Create (if `forward-only`): leave 014/018/019 untouched and create `supabase/migrations/020a_repair_014_019.sql` that re-runs the intended statements idempotently. Note: the remote ledger would then show 014–019 as failed or unapplied, so `forward-only` requires an operator to repair the remote history with `supabase migration repair` 🔐.
- Test: `supabase/tests/database/000_smoke.test.sql` (from P0)

- [ ] **Step 1:** Run `supabase db reset`. Expected: FAIL at 014 (`syntax error at or near "not"`).
- [ ] **Step 2:** Replace each `create policy if not exists "<name>" on storage.objects …` with `drop policy if exists "<name>" on storage.objects;` followed by `create policy "<name>" on storage.objects …` (same body). Do this in 014 (4 policies) and 019 (4 policies).
- [ ] **Step 3:** In 018:65 change `student\'s` to `student''s`.
- [ ] **Step 4:** Run `supabase db reset && supabase test db`. Expected: reset succeeds; `000_smoke` passes 6/6.
- [ ] **Step 5:** Commit: `fix(db): make migrations 014/018/019 parse (BP-002, BP-003)`.

### Task 2: Lock down verification history (BP-001)

**Files:**
- Create: `supabase/migrations/020_verification_history_rls.sql`
- Test: `supabase/tests/database/010_verification_history.test.sql`

**Interfaces:**
- Produces: table `public.profile_verification_history` with RLS enabled; authenticated `select` only (own rows or admin); view `public.matric_verification_history` recreated `with (security_invoker = true)` and with no `anon` grant.

- [ ] **Step 1: Write the failing test**

```sql
begin; \ir _helpers.sql
select plan(6);
-- fixtures: student A, student B, admin; one history row for A (as postgres)
select tests.as_anon();
select throws_ok($$select * from public.profile_verification_history$$, '42501');
select throws_ok($$select * from public.matric_verification_history$$, '42501');
select tests.authenticate_as(:'student_a');
select results_eq($$select count(*)::int from public.profile_verification_history$$, array[1]);
select throws_ok($$insert into public.profile_verification_history(profile_id,previous_status,new_status,reviewed_by) values (auth.uid(),'pending','verified',auth.uid())$$, '42501');
select tests.authenticate_as(:'student_b');
select results_eq($$select count(*)::int from public.matric_verification_history$$, array[0]);
select tests.authenticate_as(:'admin');
select results_eq($$select count(*)::int from public.profile_verification_history$$, array[1]);
select * from finish(); rollback;
```

(Fixture ids are set with `select tests.create_user(...) as student_a \gset`.)

- [ ] **Step 2:** Run `supabase test db`. Expected: FAIL (anon select succeeds).
- [ ] **Step 3:** Write 020: `alter table … enable row level security`; `revoke all on public.profile_verification_history, public.matric_verification_history from public, anon, authenticated`; `grant select on public.profile_verification_history to authenticated`; `create or replace view public.matric_verification_history with (security_invoker = true) as select * from public.profile_verification_history`; `grant select on public.matric_verification_history to authenticated`; `grant all … to service_role`. Keep the existing select policies from 015.
- [ ] **Step 4:** Run `supabase test db`. Expected: PASS.
- [ ] **Step 5:** Commit: `fix(db): enable RLS on verification history and invoker view (BP-001)`.

### Task 3: Repair `get_leaderboard` (BP-004)

**Files:**
- Create: `supabase/migrations/021_get_leaderboard_fix.sql`
- Modify: `src/types/index.ts` (`LeaderboardEntry` numeric fields stay `number`; add a comment that PostgREST returns bigint as a JSON number)
- Test: `supabase/tests/database/020_leaderboard.test.sql`

**Interfaces:**
- Produces: `public.get_leaderboard(p_period text default 'all-time') returns table(user_id uuid, full_name text, avatar_url text, total_xp bigint, quests_completed bigint, rank bigint)`, `language sql stable security definer`. Only profiles with `verification_status = 'verified'` and without an admin role. Raises `22023` with message `Unsupported leaderboard period: %` for values outside `('all-time','weekly','monthly')`. Must `drop function public.get_leaderboard(text)` first because the return type changes.

- [ ] **Step 1: Write the failing test.** Fixtures: verified students A (300 XP), B (100 XP); pending C (500 XP); ledger rows inserted as postgres; one row for A dated 40 days ago (200 of its 300).

```sql
select results_eq($$select user_id, total_xp, rank from public.get_leaderboard('all-time')$$,
  $$values (:'a'::uuid, 300::bigint, 1::bigint), (:'b'::uuid, 100::bigint, 2::bigint)$$);
select results_eq($$select total_xp from public.get_leaderboard('monthly') where user_id = :'a'$$, array[100::bigint]);
select throws_ok($$select * from public.get_leaderboard('yearly')$$, '22023');
select is_empty($$select 1 from public.get_leaderboard() where user_id = :'c'$$);
```

- [ ] **Step 2:** Run. Expected: FAIL (`42804` structure mismatch).
- [ ] **Step 3:** Implement 021 per the interface. Compute week and month boundaries in Africa/Lagos as in 019. Qualify every column through aliases.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `fix(db): leaderboard bigint outputs, period validation, verified-only (BP-004)`.

### Task 4: Quest integrity (BP-014, BP-015, BP-008 DB side)

**Files:**
- Create: `supabase/migrations/022_quest_integrity.sql`
- Test: `supabase/tests/database/030_quest_integrity.test.sql`

**Interfaces:**
- Produces: column-level `grant insert (quest_id, student_id, evidence_url, notes) on public.quest_submissions to authenticated` (revoke the table-level insert first). Policy `quest_submissions_insert_own` replaced with `with check (student_id = auth.uid() and status = 'pending' and reviewed_by is null and reviewed_at is null and rejection_reason is null and public.quest_is_open(quest_id))`.
- Produces: `public.quest_is_open(p_quest_id uuid) returns boolean` (stable, definer): the quest is active and (`due_date` is null or `due_date > now()`).
- Produces: `revoke execute on function public.award_xp(uuid,uuid,integer,text) from authenticated` (still callable from `review_quest_submission`, which runs as the owner).
- Produces: policy `quests_admin_insert` requiring `created_by = auth.uid()` (replace the FOR ALL policy with split insert, update and delete policies).

- [ ] **Step 1: Write failing tests:** a student inserting `status='approved'` → `42501`; a student inserting for an inactive quest → `42501`; a student inserting for an overdue quest → `42501`; a valid pending insert → `lives_ok`; an admin calling `award_xp` directly → `42501`; an admin inserting a quest with `created_by` ≠ self → `42501`; `review_quest_submission` approve still writes exactly one ledger row.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement 022 per the interfaces.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `fix(db): harden quest submissions and XP awarding (BP-014, BP-015)`.

### Task 5: Profile identity guard (BP-016, BP-017, BP-018, BP-046)

**Files:**
- Create: `supabase/migrations/023_profile_identity_guard.sql`
- Test: `supabase/tests/database/040_profile_guard.test.sql`

**Interfaces:**
- Produces: `prevent_profile_identity_changes()` rewritten. Verification fields may change **only** when `current_setting('blueprint.verification_rpc', true) = 'on'`, with **no admin exemption**. `verify_profile_decision` (and the P2 transition RPCs) call `perform set_config('blueprint.verification_rpc','on',true)` before updating. `full_name` is immutable when `old.verification_status = 'verified'` unless the same flag is on. `avatar_url` must be null or match `'%/storage/v1/object/public/profile-pictures/' || new.id::text || '/%'`.
- Produces: `handle_new_user()` ignores `department` and `level` metadata (always `'Civil Engineering'` and `'200'` defaults until P5 replaces level with placements). It no longer copies Google `picture`/`avatar_url`. It still reads `full_name`/`name` and `matric_number`. A duplicate matric is caught: `on unique_violation` → insert with `matric_number = null` so sign-up succeeds and the student is asked again in-app.
- Produces: `revoke insert, delete on public.profiles from authenticated`; drop policy `profiles_insert_own`.
- Produces: `drop trigger if exists profiles_protect_identity_fields on public.profiles` (duplicate from 002).

- [ ] **Step 1: Write failing tests:**
  - an admin updates own `verification_status` → throws `P0001`;
  - a verified student updates `full_name` → throws;
  - a pending student updates `full_name` → lives;
  - setting `avatar_url = 'https://evil.example/x.png'` → throws;
  - `tests.create_user('x@y.z', '{"full_name":"X","level":"400","department":"Mech"}')` → profile level `'200'`, department `'Civil Engineering'`;
  - creating a second user with a duplicate matric → lives, and the second profile's `matric_number` is null;
  - `verify_profile_decision` still works.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement 023. Also re-create `verify_profile_decision` adding the `set_config` line (body otherwise as in 016).
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `fix(db): RPC-scoped profile verification guard and metadata distrust (BP-016/017/018/046)`.

### Task 6: Function hygiene (BP-043, BP-044, dead code)

**Files:**
- Create: `supabase/migrations/023b_function_hygiene.sql`
- Test: `supabase/tests/database/050_function_hygiene.test.sql`

**Interfaces:**
- `update_updated_at_column()` → `security invoker set search_path = pg_catalog, public`.
- `grant_admin_role(uuid,uuid)`: delete the dead `current_user` branch; executable by `service_role` only.
- `drop function if exists public.record_profile_verification_decision(uuid,text,text,uuid,text)`.
- `get_lagos_date()` → `security invoker`.

- [ ] **Step 1: Write tests:**

```sql
select is((select prosecdef from pg_proc where proname='update_updated_at_column'), false);
select ok((select proconfig::text from pg_proc where proname='update_updated_at_column') like '%search_path=pg_catalog, public%');
select hasnt_function('public','record_profile_verification_decision');
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `supabase test db` (all files). Expected: PASS. Then run the Supabase advisor locally (`supabase db lint`). Expected: no `rls_disabled_in_public` or `security_definer_view` errors.
- [ ] **Step 5:** Commit: `chore(db): function hardening and dead-code removal (BP-043/044)`.
