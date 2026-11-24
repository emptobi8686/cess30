# P0 Ground Truth and Tooling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish facts about the remote database and a working local toolchain (deps, local Supabase with pgTAP, Playwright, CI), so later phases can prove their changes.

**Architecture:** No product behaviour changes. Adds ops docs, test harnesses and a GitHub Actions workflow. The DB harness is *expected to fail* at the end of P0 because migrations 014/018/019 are broken. P1 Task 1 turns it green.

**Tech Stack:** npm, Supabase CLI (local Docker stack, `supabase test db` + pgTAP), Playwright (`@playwright/test`), GitHub Actions.

**Spec:** `docs/independent-audit-2026-11-23/TESTING_AND_QA_REPORT.md`, `DEPLOYMENT_READINESS.md`, `REMEDIATION_ROADMAP.md` Phase 0.

## Global Constraints

- Do not change application behaviour in this phase.
- Do not run any command against the production Supabase project except `supabase migration list` (read-only) 🔐.
- Never print or commit secret values. `.env*` stays git-ignored.
- Node 22; `next 16.4.6`; `react 19.3.0`. Keep `package-lock.json` consistent (`npm ci` must pass).
- Playwright: if the project pins `@playwright/test`, launch with `executablePath: '/opt/pw-browsers/chromium'` only in this environment; CI installs its own browsers.

## Review Focus

- Running `npm test` from a shell without globstar must still find tests in nested `__tests__` folders (quote the glob so Node expands it).
- A CI job with **no secrets** must still pass `npm run build` (provide dummy public env values in the workflow).
- `supabase db reset` must seed courses from the real seed path (config currently points at a non-existent `./seed.sql`).
- pgTAP helpers must not leak test users between files (each file runs in `begin … rollback`).
- The ledger doc must record whether 014–019 are applied. P1 Task 1's edit-in-place vs new-migration decision depends on it.

---

### Task 1: Record the remote migration ledger and phase decisions 🔐

**Files:**
- Create: `docs/ops/MIGRATION_LEDGER.md`
- Create: `docs/decisions/0001-migration-fix-strategy.md`

**Interfaces:**
- Produces: decision value `MIGRATION_FIX_STRATEGY` ∈ {`edit-in-place`, `forward-only`} that P1 Task 1 reads.

- [ ] **Step 1:** Run (human, with project credentials) `supabase link --project-ref <ref>` and then `supabase migration list`. Paste the Local/Remote table into `docs/ops/MIGRATION_LEDGER.md` with the date and operator name.
- [ ] **Step 2:** In `0001-migration-fix-strategy.md`, write `MIGRATION_FIX_STRATEGY: edit-in-place` if none of 014–019 appear under Remote, otherwise `forward-only`, with a one-paragraph rationale.
- [ ] **Step 3:** Commit: `docs(ops): record remote migration ledger and fix strategy`.

### Task 2: Install dependencies and record a baseline

**Files:**
- Modify: `package.json` (`scripts.test`)
- Create: `docs/ops/BASELINE_2026-11.md`

