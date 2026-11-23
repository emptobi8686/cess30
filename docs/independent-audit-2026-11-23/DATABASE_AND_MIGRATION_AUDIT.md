# BLUEPRINT — Database and Migration Audit

**Audit date:** 2026-11-23 · **Method:** read every file in `supabase/` in dependency order. **No SQL was executed.**
**Remote state:** **UNVERIFIED.** The Supabase MCP connection returned an empty project list, so the remote migration ledger, schema, grants and policies could not be read. The historical claim "remote = 001–013" remains unconfirmed.
**Local tooling:** a `psql` client exists, but there is no PostgreSQL server, so no migration could be dry-run. The syntax findings below come from the PostgreSQL grammar and do not depend on remote data.

---

## 1. Migration inventory

| # | File | Main content | Static verdict |
|---|---|---|---|
| 001 | `001_initial_schema.sql` | 6 core tables, indexes, `updated_at` triggers. `matric_number` UNIQUE. | OK. `create trigger` is not idempotent (cannot be re-run). |
| 002 | `002_rls_security.sql` | `is_admin()`, `prevent_profile_identity_changes()`, RLS on 6 tables, policies, grants | OK. `validate_announcement_scope` is SECURITY DEFINER without a search_path (fixed in 009). |
| 003 | `003_admin_provisioning.sql` | `grant_admin_role()` | Superseded by 004. |
| 004 | `004_security_hardening.sql` | search_path hardening, revokes | `current_user` check ineffective (BP-043). Revoking `is_admin()` from `authenticated` breaks every RLS policy until 005. 004 and 005 must be applied together. |
| 005 | `005_rls_helper_permissions.sql` | Re-grant `is_admin()` to `authenticated` | OK |
| 006 | `006_profile_auto_create.sql` | `handle_new_user()` trigger on `auth.users` | Trusts metadata (BP-018). |
| 007 | `007_phase4_schema.sql` | cancellation and `is_published` columns, policy replacement, grants | OK. The comment at :69-72 does not match the code. |
| 008 | `008_lagos_date_function.sql` | `get_lagos_date()` | OK (SECURITY DEFINER is unnecessary but harmless). |
| 009 | `009_phase41_hardening.sql` | split admin policies, audit-column trigger, partial unique slot index | Good work. The index is skipped silently if duplicates exist, and that is only reported via `NOTICE`. |
| 010 | `010_least_privilege_table_grants.sql` | Revokes all, then re-grants | **Revokes INSERT/UPDATE on `profiles` from `authenticated`.** From 010 until 014, students cannot save a matric number, nickname or avatar. If the remote stops at 013, **profile writes currently fail on the live project** (unverified). |
| 011 | `011_phase43_auth_options.sql` | `verification_status`, nullable matric, OAuth-aware `handle_new_user`, trigger rewrite | Admin early-return in the trigger (BP-016). |
| 012 | `012_phase5_study_planner.sql` | study planner columns, indexes, split policies | OK |
| 013 | `013_notifications.sql` | notifications, preferences, push subscriptions, claim RPC, realtime | OK. Bare `create table` and `create trigger` are not idempotent. |
| 014 | `014_profile_enhancements.sql` | nickname, profile write grants, `profile-pictures` bucket and policies | **FAILS TO PARSE** (BP-002) |
| 015 | `015_matric_verification_workflow.sql` | review columns, history table, view, old RPC, policies | **No RLS on the history table** (BP-001). View bypasses RLS. |
| 016 | `016_verification_security_hardening.sql` | hardened trigger, `verify_profile_decision()` | Terminal-state deadlock (BP-007). Admin self-edit (BP-016). |
| 017 | `017_remove_broad_admin_profile_update.sql` | Drops the admin update policy | OK |
| 018 | `018_quests_and_xp.sql` | quests, submissions, ledger, RPCs | **FAILS TO PARSE** at line 65 (BP-003). Weak insert policy (BP-014). |
| 019 | `019_quests_security_fixes.sql` | FK change, XP uniqueness, URL check, policy split, evidence bucket, `get_leaderboard()` | **FAILS TO PARSE** (BP-002). `get_leaderboard` broken at runtime (BP-004). |
| 020 | — | Discussed historically as a corrective migration | **Does not exist** in the repository. |

