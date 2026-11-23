# BLUEPRINT — Risk Register

**Audit date:** 2026-11-23
**Status values:** Confirmed (static) · Confirmed (library source) · Probable (runtime) · Unverified
**DB** = database change required · **Live** = live verification required

| ID | Severity | Area | Title | Location | Status | DB | Live |
|---|---|---|---|---|---|---|---|
| BP-001 | Critical | DB security | `profile_verification_history` has no RLS; view bypasses RLS | 015:18-43 | Confirmed (static); impact depends on default privileges | Y | Y |
| BP-002 | High (blocker) | Migrations | `CREATE POLICY IF NOT EXISTS` is invalid in 014 and 019 | 014:50-85, 019:285-323 | Confirmed (static) | Y | Y |
| BP-003 | High (blocker) | Migrations | `\'` string syntax error | 018:65 | Confirmed (static) | Y | Y |
| BP-004 | High | Leaderboard | `get_leaderboard` bigint/integer mismatch and ambiguous columns | 019:336-397 | Confirmed (static) | Y | Y |
| BP-005 | High | Authorization | Verification states not enforced anywhere | middleware, actions, RLS | Confirmed (static) | Y | Y |
| BP-006 | High | Authorization | Multi-role `.maybeSingle()` → admin treated as student | lib/supabase/role.ts:14-20 | Confirmed (static) | N | Y |
| BP-007 | High | Verification | Terminal-state deadlock; no resubmit, suspend or restore | 016:139-143 | Confirmed (static) | Y | Y |
| BP-008 | High | Quests | `created_by` missing → creation always fails | features/quests/actions.ts:51-57 | Confirmed (static) | N | Y |
| BP-009 | High | Quests | Non-action closures passed to `<form action>` in RSC | admin/quests/page.tsx:23-42; quests/page.tsx:31 | Probable (runtime) | N | Y |
| BP-010 | High | Auth / UX | Account menus throw; sign-out never fires; no other logout | dashboard-shell.tsx:154-187; admin-shell.tsx:153-169 | Confirmed (library source) | N | Y |
| BP-011 | High | Notifications / PWA | SW has no push or click handler; UI claims push works | public/sw.js | Confirmed (static) | N | Y |
| BP-012 | High | Notifications | Lecture reminders never generated (`courses?.[0]`) | lib/notifications/delivery.ts:262 | Confirmed (static) | N | Y |
| BP-013 | High | Quests | Admin review hides evidence URL and notes | admin/quests/page.tsx:275-353 | Confirmed (static) | N | N |
| BP-014 | Medium | DB security | Students can insert submissions with any status | 018:164-173 | Confirmed (static) | Y | Y |
| BP-015 | Medium | XP integrity | Admin can mint XP for anyone, including self | 019:179-263 | Confirmed (static) | Y | Y |
| BP-016 | Medium | DB security | Trigger exempts admins; self-verification possible | 016:30-33 | Confirmed (static) | Y | Y |
| BP-017 | Medium | Profile | `full_name` and `avatar_url` freely editable after verification | 016 trigger; 019:384-386 | Confirmed (static) | Y | Y |
| BP-018 | Medium | Identity | Cohort and matric trusted from sign-up metadata; matric squatting | 011:56-69; register-form.tsx:81-86 | Confirmed (static) | Y | Y |
| BP-019 | Medium | Announcements | Scope not enforced for readers | 007 policy; announcements/queries.ts | Confirmed (static) | Y | Y |
| BP-020 | Medium | Auth | Open redirect via tab/newline in `next` | auth/confirm/route.ts:26-32,110 | Confirmed (static) | N | Y |
| BP-021 | Medium | Profile | Matric uniqueness pre-check blind under RLS; raw error | actions/profile.ts:41-61 | Confirmed (static) | N | Y |
| BP-022 | Medium | Security / UX | Raw DB errors returned to users | many actions | Confirmed (static) | N | N |
| BP-023 | Medium | Notifications | Verification notifications cannot be inserted | verification/actions.ts:21-63,98 | Confirmed (static) | N | Y |
| BP-024 | Medium | UX | No feedback on admin and quest actions | verification/actions.ts; quest pages | Confirmed (static) | N | N |
| BP-025 | Medium | Admin | "[object Object]" stat; `/admin` crashes without service key | admin/page.tsx:28-37,104 | Confirmed (static) | N | Y |
| BP-026 | Medium | Storage | Avatar remote hosts, 1 MB body limit, orphans, fake progress | next.config.ts; actions/profile.ts:159-271 | Confirmed (static) / Probable | N | Y |
| BP-027 | Medium | Leaderboard | No fallback; decorative period buttons; includes suspended users | leaderboard/page.tsx | Confirmed (static) | N | N |
| BP-028 | Medium | Quests | Update lacks validation; cannot deactivate; silent no-op | features/quests/actions.ts:78-146 | Confirmed (static) | N | N |
| BP-029 | Medium | Quests | No cancellation, no evidence upload, bucket unused; http allowed | 018/019; quests UI | Confirmed (static) | Y | N |
| BP-030 | Medium | Courses | Course management read-only; delete cascades | admin/courses/page.tsx; 001:38 | Confirmed (static) | Y | N |
| BP-031 | Medium | Reliability | Missing error boundaries and not-found for most routes | app/ | Confirmed (static) | N | N |
| BP-032 | Medium | Notifications | Targeting includes pending, rejected and suspended users; excludes admin-students; generic push text | lib/notifications/* | Confirmed (static) | N | N |
| BP-033 | Medium | Ops | Cron, Vault and pg_cron not configured; `CRON_SECRET` possibly compromised | schedule_notifications.sql | Unverified | N | Y |
| BP-034 | Medium | Process | Reported Phase 3 fixes absent from repository | git history | Confirmed (static) | – | – |
| BP-035 | Medium | QA | Tests largely tautological; no integration, RLS or E2E tests; SQL scripts invalid | src/**/__tests__, supabase/tests | Confirmed | N | N |
| BP-036 | Medium | A11y | Nested interactive elements | shells, admin pages | Confirmed (static) | N | Y |
| BP-037 | Medium | Time | Non-Lagos date rendering; `datetime-local` stored as UTC | quests, admin pages | Confirmed (static) | N | Y |
| BP-038 | Medium | Study planner | Fixed −14/+28 day data window | study-planner/page.tsx:18-25 | Confirmed (static) | N | N |
| BP-039 | Low | Auth | Logged-in redirect swallowed by try/catch | login/page.tsx:11-22; register/page.tsx:9-20 | Confirmed (static) | N | Y |
| BP-040 | Low | Auth | Reflected `?error` / `?message` text (content spoofing) | login/page.tsx:26-29 | Confirmed (static) | N | N |
| BP-041 | Low | Security | PostgREST `.or()` filter built by string interpolation | verification/queries.ts:45-49 | Confirmed (static) | N | N |
| BP-042 | Low | Verification | Actions shown for reviewed rows; approval allowed without matric | admin/verifications/page.tsx | Confirmed (static) | N | N |
| BP-043 | Low | DB | `current_user` check ineffective in SECURITY DEFINER | 004:60-64 | Confirmed (static) | Y | N |
| BP-044 | Low | DB | 018 drops search_path hardening on a trigger function | 018:223-231 | Confirmed (static) | Y | N |
| BP-045 | Low | DB | Duplicate identity triggers on profiles | 002:58; 016:76 | Confirmed (static) | Y | N |
| BP-046 | Low | DB | Self-insert profile with arbitrary status | 002/014 | Confirmed (static) | Y | Y |
| BP-047 | Low | API | `[id]` not validated; cross-user endpoint conflict | api/push/subscriptions | Confirmed (static) | N | N |
| BP-048 | Low | Notifications | Preferences query throws instead of defaulting | notifications/queries.ts:11-24 | Confirmed (static) | N | N |
| BP-049 | Low | Study planner | Update and reschedule validation gaps; silent no-op | study-planner/actions.ts | Confirmed (static) | N | N |
| BP-050 | Low | Announcements | No length limits | announcements/actions.ts; 001 | Confirmed (static) | Y | N |
| BP-051 | Low | UX | Inert dialog "Cancel" | quests/page.tsx:211 | Confirmed (static) | N | N |
| BP-052 | Low | Docs | Handoff inaccuracies (migration numbering 010–012, referenced docs missing, unverifiable "typecheck/lint/build pass" claims, "dual-guarded admin" claim undermined by BP-006) | AI_HANDOFF.md | Confirmed | – | – |
| BP-053 | Info | Security | No security headers or CSP; no hosting config, monitoring or CI | next.config.ts | Confirmed | N | N |
| BP-054 | Info | Framework | `middleware.ts` vs Next 16 `proxy` convention | middleware.ts | Unverified (docs not installed) | N | Y |
| BP-055 | Info | Maintainability | shadcn CLI in runtime deps; `cn` package; dead code | package.json, lib/utils.ts | Confirmed | N | N |
| BP-056 | Info | Security | Auth cookies not httpOnly (required by browser client) | lib/supabase/client.ts | Confirmed | N | N |
| BP-057 | Info | Secrets | No secrets in git history; rotate historical cron secret | git history | Confirmed / Unverified | N | Y |
| BP-058 | Info | Storage | Avatars world-readable (public bucket) | 014:36-44 | Confirmed | N | N |

## Risk heat summary

| | Likelihood: High | Medium | Low |
|---|---|---|---|
| **Impact: High** | BP-002, BP-003, BP-004, BP-005, BP-006, BP-008, BP-009, BP-010, BP-011, BP-012 | BP-001 (depends on grants), BP-007, BP-013 | – |
| **Impact: Medium** | BP-021, BP-022, BP-024, BP-025, BP-026, BP-027, BP-028, BP-031 | BP-014, BP-015, BP-016, BP-017, BP-018, BP-019, BP-020, BP-023, BP-033 | BP-046 |
| **Impact: Low** | BP-037, BP-038, BP-039, BP-051 | BP-040, BP-041, BP-042, BP-047, BP-048, BP-049, BP-050 | BP-043, BP-044, BP-045 |
