# BLUEPRINT - AI Project Handoff

Treat the current source code and applied Supabase migrations as authoritative; this file is a summary and may become stale.

## Product

BLUEPRINT is an academic organisation platform for the initial University of Lagos (UNILAG) Civil Engineering 200-level pilot. It is an independent student project; do not imply official UNILAG endorsement.

## Stack

- Next.js 16 App Router (`next` 16.4.6)
- React 19 (`react` 19.3.0)
- TypeScript
- Tailwind CSS 4
- Supabase Auth and PostgreSQL (`@supabase/ssr`, `@supabase/supabase-js`)
- shadcn/ui (base-ui primitives) and Lucide icons
- zod for environment validation

```powershell
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

## Application routes

### Public
- `/` — landing page
- `/login`, `/register`, `/reset-password` — auth (supports Google OAuth + email/password with password visibility toggles and active session redirects)
- `/auth/confirm`, `/auth/callback` — PKCE code, token_hash, and OAuth callback routing with open redirect protection

### Student (protected — session required)
- `/dashboard` — real data: weekly study progress metrics, today's official lectures vs personal study sessions, next lecture & study block, recent announcements, verification banner
- `/timetable` — weekly/agenda timetable with week navigation
- `/study-planner` — personal study timetable: daily view, weekly view, monthly overview, and status lists with course selection, recurrence, conflict detection, and completion tracking
- `/announcements` — published announcements
- `/notifications` — in-app notification centre
- `/settings/notifications` — notification preferences and registered push devices
- `/quests` — browse active academic quests, submit evidence links, track submission status and XP earned
- `/leaderboard` — XP leaderboard (full rankings for admins, personal progress for students)
- `/settings` — account settings and PWA installation
- `/access-denied`

### Admin (protected — admin role required at middleware + layout level)
- `/admin` — overview with real counts and recent activity
- `/admin/timetable` — create, edit, cancel/restore, delete sessions
- `/admin/announcements` — create (draft/publish), edit, publish/unpublish, delete
- `/admin/courses` — read-only course catalogue view
- `/admin/verifications` — review student matriculation submissions (approve/reject)
- `/admin/quests` — manage quests (create/edit), review quest submissions (approve/reject with XP awards)

## Supabase status

- `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` configured. Phase 6 VAPID keys (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`), `VAPID_SUBJECT`, and `CRON_SECRET` were added to `.env.local` this session. `SUPABASE_SERVICE_ROLE_KEY` is not set locally — obtain from Supabase Dashboard → Settings → API; never commit.
- Migrations 001–013 are recorded as applied remotely. Migration 013 was applied via `supabase db push` and confirmed via `supabase migration list` (remote `013 | 013`, all in sync).
- Migrations 014–018 are local only (not deployed to remote Supabase).
- Live RLS testing with separate student/admin identities not yet completed.
- Live password-recovery email delivery is not yet verified (requires a real inbox and configured Supabase email template).
- Google OAuth provider setup instructions documented in `docs/GOOGLE_AUTH_SETUP.md`.
- Notifications/PWA setup is documented in `docs/NOTIFICATIONS_SETUP.md`. Production Web Push and Supabase Cron still require Vault secrets (`notifications_app_url`, `notifications_cron_secret`), `pg_cron`/`pg_net` extensions, and one-time execution of `supabase/schedule_notifications.sql` in the SQL Editor.