Auxiliary files: `schedule_notifications.sql` (one-time cron setup, not a migration), `seed/001_civil_engineering_courses.sql` (7 courses, 19 units, matches spec Part 4), and `tests/*.sql` (manual scripts, never executed; see the testing report). Note that `config.toml` points `[db.seed] sql_paths` at `./seed.sql`, which does not exist, so `supabase db reset` would not seed courses.

---

## 2. Blocking defects

### BP-002 — `CREATE POLICY IF NOT EXISTS` is not valid PostgreSQL (014 and 019)

| Field | Detail |
|---|---|
| Severity | **High (release blocker)** |
| Location | `014_profile_enhancements.sql:50,56,65,78`; `019_quests_security_fixes.sql:285,294,303,316` |
| Observed | `create policy if not exists "…" on storage.objects …`. The PostgreSQL `CREATE POLICY` grammar (up to and including PG 17, the version pinned in `config.toml` `major_version = 17`) has no `IF NOT EXISTS` clause. |
| Impact | `supabase db push` / `migration up` stops with a syntax error. 014 is rolled back, and **015–019 never run**. Features that depend on 014–019 cannot work on a database built from this repository: nickname, avatars, profile writes, the verification workflow, quests, XP, leaderboard and evidence storage. Once 014 is fixed, 019 fails the same way. |
| Recommendation | Use the `do $$ … if not exists (select 1 from pg_policies …) then create policy …` pattern already used elsewhere in the same files, or `drop policy if exists …; create policy …`. Because 014–019 are reportedly unapplied, editing them in place is acceptable **only if** you confirm with `supabase migration list` that they are absent remotely. Otherwise add 020+. |
| DB change | Yes · **Live verification:** Yes (`supabase migration list`, then a dry run against a disposable local or branch database) |

### BP-003 — Escaped quote syntax error in 018

