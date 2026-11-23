# BLUEPRINT — Testing and QA Report

**Audit date:** 2026-11-23

## 1. Package scripts (inspected before running anything)

```json
"lint": "eslint", "typecheck": "tsc --noEmit", "test": "tsx --test src/**/*.test.ts", "build": "next build"
```

## 2. What could and could not be executed

`node_modules` is **absent**. The audit rules prohibit installing dependencies, so `tsx`, `eslint`, the project's TypeScript compiler, `next` and the Supabase client libraries were unavailable.

To get *some* real evidence without installing anything or changing the project, the test files were run with **Node 22's built-in type stripping** (`node --experimental-strip-types --test`). A small resolver hook for the `@/` path alias was written in the session scratch directory, outside the repository. This executes the real test files against the real source modules. Test files that import uninstalled packages could not load.

| Check | Result | Notes |
|---|---|---|
| `npm run typecheck` | **Not run, blocked** | No `node_modules` (no type packages) |
| `npm run lint` | **Not run, blocked** | ESLint and config packages not installed |
| `npm run build` | **Not run, blocked** | `next` not installed |
| `npm test` (equivalent run) | **134 passed / 0 failed** in 9 files. **25 tests in 4 files blocked.** | See the table below |
| Database integration tests | **Not configured** | `supabase/tests/*.sql` are manual scripts with comments, not assertions |
| RLS scenario tests | **Not run, blocked** | No reachable Supabase project; no local PG server |
| Storage tests | **Not configured** | – |
| Auth tests (live) | **Not configured** | – |
| API route tests | **Not configured** | – |
| Browser E2E (Playwright) | **Not configured** | Playwright is pre-installed in this audit environment, but the project has no config or specs |
| PWA tests | **Not configured** | – |
| Vitest | **Not configured** | – |

### Per-file results (executed 2026-11-23)

| File | Tests | Result | What it actually proves |
|---|---:|---|---|
| `features/quests/__tests__/validation.test.ts` | 10 | ✅ 10 pass | Pure input-length and format rules. Does **not** cover `created_by`, the server action or the DB. |
| `features/timetable/__tests__/validation.test.ts` | 21 | ✅ 21 pass | Lecture input and conflict logic (good) |
| `lib/__tests__/dates.test.ts` | 19 | ✅ 19 pass | Lagos date arithmetic (good, meaningful) |
| `lib/__tests__/notifications.test.ts` | 7 | ✅ 7 pass | Reminder time math, URL and endpoint validation, targeting. Does **not** cover `delivery.ts` (where BP-012 lives). |
| `lib/__tests__/password.test.ts` | 6 | ✅ 6 pass | Password rules |
| `lib/__tests__/phase4.test.ts` | 25 | ✅ 25 pass | Timetable and announcement scope validation, dates |
| `lib/__tests__/phase5-study-planner.test.ts` | 22 | ✅ 22 pass | Study time, recurrence, conflicts. The "isolation" tests are logic simulations, not RLS. |
| `lib/__tests__/verification-security.test.ts` | 20 | ✅ 20 pass | Mostly **tautological**: e.g. asserts that a locally declared array contains the four field names (`:59-69`). It proves nothing about the trigger or RLS. |
| `lib/__tests__/verification-workflow.test.ts` | 4 | ✅ 4 pass | Pure helper functions |
| `lib/__tests__/auth.test.ts` | 6 | ⛔ blocked | Uses `require("@/lib/auth")`, which imports `@supabase/ssr` (not installed) |
| `lib/__tests__/phase43-auth.test.ts` | 12 | ⛔ blocked | Imports `auth/confirm/route.ts`, which imports `@supabase/ssr`. Would cover `safeNextPath` but **does not test the tab/newline bypass** (BP-020). |
| `lib/__tests__/role.test.ts` | 4 | ⛔ blocked | **Does not test `getCurrentUserRole` at all.** It asserts that `typeof isSupabaseConfigured === "function"` and that a local array contains "student" (`:15-39`). It cannot detect BP-006. |
| `lib/__tests__/supabase-config.test.ts` | 3 | ⛔ blocked | `zod` not installed |

**Total: 159 tests declared (matching the handoff's "159 passed"). 134 executed and passed here; 25 not executed.** The handoff claim that `typecheck`, `lint` and `build` pass **could not be independently confirmed.**

## 3. Coverage gaps (what no test touches)

| Area | Untested defects that a test would have caught |
|---|---|
| Role resolution | BP-006 (multi-role) |
| Server actions | BP-008 (`created_by`), BP-021 (raw duplicate error), BP-028 (deactivate impossible) |
| Notification delivery | BP-012 (`courses[0]`) |
| SQL migrations | BP-002, BP-003 (parse failures), BP-004 (`get_leaderboard` types), BP-001 (RLS off) |
| RLS | Every policy in the Authorization doc §2 |
| Auth callback | BP-020 (control-character bypass) |
| UI / E2E | BP-009 (form action), BP-010 (menus and sign-out), BP-011 (SW push) |
| Accessibility | Nested interactive elements (BP-036) |

## 4. Supabase SQL test scripts

- `supabase/tests/rls_scenarios.sql` and `verification_security_integration.sql` are **prose with SQL statements and "Expected:" comments**. They contain no assertions and are not wired to `supabase test db`.
- The admin placeholder UUIDs (`11111111-1111-1111-111111111111`, `22222222-2222-2222-222222222222`) have only four groups and are **invalid uuid literals**, so the scripts would error before testing anything.
- `verification_security_integration.sql:164-169` expects a direct INSERT into `profile_verification_history` to be rejected. With BP-001, that INSERT would **succeed** under default privileges. The test was never run, which is why the gap went unnoticed.

## 5. Mock vs real-service distinction

- **No test in the repository exercises Supabase, PostgREST, RLS, Storage, Auth or Web Push.** Every "security" test is a pure-function or documentation test.
- Earlier reports describing RLS or verification security as "tested" should be read as "logic helpers unit-tested; database behaviour untested".

## 6. Recommended QA programme

1. **CI gate** (GitHub Actions): `npm ci`, `typecheck`, `lint`, `test`, `build`.
2. **DB tests:** run `supabase start` locally, apply all migrations (this catches BP-002/003 immediately), then pgTAP tests impersonating anon, student A, student B, admin and admin+student for every table, function and storage policy.
3. **Server action tests:** inject a Supabase client so `features/*/actions.ts` can be tested against the local stack (not mocks).
4. **E2E (Playwright):** register → pending restrictions → admin verifies → student submits a quest → admin approves → leaderboard; sign-out; avatar upload; push subscribe with a mocked push service.
5. **Accessibility:** add `@axe-core/playwright` scans on key pages.
6. Replace the tautological tests (`role.test.ts`, parts of `verification-security.test.ts`) with tests of real behaviour.