Required environment variables:
```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Database migrations

| # | File | Contents | Remote |
|---|------|----------|--------|
| 001 | `001_initial_schema.sql` | Tables, indexes, update triggers | ✅ |
| 002 | `002_rls_security.sql` | RLS policies, `is_admin()`, grants | ✅ |
| 003 | `003_admin_provisioning.sql` | `grant_admin_role()` function | ✅ |
| 004 | `004_security_hardening.sql` | Hardened functions, restricted grants | ✅ |
| 005 | `005_rls_helper_permissions.sql` | Restores `is_admin()` for `authenticated` | ✅ |
| 006 | `006_profile_auto_create.sql` | Trigger: auto-create `profiles` on sign-up | ✅ |
| 007 | `007_phase4_schema.sql` | `is_cancelled`, `cancelled_at`, `updated_by` on `lecture_sessions`; `is_published`, `updated_by` on `announcements`; updated RLS policy; grants INSERT/UPDATE/DELETE on both to `authenticated` | ✅ |
| 008 | `008_lagos_date_function.sql` | `get_lagos_date()` helper using `Africa/Lagos` | ✅ |
| 009 | `009_phase41_hardening.sql` | Split admin `FOR ALL` policies into INSERT/UPDATE/DELETE; admin announcement SELECT; function `search_path` hardening; audit-column triggers; partial unique index for active lecture slots; grants reaffirmed | ✅ |
| 010 | `010_phase43_auth_options.sql` | Phase 4.3: `verification_status` column on `profiles`, nullable `matric_number`, updated triggers `handle_new_user` and `prevent_profile_identity_changes` for Google OAuth and verification isolation | ✅ |
| 011 | `011_phase5_study_planner.sql` | Phase 5: `study_sessions` schema additions (`location`, `reminder_preference`, `completed_at`, `recurrence_id`, `recurrence_pattern`, `recurrence_end_date`), composite indexes, and explicit split RLS policies | ✅ |
| 012 | `012_study_session_completed_at.sql` | Adds `completed_at` to `study_sessions` | ✅ |
| 013 | `013_notifications.sql` | Notification inbox, user preferences, push subscriptions, delivery queue/claim function, and RLS | ✅ |
| 014 | `014_profile_enhancements.sql` | `nickname` column on profiles; re-grants INSERT/UPDATE/DELETE on profiles to authenticated (RLS enforces restrictions); `profile-pictures` Storage bucket with RLS policies; reaffirms `profiles_update_own` policy | ⬜ local only |
| 015 | `015_matric_verification_workflow.sql` | `verification_reviewed_at`, `verification_reviewed_by`, `verification_rejection_reason` columns on `profiles`; `profile_verification_history` table; `record_profile_verification_decision()` RPC; admin RLS policies on profiles and history | ⬜ local only |
| 016 | `016_verification_security_hardening.sql` | Extended `prevent_profile_identity_changes()` to protect all four verification metadata fields; atomic `verify_profile_decision()` RPC with `FOR UPDATE` row lock, admin verification via `is_admin()`, self-review rejection, rejection-reason validation; revoked direct INSERT on `profile_verification_history` from authenticated; revoked old `record_profile_verification_decision()` from authenticated | ⬜ local only |
| 017 | `017_remove_broad_admin_profile_update.sql` | Drops `profiles_update_verification_admin` policy from `public.profiles` — removes admin bypass path that allowed direct profile updates without audit history or row locking. Preserves `profiles_select_admin`, `profiles_update_own`, trigger, and RPC. | ⬜ local only |
| 018 | `018_quests_and_xp.sql` | Quests and XP ledger: `quests`, `quest_submissions`, `xp_ledger` tables; RLS policies (student read active quests/own submissions/own XP, admin all); `award_xp()` and `review_quest_submission()` SECURITY DEFINER RPCs for secure XP awards and submission review | ⬜ local only |

Seed: `supabase/seed/001_civil_engineering_courses.sql` — applied.

## Schema tables

| Table | Key notes |
|-------|-----------|
| `profiles` | Auto-created on sign-up via trigger (006 & 010). Protected identity fields; `verification_status` defaults to `'pending'`. |
| `courses` | Central catalogue. Admin-only write via RLS. Referenced by both lecture and study sessions. |
| `user_roles` | `role` ∈ {student, admin}. Bootstrap via SQL. `is_admin()` reads this exclusively (OAuth metadata cannot grant roles). |
| `lecture_sessions` | Includes `is_cancelled`, `cancelled_at`, `updated_by` (Phase 4). |
| `study_sessions` | Personal study timetable (Phase 5). Scoped strictly to `user_id = auth.uid()`. |
| `announcements` | Includes `is_published`, `updated_by` (Phase 4). Draft/publish workflow. |
| `notifications` | Per-user in-app inbox with optional push-delivery state and deduplication key (Phase 6; migration 013 pending). |
| `notification_preferences` | Per-user notification channels, reminder lead times, and quiet hours (Phase 6; migration 013 pending). |
| `push_subscriptions` | Private Web Push endpoints and keys; accessible only to the server service role (Phase 6; migration 013 pending). |
| `quests` | Verified academic quest definitions (title, description, XP reward, due date, active flag). Admin-managed; students read active quests only. (Migration 018; local only) |
| `quest_submissions` | Student evidence submissions linked to quests. Status: pending/approved/rejected. Student owns own submissions; admin reviews all. (Migration 018; local only) |
| `xp_ledger` | Append-only XP awards. Writes only via `award_xp()` RPC (admin only). Students read own XP; admins read all. (Migration 018; local only) |

## RLS summary

- Students: read own profile, read courses/sessions/published announcements, CRUD own study sessions (`user_id = auth.uid()`). Students cannot insert, update, or delete lecture sessions or announcements.
- Verification status: only administrators can change `verification_status` on `profiles`. Students can populate `matric_number` once if initially null (from Google OAuth), but cannot modify it after it is set.
- Study sessions: students can only select, insert, update, and delete their own rows (`auth.uid() = user_id`). Explicit split policies in migration 011 guarantee strict ownership isolation.
- Admins: manage all courses, lecture sessions, announcements; `is_admin()` SECURITY DEFINER granted to `authenticated`.
- Admin lecture/announcement writes use split INSERT/UPDATE/DELETE policies (migration 009): INSERT requires `created_by = auth.uid()`; UPDATE/DELETE only require `is_admin()`, so one administrator can manage another administrator's rows.
- Admin announcement SELECT is explicit (migration 009) so drafts and future-dated rows remain visible to admins.
- Published announcements require `is_published = true AND published_at <= now()` (migration 007).
- Audit columns (`created_by`, `created_at`) are protected from UPDATE by trigger (migration 009).
- A partial unique index blocks duplicate active lecture slots while allowing duplicates once a slot is cancelled (migration 009).
- Admin routes double-guarded: middleware checks `user_roles` table; admin layout calls `requireUserSession` + `getCurrentUserRole`.
- Notification rows are user-owned; push subscription rows are not exposed to authenticated clients. Privileged delivery uses a server-only Supabase service-role client.
- Quests: students read active quests (`is_active = true`), submit own evidence (one per student per quest), read own submissions and XP. Admins manage all quests, review all submissions, award XP via `award_xp()` and `review_quest_submission()` RPCs (SECURITY DEFINER, row-level locking). Direct writes to `xp_ledger` are revoked from `authenticated`.

## Timezone policy

- All academic calendar dates are `Africa/Lagos` (WAT, UTC+1, no DST).
- `src/lib/dates.ts` is the single source of truth: date strings are built with UTC calendar arithmetic, display formatting uses `Intl.DateTimeFormat` with `timeZone: "Africa/Lagos"`.
- `lecture_date` and `study_date` are treated as DATE-only calendar values; `published_at`, `cancelled_at`, and `completed_at` are instants.
- Do not use `toISOString().slice(0, 10)` for local dates, and do not rely on the server/browser default timezone.

## Key files

```
src/
├── app/
│   ├── actions/
│   │   ├── auth.ts              — signOut(), updatePassword() server actions
│   │   └── profile.ts           — submitMatricNumber() server action for Google accounts
│   ├── auth/
│   │   ├── confirm/route.ts     — PKCE code, OAuth callback, OTP & recovery routing
│   │   └── callback/route.ts    — delegates to handleAuthCallback
│   ├── login/
│   │   ├── page.tsx             — server wrapper (handles active session redirect & error params)
│   │   └── login-form.tsx       — Google OAuth + email/password login, visibility toggle
│   ├── register/
│   │   ├── page.tsx             — server wrapper (handles active session redirect)
│   │   └── register-form.tsx    — Google OAuth + email registration, visibility toggle
│   ├── reset-password/
│   │   ├── page.tsx             — server wrapper (request reset link)
│   │   ├── reset-password-form.tsx — client request form
│   │   └── update/page.tsx      — client "set new password" page (recovery session)
│   ├── admin/
│   │   ├── layout.tsx           — admin role guard (requireUserSession + role check)
│   │   ├── page.tsx             — admin overview (includes quest & verification stats)
│   │   ├── timetable/page.tsx   — session management
│   │   ├── announcements/page.tsx — announcement management
│   │   ├── courses/page.tsx     — course catalogue (read-only)
│   │   ├── verifications/page.tsx — matriculation review queue
│   │   └── quests/page.tsx      — quest management + submission review (approve/reject with XP)
│   ├── dashboard/page.tsx       — student dashboard with weekly study summary & today's study plan
│   ├── leaderboard/page.tsx     — XP leaderboard (full rankings for admins, personal progress for students)
│   ├── quests/page.tsx          — browse active quests, submit evidence, track status & XP
│   ├── timetable/page.tsx       — student timetable (week nav, agenda/week views)
│   ├── study-planner/page.tsx   — student personal study timetable
│   └── announcements/page.tsx  — student announcements
├── components/shared/
│   ├── admin-shell.tsx          — admin layout shell
│   ├── admin-sessions-table.tsx — session CRUD table
│   ├── admin-announcements-table.tsx — announcement CRUD table
│   ├── announcement-form.tsx    — create/edit announcement form
│   ├── dashboard-shell.tsx      — student layout shell (sign-out wired)
│   ├── lecture-session-form.tsx — create/edit session form
│   ├── timetable-grid.tsx       — agenda, weekly, today widgets
│   ├── verification-banner.tsx  — student verification & matric number onboarding prompt
│   └── study-planner/
│       ├── study-session-dialog.tsx — create & edit study sessions with recurrence
│       ├── reschedule-dialog.tsx    — quick reschedule date & time modal
│       ├── delete-dialog.tsx        — delete confirmation (single or entire series)
│       ├── study-session-card.tsx   — personal study session card (with completion toggle)
│       ├── lecture-session-card.tsx — official lecture card with distinct styling
│       └── study-planner-container.tsx — daily, weekly, monthly, status views & filters
├── features/
│   ├── study-planner/
│   │   ├── validation.ts        — pure time, date, recurrence & conflict rules
│   │   ├── queries.ts           — data fetching (range, today, next, weekly summary)
│   │   └── actions.ts           — server actions (create, update, delete, complete, reschedule)
│   ├── timetable/               — official timetable features
│   ├── announcements/           — announcement features
│   ├── quests/                  — quests & XP: queries.ts, actions.ts, __tests__/validation.test.ts
│   └── notifications/           — inbox actions, preference management, delivery stats
├── lib/
│   ├── auth.ts                  — signInWithEmail, signInWithGoogle, signUpWithEmail, resetPassword
│   ├── dates.ts                 — canonical Africa/Lagos date/time utilities
│   ├── password.ts              — password length/confirmation validation
│   ├── supabase/auth.ts         — requireUserSession() using getUser()
│   ├── supabase/role.ts         — getCurrentUserRole()
│   ├── notifications/           — reminder scheduling, targeting, push delivery, URL validation
│   └── __tests__/
│       ├── auth.test.ts
│       ├── dates.test.ts
│       ├── password.test.ts
│       ├── phase4.test.ts
│       ├── phase43-auth.test.ts — safeNextPath, OAuth error mapping, verification isolation
│       ├── phase5-study-planner.test.ts — study time range, recurrence, conflicts, isolation
│       ├── role.test.ts
│       ├── supabase-config.test.ts
│       └── notifications.test.ts — notification time, URL, and targeting rules
└── types/index.ts               — Profile with VerificationStatus, StudySessionWithCourse, DB row types
docs/
├── GOOGLE_AUTH_SETUP.md         — manual Google Cloud & Supabase configuration steps
├── NOTIFICATIONS_SETUP.md       — VAPID, Supabase Cron/Vault, deployment, and verification
└── PHASE_7_5_DEPLOYMENT_GUIDE.md — deployment guide for migrations 014–017
middleware.ts                    — session guard + admin role guard for /admin/*
supabase/migrations/             — 001–013
supabase/schedule_notifications.sql — one-time Vault-backed Supabase Cron setup
supabase/tests/rls_scenarios.sql — manual live RLS test scenarios
```

## Admin provisioning

Owner admin role provisioned. To add the course rep later:

```sql
insert into public.user_roles (user_id, role, assigned_by)
values ('COURSE_REP_UUID', 'admin', 'OWNER_UUID')
on conflict (user_id, role) do nothing;
```

## Last known verification (Phase 5)

- Personal study session creation with central course catalogue, location, reminder preference, and optional notes
- Recurring study sessions support (daily, weekly, selected weekdays) with recurrence ID grouping and safe generation bounds
- Conflict detection between proposed study sessions, existing study sessions, and official lectures
- Dedicated study planner interface (`/study-planner`): Daily view, Weekly 7-day view, Monthly overview, and Status lists (All, Upcoming, Completed, Overdue)
- Session management: single-click completion toggle with timestamp, reschedule dialog, and delete dialog (single session vs entire recurring series)
- Clear visual distinction between official lectures (slate, read-only) and personal study sessions (primary, editable, completable)
- Strict privacy & database security: explicit split RLS policies (`auth.uid() = user_id`) and server action ownership validation
- Dashboard integration (`/dashboard`): weekly study progress summary with real completion rate, today's study plan, next upcoming study session, and recently completed sessions
- Automated unit test suite in `src/lib/__tests__/phase5-study-planner.test.ts`
- Migrations 001–012 recorded as applied remotely; migration 013 is local only

## Phase 7 (in progress) — Profile & Matriculation Verification

### Completed this session

**Migration 014** (`supabase/migrations/014_profile_enhancements.sql`):
- Added `nickname` column to `public.profiles`
- Re-granted INSERT/UPDATE/DELETE on `public.profiles` to `authenticated` (fixes "permission denied for table profiles" — migration 010 had revoked writes; RLS `profiles_update_own` policy enforces restrictions)
- Created `profile-pictures` Storage bucket (5 MB limit, image MIME types only) with insert/select/update/delete RLS policies scoped to `auth.uid()` owning the object path
- Reaffirmed `profiles_select_own`, `profiles_insert_own`, `profiles_update_own` RLS policies

**Migration 015** (`supabase/migrations/015_matric_verification_workflow.sql`):
- Added `verification_reviewed_at`, `verification_reviewed_by`, `verification_rejection_reason` columns to `public.profiles`
- Created `public.profile_verification_history` table with audit trail
- Created `public.record_profile_verification_decision()` RPC (non-atomic, accepts caller-supplied reviewer ID)
- Added RLS policies for profiles (admin select/update) and profile_verification_history (own/admin select, admin insert)

**Migration 016** (`supabase/migrations/016_verification_security_hardening.sql`):
- Extended `prevent_profile_identity_changes()` to protect all four verification metadata fields from student modification: `verification_status`, `verification_reviewed_at`, `verification_reviewed_by`, `verification_rejection_reason`
- Created `public.verify_profile_decision(p_profile_id, p_new_status, p_rejection_reason)` — atomic SECURITY DEFINER RPC that:
  - Verifies admin via `public.is_admin()`
  - Rejects self-review (`p_profile_id = auth.uid()`)
  - Locks target profile row with `FOR UPDATE` to prevent concurrent conflicting decisions
  - Validates current verification status and requested decision
  - Requires non-empty rejection reason (min 12 chars) for rejection
  - Updates profile verification fields and inserts history record in the same transaction
  - Runs with `set search_path = pg_catalog, public`, fully qualified table references
  - Revoked from `public`/`anon`; granted only to `authenticated`
- Revoked execute on `record_profile_verification_decision()` from `authenticated`
- Dropped direct `profile_verification_history_insert_admin` policy — all history inserts go through the RPC
- Reaffirmed `is_admin()` execute grant for `authenticated`

**Migration 017** (`supabase/migrations/017_remove_broad_admin_profile_update.sql`):
- Drops `profiles_update_verification_admin` policy from `public.profiles`
- Removes admin bypass path that allowed direct profile updates without audit history or row locking
- Preserves `profiles_select_admin` (admin read for verification queue)
- Preserves `profiles_update_own` (student self-update)
- Preserves `prevent_profile_identity_changes()` trigger and `verify_profile_decision()` RPC

**Profile settings page** (`src/app/settings/profile/page.tsx` + `_components/profile-settings-client.tsx`):
- Server action `getProfile()` fetches profile without importing server Supabase client into client component boundary
- Upload/replace profile picture (validates MIME type, 5 MB limit, Supabase Storage, display progress)
- Delete profile picture
- Update nickname (max 100 chars)
- Submit matriculation number (existing `submitMatricNumber` action)
- View verification status with color-coded badge
- Read-only fields for name, department, level, matric number (protected by trigger)

**Dashboard shell** (`src/components/shared/dashboard-shell.tsx`):
- Profile dropdown now shows actual avatar (or initials fallback)
- Settings link now points to `/settings/profile`

**Settings index** (`src/app/settings/page.tsx`):
- Added "Profile & settings" card alongside notifications and PWA

**Dashboard** (`src/app/dashboard/page.tsx`):
- Passes `avatarUrl` and nickname-based `displayName` to `DashboardShell`

**Verification server actions** (`src/features/verification/actions.ts`):
- `applyVerificationDecision()` now calls the atomic `verify_profile_decision()` RPC instead of separate profile UPDATE + history INSERT
- Server-side admin authorization remains (`requireAdminSession`)
- Database independently verifies admin authorization inside the RPC
- Self-review rejected by the RPC
- Rejection reasons validated before RPC call
- Duplicate/conflicting decisions return understandable RPC errors
- Notifications created only after successful committed review; notification failure does not fail the review

**Fixes applied to unblock production build:**
- `src/lib/notifications/push.ts` — `import * as webPush from "web-push"`
- `src/app/actions/profile.ts` — `import { revalidatePath } from "next/cache"`
- `src/features/study-planner/actions.ts` — `import { revalidatePath } from "next/cache"`
- `public/sw.js` — `self.location.origin` → `self.origin`; `AbortError` handling in navigation catch

**Study planner** (`src/components/shared/study-planner/study-planner-container.tsx`, `study-session-card.tsx`):
- Inline success/error notifications for toggle complete, delete, and other study session actions
- Loading state during toggle complete action (Loader2 spinner on the completion button)
- Delete entire series option added to dropdown menu
- Completion checkmark icon shown on weekly view cards for completed sessions
- Toast-style notification area (top-right, auto-dismiss after 5s)

**Performance (Phase 5):**
- `src/app/dashboard/loading.tsx` — Suspense loading state for dashboard
- `src/app/dashboard/error.tsx` — Error boundary for dashboard
- `src/app/study-planner/loading.tsx` — Suspense loading state for study planner
- `src/app/study-planner/error.tsx` — Error boundary for study planner
- `src/app/settings/error.tsx` — Error boundary for settings
- Replaced `` with `next/image` in dashboard-shell.tsx (avatar, priority) and profile-settings-client.tsx (profile picture, priority)

### Verification (this session)
- `npm run typecheck` — passes (exit 0)
- `npm test` — 159 passed, 0 failed (44 suites, including 10 new quest validation tests)
- `npm run lint` — 0 errors (only pre-existing warnings in untouched files)
- `npm run build` — passes (Turbopack + type-check)

### Phase 8 — Quests, Leaderboard, Admin Dashboard Improvements

**Migration 018** (`supabase/migrations/018_quests_and_xp.sql`):
- `public.quests` — quest definitions (title, description, XP reward, due date, active flag, created_by)
- `public.quest_submissions` — student evidence submissions (quest_id, student_id, evidence_url, status, reviewed_by, rejection_reason); one submission per student per quest
- `public.xp_ledger` — append-only XP awards (user_id, quest_id, xp_amount, reason); direct writes revoked
- RLS: students read active quests/own submissions/own XP; admins manage all
- `award_xp()` RPC — SECURITY DEFINER, admin-only XP awards with input validation
- `review_quest_submission()` RPC — atomic submission review + XP award with row-level locking

**Quests page** (`src/app/quests/page.tsx`):
- Browse active quests with XP reward and due date
- Submit evidence URL via Dialog form (one submission per student per quest)
- View submission status (pending/approved/rejected) and rejection reasons
- XP and quests-completed summary cards

**Leaderboard page** (`src/app/leaderboard/page.tsx`):
- Admins: full XP leaderboard table with rankings
- Students: personal XP and quests completed summary

**Admin quests page** (`src/app/admin/quests/page.tsx`):
- Create new quests (title, description, XP reward, due date, active toggle)
- Edit existing quests
- Review pending submissions: approve (awards XP via RPC) or reject (requires 12+ char reason)
- Filter submissions by status (all/pending/approved/rejected)

**Admin overview** (`src/app/admin/page.tsx`):
- Added stat cards: pending verifications, active quests, pending submissions
- Added "Quests" quick link card
- Added "Quests" nav item to AdminShell sidebar

**Tests** (`src/features/quests/__tests__/validation.test.ts`):
- Quest creation input validation (title length, description length, XP range, due date format)
- Quest submission input validation (quest ID format, evidence URL, notes length)

### Outstanding
- Live browser verification of service worker fix (no browser environment available)
- Migrations 014, 015, 016, 017, 018 not yet applied to remote Supabase (requires explicit user approval per security guardrail; see `docs/PHASE_7_5_DEPLOYMENT_GUIDE.md`)
- Vault secrets, pg_cron/pg_net extensions, `supabase/schedule_notifications.sql` still pending
- Live push/RLS verification pending
- Database integration tests not executed against PostgreSQL (no local instance); real JWT auth and concurrency tests pending


## Security guardrails

- Never put service-role key in client code or `NEXT_PUBLIC_*`
- Admin access is enforced at middleware, layout, and server action level — not via hidden UI
- All privileged mutations verify role with `getCurrentUserRole()` server-side
- Study sessions are strictly private to their creator; no cross-student leakage via RLS or server actions
- Preserve existing migrations; add new numbered migrations for schema changes
- Never apply pending migrations to the live project without explicit user approval.
