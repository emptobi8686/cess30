# P10 Leaderboard v2, Release Engineering and Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship level- and session-scoped leaderboards, tighten constraints once backfills are verified, complete the end-to-end and observability coverage, and deploy to staging and then production with a staged per-level rollout.

**Architecture:** `xp_ledger` gains academic context, and `get_leaderboard` gains level and session parameters. Constraint tightening is gated by pre-check queries. A single journey E2E suite plus axe runs in CI. Structured logging with correlation ids, an error-monitoring integration behind approval, and documented runbooks for deployment, scheduler and rollback.

**Tech Stack:** PostgreSQL/pgTAP, Next.js 16, Playwright + axe, GitHub Actions, Supabase (staging branch or project), chosen host 🔐.

**Spec:** `department-expansion/07` (E9, E10, Phase E10); `DEPLOYMENT_READINESS.md`; `REMEDIATION_ROADMAP.md` Phase 5 and its exit criteria.

## Global Constraints

- **Gate 🔐:** hosting provider chosen; staging Supabase project or branch available; production credentials held by a named operator.
- No production migration without: green CI, staging applied for ≥48 h with the smoke suite passing, a `pg_dump` or PITR point recorded, and the reverse files ready.
- Rollout order: level 200 (existing pilot) → 300 → 100/400/500, each gated by the exit criteria in Task 6.
- Leaderboards include only verified students with a confirmed placement for the period's session.

## Review Focus

- XP earned in the previous session must not count toward the current session's level leaderboard.
- A student promoted from 200 to 300 mid-year must appear on the 200 leaderboard for XP earned while at 200, not on the 300 one.
- `NOT NULL` tightening must abort cleanly (no partial changes) if any row still lacks a value.
- The production scheduler must not run before `CRON_SECRET` rotation is recorded.
- A failed deployment must be reversible within 15 minutes by the documented procedure.

---

### Task 1: XP context and leaderboard v2 (E9)

**Files:**
- Create: `supabase/migrations/039_leaderboard_v2.sql`
- Test: `supabase/tests/database/700_leaderboard_v2.test.sql`

**Interfaces:**
- `xp_ledger` adds `session_id uuid`, `semester_id uuid`, `level_code_at_award text`. Backfill: `semester_id = semester_for_date(created_at at time zone 'Africa/Lagos')`, `session_id` from the semester, level from the placement confirmed for that session (null when none).
- `review_quest_submission` writes the three columns at award time.
- `drop function get_leaderboard(text)`; create `get_leaderboard(p_period text default 'all-time', p_level_code text default null, p_session_id uuid default null) returns table(user_id uuid, full_name text, avatar_url text, total_xp bigint, quests_completed bigint, rank bigint)`. Filters: verified; when `p_level_code` is given, `level_code_at_award = p_level_code`; when `p_session_id` (or the current session, for `weekly`/`monthly`) is given, `session_id = p_session_id`.

- [ ] **Step 1: Write failing tests** covering both Review Focus XP lines and one all-time cross-level case.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(db): level- and session-scoped leaderboard (E9)`.

### Task 2: Leaderboard UI filters

**Files:**
- Modify: `src/features/quests/leaderboard.ts` (`parseLeaderboardQuery(params): { period: LeaderboardPeriod; levelCode: string | null; sessionId: string | null }`. The level defaults to the viewer's confirmed level; `"all"` means null.)
- Modify: `src/features/quests/queries.ts:getLeaderboard(period, levelCode, sessionId)`; `src/app/leaderboard/page.tsx` (level and session selectors as links)
- Test: `src/features/quests/__tests__/leaderboard.test.ts` (extend)

- [ ] **Step 1: Write failing tests:** `parseLeaderboardQuery({level:"300"}, {defaultLevel:"200"}).levelCode==="300"`; `{level:"all"}` → null; `{level:"999"}` → falls back to the default level.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`, plus an e2e test: the level-200 student's default view shows "Level 200 · 2026/2027". Expected: PASS.
- [ ] **Step 5:** Commit: `feat(leaderboard): level and session filters`.

### Task 3: Constraint tightening (E10)

**Files:**
- Create: `supabase/migrations/040_constraint_tightening.sql`
- Test: `supabase/tests/database/710_tightening.test.sql`

**Interfaces:** a `do` block first asserts zero rows for each condition and raises `P0001` with counts otherwise. Then: `lecture_sessions.offering_id set not null`; `courses.department_id set not null`; `profiles.department_id set not null`. Open `migration_review_items` of types `lecture_out_of_range` and `offering_semester` must be zero.