- [ ] **Step 1:** Change the test script to `"test": "tsx --test \"src/**/*.test.ts\""` (quoted so Node's test runner expands the glob, not the shell).
- [ ] **Step 2:** Run `npm ci`. Expected: exit 0, lockfile unchanged (`git diff --exit-code package-lock.json`).
- [ ] **Step 3:** Run `npm test`. Expected: 159 tests, all pass. Record the summary line.
- [ ] **Step 4:** Run `npm run typecheck`, `npm run lint` and `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy npm run build`. Record each exit code and the first 20 lines of any failure in `BASELINE_2026-11.md`. **Do not fix failures here.** List them as inputs to P1–P4.
- [ ] **Step 5:** Commit: `chore: quote test glob and record baseline`.

### Task 3: Local Supabase stack and pgTAP harness

**Files:**
- Modify: `supabase/config.toml` (`[db.seed] sql_paths = ["./seed/001_civil_engineering_courses.sql"]`)
- Create: `supabase/tests/database/_helpers.sql`
- Create: `supabase/tests/database/000_smoke.test.sql`
- Modify: `package.json` (add `"db:test": "supabase test db"`)

**Interfaces:**
- Produces, in `_helpers.sql` (schema `tests`, created inside each test transaction via `\ir _helpers.sql`):
  - `tests.create_user(p_email text, p_meta jsonb default '{}') returns uuid`: inserts into `auth.users` (`id`, `email`, `raw_user_meta_data`, `aud='authenticated'`, `role='authenticated'`) and returns the id. The profile trigger creates the profile.
  - `tests.authenticate_as(p_uid uuid) returns void`: `set local role authenticated` plus `set_config('request.jwt.claims', json_build_object('sub',p_uid,'role','authenticated')::text, true)`.
  - `tests.as_anon() returns void`, `tests.as_postgres() returns void` (`reset role`).
  - `tests.make_admin(p_uid uuid) returns void`: inserts the `user_roles(admin)` row as postgres.
  - `tests.set_verification(p_uid uuid, p_status text) returns void`: sets status as postgres, temporarily disabling the identity trigger with `session_replication_role=replica`.
- If `supabase test db` rejects `\ir`, install the `basejump-supabase_test_helpers` dbdev package instead and map the same names in `_helpers.sql`. Record the choice in the file header.

- [ ] **Step 1: Write the smoke test** `000_smoke.test.sql`:

```sql
begin;
\ir _helpers.sql
select plan(6);
select has_table('public','profiles');
select has_table('public','quests');
select has_table('public','xp_ledger');
select has_table('public','profile_verification_history');
select has_column('public','profiles','nickname');
select results_eq('select count(*)::int from public.courses', array[7]);
select * from finish();
rollback;
```

- [ ] **Step 2:** Run `supabase start && supabase db reset`. Expected: **FAIL** at migration 014 with `syntax error at or near "not"`. Record this in `BASELINE_2026-11.md` as the known blocker.
- [ ] **Step 3:** Commit: `test(db): add pgTAP harness and smoke test (expected red until P1)`.

### Task 4: Playwright harness

**Files:**
- Modify: `package.json` (devDependency `@playwright/test` pinned to an exact version; script `"e2e": "playwright test"`)
- Create: `playwright.config.ts` (baseURL `http://127.0.0.1:3000`; `webServer: { command: "npm run dev", url: "http://127.0.0.1:3000", reuseExistingServer: true }`; projects: `chromium-desktop`, `mobile-chrome` using `devices['Pixel 7']`)
- Create: `e2e/smoke.spec.ts`

- [ ] **Step 1: Write the failing test** `e2e/smoke.spec.ts`:

```ts
test("landing page states independence from UNILAG", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/not an official University of Lagos/i)).toBeVisible();
});
test("protected route redirects anonymous users to /login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});
```

- [ ] **Step 2:** Run `npm run e2e -- --trace off`. Expected: PASS for both (no code change is needed; this verifies the harness).
- [ ] **Step 3:** Commit: `test(e2e): add Playwright harness`.

### Task 5: CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Jobs:**
- `app`: `actions/setup-node@v4` (node 22, npm cache) → `npm ci` → `npm run typecheck` → `npm run lint` → `npm test` → `npm run build` with env `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=ci-dummy`.
- `db`: `supabase/setup-cli@v1` → `supabase start` → `supabase db reset` → `supabase test db`.
- `e2e` (needs `db`): `supabase start`, export the local anon key from `supabase status -o env`, `npx playwright install --with-deps chromium`, `npm run e2e -- --trace off`.

- [ ] **Step 1:** Write the workflow (triggers: `pull_request`, `push` to `master`).
- [ ] **Step 2:** Push the branch and open a draft PR. Expected: `app` reflects the baseline, `db` **fails** at 014 (known), `e2e` passes.
- [ ] **Step 3:** Commit: `ci: add app, db and e2e jobs`.

### Task 6: Secret rotation and missing-work recovery checklist 🔐

**Files:**
- Create: `docs/ops/SECRETS_ROTATION.md` (table: secret name, location(s), rotated-on date, by whom. No values.)
- Create: `docs/decisions/0002-phase3-work-recovery.md`

- [ ] **Step 1 (human):** Rotate `CRON_SECRET` in the host env and in Supabase Vault `notifications_cron_secret`. If there is any doubt, regenerate the VAPID keys. Fill the table.
- [ ] **Step 2 (human):** Search the developer machine for the uncommitted "Phase 3" work (BP-034). Record either "pushed to branch `<name>` for review" or "abandoned; superseded by plans P1–P4".
- [ ] **Step 3:** Commit: `docs(ops): record secret rotation and phase-3 recovery decision`.

### Task 7: Blocking product decisions 🔐

**Files:**
- Create: `docs/decisions/0003-academic-calendar.md`: level range (100–500?), whether 100-level is departmental, current session label and dates, semester names and dates, semester for each of the 7 seeded courses
- Create: `docs/decisions/0004-content-and-roles-policy.md`: which pages pending or rejected students may read; approval of the capability set (P7); library copyright and past-question policy; AI content policy and reviewer pool; approval of external services (malware scan, doc conversion, YouTube Data API, video hosting)

- [ ] **Step 1 (human):** Fill both documents with the owner's decisions. Unanswered items are marked `OPEN` and block the phases named in the index.
- [ ] **Step 2:** Commit: `docs(decisions): record calendar and policy decisions`.
