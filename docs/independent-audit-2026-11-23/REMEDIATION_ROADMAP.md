# BLUEPRINT — Remediation Roadmap

**Audit date:** 2026-11-23
**Nothing in this roadmap has been started.** Remediation requires explicit approval. Steps marked 🔐 require human approval for remote or production actions: database pushes, secret rotation, dashboard configuration.

## Phase 0 — Establish ground truth (about 0.5 day)

| Step | Action | Findings |
|---|---|---|
| 0.1 🔐 | Run `supabase migration list` against the real project and record which of 001–019 are applied. Confirm whether 014–019 are absent. | BP-002/003, DB audit |
| 0.2 🔐 | Locate any uncommitted "Phase 3" work on the developer machine. Commit and push it to a branch for review, or explicitly abandon it. | BP-034 |
| 0.3 🔐 | Rotate `CRON_SECRET` (host environment and Vault). | BP-033, BP-057 |
| 0.4 | Install dependencies in a dev environment. Run `typecheck`, `lint`, `test` and `build`, and record the results. | Testing report |

## Phase 1 — Database blockers and critical security (1–2 days)

All work happens in a **local or branch database**, with tests, before any remote push.

| Step | Change | Findings |
|---|---|---|
| 1.1 | Fix `create policy if not exists` (014, 019) and the `\'` literal (018). Edit in place only if 0.1 proves they are unapplied; otherwise add new migrations. | BP-002, BP-003 |
| 1.2 | New migration: enable RLS on `profile_verification_history`; revoke `anon`/`authenticated` privileges; grant SELECT only; drop the view or set `security_invoker`. | BP-001 |
| 1.3 | Fix `get_leaderboard`: bigint outputs or casts, qualified columns, period validation, verified-only filter. | BP-004 |
| 1.4 | Tighten `quest_submissions` insert (column grant plus `status='pending'` and active/not-overdue check); revoke `award_xp` from `authenticated`. | BP-014, BP-015 |
| 1.5 | Replace the admin early-return in `prevent_profile_identity_changes` with an RPC-scoped flag. Protect `full_name` after verification. Constrain `avatar_url` to the project's storage prefix. | BP-016, BP-017 |
| 1.6 | Stop reading `department` and `level` from metadata in `handle_new_user`. | BP-018 |
| 1.7 | Restore `update_updated_at_column` hardening; drop the duplicate trigger and the dead RPC. | BP-044, BP-045 |
| 1.8 | Build a pgTAP / `supabase test db` RLS suite (anon, student A and B, admin, admin+student). | BP-035 |

## Phase 2 — Authorization model (1–2 days)

| Step | Change | Findings |
|---|---|---|
| 2.1 | Fix `getCurrentUserRole` (filter `role='admin'`, or call `rpc('is_admin')`). Centralise `requireAdmin()` in `lib/auth/guards.ts`. Add unit tests with an injected client. | BP-006 |
| 2.2 | Add `getAccessContext()` returning `{user, isAdmin, verificationStatus}`, plus `requireAccess('read' \| 'student' \| 'admin')`. Apply it in layouts (introduce a `(student)` route group layout) and in **every** server action. | BP-005 |
| 2.3 | Add a `/suspended` page and a middleware redirect for suspended users. | BP-005 |
| 2.4 | Add verification-aware RLS (via a `current_verification_status()` helper) for `study_sessions` writes, `quest_submissions` inserts, and push subscription creation (server side). | BP-005 |
| 2.5 | Add verification state-transition RPCs (`request_reverification`, `admin_change_status`) and their UI (resubmission form; suspend/reinstate buttons). | BP-007 |

## Phase 3 — Broken core features (2–3 days)

| Step | Change | Findings |
|---|---|---|
| 3.1 | Fix the account menus: Group-wrapped label, `onClick`, `render` triggers. Add a visible sign-out in Settings. | BP-010 |
| 3.2 | Quests: `created_by`; move forms to client components with `useActionState` (feedback); full edit, including deactivate, description and due date in Lagos time; show evidence and notes; cancellation RPC and UI. | BP-008, BP-009, BP-013, BP-024, BP-028, BP-029 |
| 3.3 | Optional evidence upload to the private `quest-evidence` bucket, with path `<uid>/<submission>/…` and admin signed URLs. | BP-029 |
| 3.4 | Leaderboard: single period via `searchParams`, link-based period switcher, error boundary, and a documented fallback (for example, an own-XP summary when the RPC fails). | BP-027 |
| 3.5 | Verification admin: show actions for `pending` only; require a matric number; surface results; escape the search filter. | BP-041, BP-042 |
| 3.6 | Fix `[object Object]`; make `/admin` degrade gracefully when the service key is missing. | BP-025 |
| 3.7 | Fix the lecture reminder relation shape; send verification notifications with the service role; filter targeting by verification status; include admin-students. | BP-012, BP-023, BP-032 |
| 3.8 | Restore a correct service worker (`push`, `notificationclick`, offline fallback, cache versioning) and type-specific push payloads. | BP-011 |
| 3.9 | Course management CRUD with archive (`archived_at`) and `on delete restrict`. | BP-030 |

## Phase 4 — Hardening and quality (2–3 days)

| Step | Change | Findings |
|---|---|---|
| 4.1 | Fix the open redirect in `safeNextPath` (origin comparison, reject control characters) and add tests. | BP-020 |
| 4.2 | Central `toUserError()`; map `23505` to a friendly matric message. | BP-021, BP-022 |
| 4.3 | Avatar: `images.remotePatterns`, direct browser upload or `bodySizeLimit`, real progress, delete the old object, extension from MIME. | BP-026 |
| 4.4 | Add root and route `error.tsx` / `not-found.tsx`. | BP-031 |
| 4.5 | Accessibility: fix nested interactive elements and labels; run an axe pass. | BP-036 |
| 4.6 | Lagos-aware formatting everywhere; convert `datetime-local` to Lagos. | BP-037 |
| 4.7 | Study planner range fetching by view; validation parity for update and reschedule. | BP-038, BP-049 |
| 4.8 | Announcement length limits; scope-aware reads, or relabel scope as informational. | BP-019, BP-050 |
| 4.9 | Fix login/register redirects; allow-listed message codes. | BP-039, BP-040 |
| 4.10 | Security headers (CSP, frame-ancestors, referrer policy). Move `shadcn` to devDependencies. Remove dead code. Generate Supabase types. | BP-053, BP-055 |

## Phase 5 — Release engineering (1–2 days)

| Step | Change |
|---|---|
| 5.1 | GitHub Actions CI: typecheck, lint, unit tests, build, plus `supabase start` and DB tests. |
| 5.2 | Playwright E2E smoke suite (register → verify → quest → leaderboard → sign-out; push with a mocked service). |
| 5.3 🔐 | Staging environment; apply migrations; run the advisor; configure the scheduler on staging. |
| 5.4 🔐 | Choose a host. Configure env, OAuth redirects, custom SMTP, monitoring (e.g. Sentry), and a backup/PITR plan. |
| 5.5 | Privacy notice for matric, name and avatar data; pilot support channel; admin runbook. |
| 5.6 | Update the handoff documentation **from verified evidence only**; adopt descriptive commit messages. |

## Exit criteria for "GO FOR PILOT"

- All Critical and High findings closed and verified against a staging database.
- The RLS test suite is green for all roles. The Supabase security advisor shows no RLS-disabled tables in `public`.
- The E2E smoke suite is green on mobile and desktop viewports.
- The scheduler runs on staging, with lecture and study reminders delivered and push displayed on at least Android Chrome and one desktop browser.
- Secrets rotated. Monitoring and backups confirmed.