| Field | Detail |
|---|---|
| Severity | **High (release blocker)** |
| Location | `018_quests_and_xp.sql:65`: `comment on column … is 'URL to the student\'s evidence of quest completion.';` |
| Observed | With `standard_conforming_strings = on` (the default since PG 9.1, and Supabase's setting), a backslash inside a normal string literal is literal. The literal therefore ends at `\'`, and `s evidence …` is a syntax error. |
| Recommendation | Use `'student''s'` or an `E'…'` string. |

### BP-004 — `get_leaderboard()` cannot return rows

| Field | Detail |
|---|---|
| Severity | **High** |
| Location | `019_quests_security_fixes.sql:336-397`; caller `src/features/quests/queries.ts:116-147` |
| Observed | 1. **Type mismatch:** the declared output is `total_xp integer, quests_completed integer, rank integer`, but `sum(integer)` returns `bigint`, `count()` returns `bigint` and `rank()` returns `bigint`. PL/pgSQL `RETURN QUERY` raises `42804: structure of query does not match function result type` (`Returned type bigint does not match expected type integer in column 4`). 2. **Ambiguous identifiers:** in a `RETURNS TABLE` PL/pgSQL function the output column names (`user_id`, `full_name`, `avatar_url`, `rank`, …) are also PL/pgSQL variables. The final `select user_id, full_name, avatar_url, total_xp, quests_completed, rank from ranked order by rank` is unqualified and raises `42702: column reference "user_id" is ambiguous`. 3. An unknown `p_period` silently returns an empty set. 4. Rows include pending, rejected and suspended users and admins. |
| Impact | Every call errors. The leaderboard page has no fallback and no error boundary, so `/leaderboard` crashes (BP-027). The historical concern is **confirmed and still uncorrected**. |
| Recommendation | Declare the outputs as `bigint` (and update the TS types), or cast each expression with `::int`. Qualify the final select (`r.user_id …`) or use `#variable_conflict use_column`. Validate `p_period` and raise on invalid values. Filter `p.verification_status = 'verified'`. Prefer `language sql stable` for this query. |

---

## 3. Other schema and integrity findings

| ID | Severity | Finding | Location | Correction |
|---|---|---|---|---|
| BP-001 | Critical | History table without RLS; RLS-bypassing view | 015 | See the security audit |
| BP-007 | High | `verify_profile_decision` only accepts `pending → {verified,rejected,suspended}`. There is no path rejected→pending (resubmission), verified→suspended, or suspended→verified. Students cannot change `verification_status` or (once set) `matric_number`. This is a **permanent deadlock** for rejected students, and suspension can only happen at first review. | `016:139-143`; trigger `016:42-62` | Model explicit transitions in an RPC: `request_reverification()` for students (rejected→pending, allows a matric change, writes history), and `admin_set_status()` for verified↔suspended with a reason. |
| BP-014 | Medium | Submission INSERT accepts any status | `018:164-173` | Column-level grant plus a stricter `with check` |
| BP-015 | Medium | `award_xp` is callable directly by admins | `019:179-263` | Revoke from `authenticated` |
| BP-016 | Medium | Trigger exempts admins entirely | `016:30-33` | Use an RPC-scoped flag |
| BP-018 | Medium | Metadata trusted in `handle_new_user` | `011:56-69` | Do not read department or level from metadata |
| — | Medium | `review_quest_submission` reads the quest without `for share`, so a concurrent `xp_reward` edit can race. `award_xp` checks for duplicates with `exists` before inserting; the unique constraint (019:31-33) covers the race. | `019:140-168` | Acceptable once the 019 constraint is applied |
| — | Medium | `quest_submissions` has no student UPDATE or DELETE grant or policy, so **submission cancellation is impossible** at the database level (spec 5.8) | `018:112`; `019:73` | Add a `cancel_quest_submission(id)` RPC for pending rows the caller owns (set `status='cancelled'`; requires extending the CHECK) |
| — | Medium | `xp_ledger.user_id` is `ON DELETE RESTRICT` (019). This blocks deleting any auth user who has XP. That is intentional for history but conflicts with account deletion / data-subject requests. | `019:16-22` | Document it, or anonymise instead |
| — | Low | 019 adds a CHECK (`evidence_url ~* '^https?://…'`) and a UNIQUE constraint that would **fail on existing data** if 018 had been applied and contained non-conforming rows. There is no pre-check. | `019:31-44` | Add `NOT VALID` plus a later `VALIDATE`, or pre-clean |
| BP-044 | Low | `update_updated_at_column` redefined without search_path | `018:223-244` | Restore hardening |
| BP-045 | Low | Two identity triggers on profiles: `profiles_protect_identity_fields` (002) and `profiles_protect_identity` (014–016). Both run the same function on every update. | `002:58-61`; `016:76-80` | Drop the duplicate |
| BP-046 | Low | `profiles_insert_own` and the INSERT grant (014) allow a self-insert with an arbitrary status | 002, 014 | Revoke INSERT |
| — | Low | `courses` has no `is_active` / archive column. Deleting a course cascades to `lecture_sessions` (`001:38` `on delete cascade`) and sets null on study sessions and announcements. One admin DELETE removes the whole timetable history for that course. | 001 | Add an `archived_at` column and use `on delete restrict` |
| — | Low | `announcements.title/content` have no length CHECK. Notification titles are sliced to 160 characters in app code. | 001 | Add CHECKs (for example 1–160 and 1–5000) |
| — | Low | `profiles.matric_number` uniqueness is case- and whitespace-sensitive (`text`, not `citext`, although citext is installed in 001) | 001 | Normalise (upper/trim) in a trigger, or use `citext` |
| — | Info | `get_lagos_date()` is SECURITY DEFINER unnecessarily | 008 | Make it `security invoker` |
| — | Info | No index on `quest_submissions(status)` alone. Admin pending counts use `idx_quest_submissions_quest_status` (leading column `quest_id`), which is suboptimal but irrelevant at pilot scale. | 018 | Optional |

### Idempotency

Migrations 001, 002 and 013 use bare `create table`, `create policy` and `create trigger`. They are safe only under the migration ledger and cannot be re-run manually. Migrations 014–019 try to be idempotent but use invalid syntax for it (BP-002). Migration 019 `add constraint` statements are not guarded (`xp_ledger_user_quest_unique`, `quest_submissions_evidence_url_format`).

---

## 4. Function inventory (as defined by the final local state)

| Function | Security | search_path | Granted to | Notes |
|---|---|---|---|---|
| `is_admin()` | DEFINER | `pg_catalog, public` | authenticated, service_role | OK. Reads `user_roles` only (OAuth metadata cannot grant roles). |
| `grant_admin_role(uuid,uuid)` | DEFINER | hardened | service_role, postgres | BP-043 |
| `get_lagos_date()` | DEFINER | hardened | authenticated | OK |
| `handle_new_user()` | DEFINER | `pg_catalog, public, auth` | trigger | BP-018 |
| `prevent_profile_identity_changes()` | DEFINER | hardened (016) | trigger | BP-016 |
| `create_default_notification_preferences()` | DEFINER | `public, pg_temp` | trigger | OK. Creates preferences when a profile is inserted, and 013 backfills existing rows. |
| `claim_pending_notification_pushes(int)` | DEFINER | `public, pg_temp` | service_role | OK. Uses `skip locked`, batch-bounded. |
| `record_profile_verification_decision(...)` | DEFINER | `public, pg_temp` | revoked (016) | Dead code; should be dropped. |
| `verify_profile_decision(uuid,text,text)` | DEFINER | hardened | authenticated | Checks admin role and blocks self-review. Uses a row lock. BP-007. |
| `award_xp(...)` | DEFINER | hardened | authenticated | BP-015 |
| `review_quest_submission(...)` | DEFINER | hardened | authenticated | Admin-only, row lock, self-review blocked (019) |
| `get_leaderboard(text)` | DEFINER | hardened | authenticated | BP-004 (broken) |
| `update_updated_at_column()` / `validate_announcement_scope()` / `prevent_audit_column_changes()` | INVOKER | hardened (009) except 018's redefinition | trigger | BP-044 |

No SECURITY DEFINER function builds dynamic SQL, so there is **no definer-based injection**. All definer functions that matter re-check `auth.uid()` and `is_admin()` internally.

---

## 5. Feature → migration dependency map

| Feature | Requires | Works on a database at 013? |
|---|---|---|
| Auth, profile auto-creation | 006, 011 | Yes |
| Timetable, announcements | 001–009 | Yes |
| Study planner | 012 | Yes |
| Notifications, push, preferences | 013 (+ Vault, pg_cron, pg_net) | Inbox yes; scheduler unconfigured |
| Matric submission, nickname, avatar | **014** (grants, nickname, bucket) | **No.** 010 revoked profile writes, and the `nickname` select in `/dashboard` errors (the error is ignored, so the profile shows as empty) |
| Verification review | 015, 016, 017 | No (the RPC is missing) |
| Quests, XP | 018, 019 | No (tables missing; pages throw) |
| Leaderboard | 019 plus the BP-004 fix | No |
| Evidence storage | 019 (bucket) plus app code that does not exist | No |

**The application code on `master` queries objects (tables `quests`, `quest_submissions`, `xp_ledger`; column `nickname`; RPCs `verify_profile_decision`, `review_quest_submission`, `get_leaderboard`) that cannot exist on any database built from these migrations.** This is the most important cross-layer inconsistency.

---

## 6. Recommended migration plan (requires human approval; do not execute without it)

1. Run `supabase migration list` against the real project and record the ledger (needs human approval and credentials).
2. In a disposable local stack or Supabase branch: fix 014/018/019 syntax, apply 001→019 cleanly, then run the advisor.
3. Write migration **020** (or fold the fixes into 014–019 if they are confirmed unapplied): enable RLS on the history table and lock down the view; fix `get_leaderboard`; tighten the submission insert; revoke `award_xp`; add verification state-transition RPCs; restore trigger hardening; drop duplicate triggers and dead functions.
4. Write SQL-level tests with pgTAP or `supabase test db` that impersonate roles. Turn `supabase/tests/*.sql` into assertions (they are currently comments, with invalid UUID placeholders such as `11111111-1111-1111-111111111111`).
5. Only then, with explicit human approval, push to the remote.