- [ ] **Step 1: Write failing tests:** with a fixture lecture lacking `offering_id`, applying the migration file via `\i` raises and leaves `attnotnull=false`; with clean fixtures it sets `attnotnull=true`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(db): tighten academic constraints after verified backfill (E10)`.

### Task 4: Journey E2E suite in CI

**Files:**
- Create: `e2e/journeys/student-year.spec.ts` (register → verify by admin → request placement 200 → admin confirms and enrols → timetable shows only 200 offerings → submit quest → admin approves → leaderboard shows XP → library download → tutorial completion → sign out)
- Create: `e2e/journeys/staff-scopes.spec.ts` (library manager, tutorial curator and level coordinator can do only their scoped actions)
- Modify: `.github/workflows/ci.yml` (run `e2e/journeys` on `master` and on PRs labelled `full-e2e`; upload the Playwright report as an artifact on failure)

- [ ] **Step 1:** Write the specs. Run locally. Expected: they FAIL only where earlier phases left a gap. Fix the gaps in the owning phase's code, not by weakening the test.
- [ ] **Step 2:** Run until green on both Playwright projects (desktop, Pixel 7).
- [ ] **Step 3:** Commit: `test(e2e): full student and staff journeys in CI`.

### Task 5: Observability

**Files:**
- Create: `src/lib/log.ts`: `log(level: "info"|"warn"|"error", event: string, fields?: Record<string, string | number | boolean | null>): void` (JSON lines; drops keys matching `/token|secret|key|password|authorization|url/i`); `withRequestId(headers: Headers): string` (reads `x-request-id` or generates one)
- Modify: `middleware.ts` (sets `x-request-id`); replace `console.error` in `src/lib/notifications/*`, the cron routes and `src/lib/errors.ts:logServerError` with `log`
- Optional 🔐 (approval for a new dependency and an external service): error monitoring (e.g. `@sentry/nextjs`) configured with PII scrubbing. If not approved, document "logs only" in the runbook.
- Test: `src/lib/__tests__/log.test.ts`

- [ ] **Step 1: Write failing tests:** `log("info","x",{token:"abc",count:1})` writes JSON without `token` and with `count:1` (capture `process.stdout.write`).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement and replace the call sites.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(ops): structured logging with redaction and request ids`.

### Task 6: Staging, production deployment and staged rollout 🔐

**Files:**
- Create: `docs/ops/DEPLOYMENT.md` (env var matrix per environment with the source of each value, never the values; host setup; Supabase Auth redirect URLs; Google OAuth URIs; custom SMTP; migration procedure `supabase db push` with dry run; rollback procedure using the `supabase/rollback/*` files and host instant-rollback; backup/PITR verification)
- Create: `docs/ops/SCHEDULER.md` (Vault secrets, `pg_cron`/`pg_net`, both schedule files, verification query `select * from cron.job_run_details order by start_time desc limit 5`)
- Create: `docs/ops/ROLLOUT.md` (per-level checklist below)
- Create: `src/app/privacy/page.tsx`, `src/app/policies/library/page.tsx`, `src/app/policies/ai-content/page.tsx` (content from decision 0004; footer links)

**Per-level rollout exit criteria (copy into ROLLOUT.md):**
1. All placements for the level confirmed, or explicitly rejected.
2. Offerings for the current semester created and enrolments run.
3. Zero open `migration_review_items` for the level.
4. Isolation e2e passes with a real staging account for that level.
5. A level coordinator (or department admin) is named and trained.
6. Seven days of pilot with no Critical or High incidents before the next level.

- [ ] **Step 1 (human):** Provision staging. Apply all migrations. Run `supabase test db` against staging and `npm run e2e` against the staging URL. Record the results in `ROLLOUT.md`.
- [ ] **Step 2 (human):** Production: record the backup point, apply migrations, deploy the app, configure the scheduler (only after `SECRETS_ROTATION.md` shows the rotation), run the smoke journey.
- [ ] **Step 3 (human):** Roll out level by level against the exit criteria. Record the date and sign-off per level.
- [ ] **Step 4 (BP-052):** Rewrite `AI_HANDOFF.md` from verified state only: the migration list from `supabase migration list`, routes from the code, and test results from the latest CI run. Remove its stale entries in `.gitignore`. Replace the default `README.md` with setup, scripts and links to `docs/ops/*`.
- [ ] **Step 5:** Commit the docs and pages: `docs(ops): deployment, scheduler and staged rollout runbooks; privacy and content policies`.
