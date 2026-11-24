# BLUEPRINT — Feature Completeness Matrix

**Audit date:** 2026-11-23
**Status legend:** ✅ Implemented (static evidence; not run live) · ⚠️ Partial or defective · ❌ Broken or absent · ❓ Unverifiable without live services
"Works locally" means it was traced statically. **No feature was exercised in a browser or against a real Supabase project during this audit.**

---

## 5.1 Authentication and account management

| Requirement | Status | Evidence |
|---|---|---|
| Registration (email) | ⚠️ | `register-form.tsx:81-86`. Client sets department and level (BP-018). A duplicate matric returns a raw Supabase error. |
| Login (email/password) | ✅ | `lib/auth.ts:9-18`, `login-form.tsx` |
| Logout | ❌ | The only controls are in the account menus, which are broken (BP-010) |
| Password recovery | ✅ / ❓ | `lib/auth.ts:73-90`. Email delivery unverified. |
| Password update | ✅ | `actions/auth.ts:27-76`. Verifies the session with `getUser()`, then signs out. |
| Google OAuth | ✅ / ❓ | `signInWithGoogle` → `/auth/confirm`. Provider configuration unverified (`docs/GOOGLE_AUTH_SETUP.md`). |
| Callback handling | ⚠️ | PKCE and token_hash handled. Open redirect (BP-020). |
| Session management | ✅ | `getUser()` everywhere (not `getSession()`). Middleware refreshes cookies. |
| Profile creation | ✅ | Trigger `handle_new_user` (011) |
| Role resolution | ❌ | BP-006 |
| Protected routes | ⚠️ | Session yes; verification no (BP-005) |
| Already-logged-in redirect on /login and /register | ❌ | `redirect()` inside `try/catch` is swallowed (BP-039) |

## 5.2 Student dashboard

| Requirement | Status | Evidence |
|---|---|---|
| Student info | ⚠️ | Selects `nickname` (requires 014). The error is ignored, so the profile falls back to an empty "pending" state. |
| Upcoming lectures | ✅ | `features/timetable/queries.ts:72-104` (Lagos-aware) |
| Announcements | ✅ | `getRecentAnnouncements(3)` |
| Study activity | ✅ | Weekly summary, today, next, recently completed: real data and no fabricated statistics |
| Quest progress / XP | ❌ | Not on the dashboard |
| Notifications | ⚠️ | Only via the header bell (`NotificationsMenu`) |
| Loading / error states | ✅ | `dashboard/loading.tsx`, `dashboard/error.tsx` |
| Rejection reason shown | ❌ | `VerificationBanner` is not given `rejectionReason` (`dashboard/page.tsx:91-94`) |

## 5.3 Course management

| Requirement | Status | Evidence |
|---|---|---|
| Listing | ✅ | `admin/courses/page.tsx` |
| Create / edit / delete / archive | ❌ | **Read-only.** The page text says to use the Supabase dashboard (BP-030). |
| Validation | n/a | – |
| Seed catalogue (7 courses, 19 units) | ✅ | `seed/001_civil_engineering_courses.sql` matches spec Part 4 exactly. `config.toml` seed path is wrong (`./seed.sql`). |
| Future course management | ❌ | No UI. RLS would allow admin writes. Deletion cascades to lectures (no archive). |

## 5.4 Timetable

| Requirement | Status | Evidence |
|---|---|---|
| Schedule display (week/agenda, navigation) | ✅ | `app/timetable/page.tsx` |
| Admin CRUD, cancel/restore | ✅ (statically) | `features/timetable/actions.ts`. Conflict detection and a partial unique index. |
| Recurring schedules | ❌ | Each lecture is a single dated row. A semester requires ~13× manual entry per course. |
| Lagos timezone | ✅ | `lib/dates.ts`, `get_lagos_date()`; 19 date tests pass |
| Lecture reminders | ❌ | Never generated (BP-012) |

## 5.5 Study planner

| Requirement | Status | Evidence |
|---|---|---|
| Create / edit / delete (single or series) | ✅ | `features/study-planner/actions.ts`. Ownership enforced in the app and in RLS. |
| Course association | ✅ | FK, optional |
| Recurrence (daily, weekly, selected weekdays) | ✅ | `validation.ts`; 22 tests pass |
| Conflict warnings | ✅ | Non-blocking warnings |
| Calendar navigation | ⚠️ | Data loaded only for −14…+28 days; the date picker allows any date, so days outside the window show "no sessions" (BP-038) |
| Validation on update/reschedule | ⚠️ | No title, notes or location length validation on update. Toggle and reschedule report success even when no row matched (BP-049). |

## 5.6 Announcements

| Requirement | Status | Evidence |
|---|---|---|
| Admin create (draft/publish), edit, publish/unpublish, delete | ✅ | `features/announcements/actions.ts` |
| Student access | ✅ | RLS: published and `published_at <= now()` |
| Targeting | ❌ | Scope is cosmetic for readers (BP-019). Notification targeting uses user-controlled cohort data (BP-018). |
| Length restrictions | ❌ | None (BP-050) |
| Notification on publish | ⚠️ | Fan-out works for in-app notifications. Push is ineffective (BP-011). Re-publishing does not re-notify (dedupe), which is reasonable. |

## 5.7 Notifications

| Requirement | Status | Evidence |
|---|---|---|
| Notification creation (announcements) | ✅ | `enqueueAnnouncementNotifications` (service role) |
| Lecture reminders | ❌ | BP-012 |
| Study reminders | ✅ (statically) | `delivery.ts:301-328` |
| Verification notifications | ❌ | BP-023 |
| Preferences UI and defaults | ⚠️ | DB defaults plus a trigger plus a backfill (013) are good. The query throws when the row is missing (BP-048). |
| Push subscribe / unsubscribe API | ✅ | zod, endpoint host allow-list, same-origin check, 10-device cap |
| Browser push delivery | ❌ | **The service worker has no `push` or `notificationclick` handler** (BP-011). The UI tells the user push is enabled. |
| Scheduled processing | ❓ | Route is ready. Vault secrets, pg_cron, pg_net and the schedule are not configured (per the handoff; unverified). |
| Failure visibility | ⚠️ | Admin overview shows failed push counts. Scheduler errors log only `error.name`. Students never see delivery failures. |

## 5.8 Quests and submissions

| Requirement | Status | Evidence |
|---|---|---|
| Quest creation | ❌ | `created_by` is never set, so a NOT NULL violation occurs on every insert (BP-008). Also BP-009. |
| Quest editing | ⚠️ | Title and XP only. Description and due date are not editable. A quest cannot be **deactivated** (an unchecked checkbox is skipped). No validation. Silent success (BP-028). |
| Student participation and submission | ❌ | BP-009 (form action). Tables absent until 018 applies (BP-003). |
| Cancellation | ❌ | No UI, action, grant or policy |
| Notes | ⚠️ | Captured but never shown to admins |
| Evidence handling | ❌ | URL only. **The admin review table does not display evidence** (BP-013). No upload UI; the `quest-evidence` bucket is unused. |
| Admin review, XP award | ⚠️ | The RPC is sound once applied. The page's form actions break rendering (BP-009). No feedback (BP-024). |
| `created_by` | ❌ | BP-008 |
| Submission ownership | ✅ | RLS plus server action |
| State transitions | ❌ | Students can insert any status (BP-014) |
| Evidence URL validation | ⚠️ | DB regex in 019 only (http allowed). The app checks length only. |
| Duplicate XP prevention | ✅ (019) | Unique `(user_id, quest_id)` plus an RPC check. Null-quest awards are unlimited (BP-015). |
| Self-review prevention | ⚠️ | In `review_quest_submission` only; bypassable via `award_xp` |
| Error reporting | ❌ | `console.error` only |
| Transaction integrity | ✅ | Single RPC transaction with a row lock |

## 5.9 Leaderboard

| Requirement | Status | Evidence |
|---|---|---|
| Ranking, totals, quest counts | ❌ | RPC errors (BP-004) |
| Supported periods | ❌ | Three periods are fetched, but only all-time is rendered. **The period buttons do nothing** (BP-027). |
| Application fallback | ❌ | None. The page throws, and there is no error boundary. |
| Empty state | ✅ | Present (unreachable while the RPC fails) |

## 5.10 Profile and verification

| Requirement | Status | Evidence |
|---|---|---|
| Profile info, nickname | ⚠️ | Needs 014 |
| Matric submission | ⚠️ | Ineffective pre-check, raw errors (BP-021) |
| Matric uniqueness at DB level | ✅ | `profiles_matric_number_unique` (001:12); case-sensitive |
| Avatar upload / replace / delete | ⚠️ | BP-026 |
| Verification status display | ✅ | Banner and badge |
| Verification history (student view) | ❌ | Not displayed anywhere |
| Admin review (approve/reject) | ⚠️ | Works via RPC once applied. No feedback. Buttons are shown for already-reviewed rows. Approval is allowed with no matric (BP-042). |
| Suspend / reinstate | ❌ | No UI; RPC forbids it after the first decision (BP-007) |
| Rejected recovery and resubmission | ❌ | Deadlock (BP-007) |
| Raw DB errors hidden | ❌ | BP-022 |

---

## Detailed functional findings

### BP-007 — Verification state machine deadlock
- **Severity:** High · **Location:** `016_verification_security_hardening.sql:139-143`; `016:42-62`; `verification-banner.tsx:337-357`
- **Observed:** Decisions are allowed only from `pending`. Students cannot change status, and cannot change matric once it is set. The banner instructs rejected users to resubmit, which is impossible.
- **Expected (spec 3.3):** A controlled resubmission workflow that preserves history, plus admin suspend and reinstate.
- **Fix:** `request_reverification(p_new_matric)` (student, rejected-only, writes history, resets to pending) and `admin_change_status(profile, status, reason)` (verified↔suspended). **DB change:** yes. **Live verification:** yes.

### BP-008 — Quest creation always fails
- **Severity:** High · **Location:** `src/features/quests/actions.ts:51-57` vs `018_quests_and_xp.sql:28` (`created_by uuid not null`, no default)
- **Observed:** The insert omits `created_by`, so a NOT NULL violation occurs and the raw error is returned, then discarded by the page wrapper. The historical defect is **not fixed**.
- **Fix:** `created_by: user.id`, and also add `with check (created_by = auth.uid())` to the policy. **DB change:** recommended.

### BP-009 — Plain async functions passed as `<form action>` in Server Components
- **Severity:** High · **Status:** Probable (runtime). React Server Components can only serialise functions that are server references.
- **Location:** `src/app/admin/quests/page.tsx:23-42` (used at :150, :210, :308, :320); `src/app/quests/page.tsx:31-36` (used at :188)
- **Observed:** `handleCreateQuest`, `handleUpdateQuest`, `handleReviewQuestSubmission` and `handleSubmitQuest` are ordinary module functions in files without `"use server"`, and the functions have no inline `"use server"` directive. Passing them as `action` props is expected to fail at render with "Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with 'use server'". On `/quests` this happens only when at least one quest card renders a dialog.
- **Fix:** Pass the imported server actions directly with `useActionState` in a client component (also solves BP-024), or add `"use server"` inside each wrapper. **Live verification:** yes (render the page).

### BP-011 — Web Push cannot display notifications
- **Severity:** High · **Location:** `public/sw.js` (18 lines); diff in commit `4561810`; `push-device-settings.tsx:93-114`
- **Observed:** The last commit removed the `fetch`, `push` and `notificationclick` handlers (the previous version had a syntax error: `await` inside a non-async `.catch` callback). The UI still registers `/sw.js`, subscribes, and reports "Push notifications are enabled on this device." With `userVisibleOnly: true` and no `push` handler, browsers show a generic fallback or may penalise or revoke the subscription. `PwaServiceWorkerRegistration` (which now *unregisters* every SW) is no longer mounted anywhere. `offline.html` is unused.
- **Fix:** Restore a corrected SW with `push`, `notificationclick`, an offline navigation fallback and versioned cache cleanup. Add a Playwright test with a mocked push.

### BP-012 — Lecture reminders are never generated
- **Severity:** High · **Location:** `src/lib/notifications/delivery.ts:41-51, 262`
- **Observed:** `lecture.courses?.[0]`. `lecture_sessions.course_id` is a many-to-one FK, so PostgREST embeds `courses` as an **object**, not an array. `[0]` is `undefined`, and every lecture hits `continue`. `features/timetable/actions.ts:41-45` already handles both shapes, which shows the authors knew about the issue. The historical defect is **not fixed**.
- **Fix:** Normalise as in `courseCodeFromRow`, and generate DB types.

### BP-013 — Admins review quest submissions without seeing the evidence
- **Severity:** High · **Location:** `src/app/admin/quests/page.tsx:275-353`
- **Observed:** The table shows student, quest, status and date. `evidence_url` and `notes` are fetched but never rendered.
- **Fix:** Render the evidence with `rel="noopener noreferrer"` and an `https:` scheme allow-list, render notes, and add signed-URL support for uploaded evidence.

### BP-024 — Admin and quest actions give no feedback
- **Severity:** Medium · **Location:** `features/verification/actions.ts:117-161`; `admin/quests/page.tsx:23-42`; `quests/page.tsx:31-36`
- **Observed:** All failure paths only `console.error` on the server. The user sees nothing: no success, no error, no pending state.

### BP-025 — Admin overview defects
- **Severity:** Medium · **Location:** `src/app/admin/page.tsx:31-37, 104, 28`
- **Observed:** `pendingVerifications` is the whole PostgREST response object, so `String(...)` renders "[object Object]". The historical defect is **not fixed**. `getNotificationDeliveryStats()` and the quest counts use the service-role key; without it (it is not set locally per the handoff) the whole page throws, and `/admin` has no error boundary.

### BP-027 — Leaderboard page
- **Severity:** Medium (on top of BP-004) · **Location:** `src/app/leaderboard/page.tsx:44-51, 83-105`
- **Observed:** Four RPC calls (all-time twice). Period "buttons" have no handlers or links. No fallback. Unverified and suspended users are included.

### BP-028 — Quest update
- **Severity:** Medium · **Location:** `src/features/quests/actions.ts:78-146`
- **Observed:** No validation (NaN XP passes to the DB). An unchecked `is_active` is omitted (`formData.get` returns null), so a quest can never be deactivated. `update` without `.select()` reports success even when RLS matched nothing.

### BP-030 — Course management is read-only
- **Severity:** Medium · **Location:** `src/app/admin/courses/page.tsx:96-99`

### BP-038 — Study planner data window
- **Severity:** Medium-Low · **Location:** `src/app/study-planner/page.tsx:18-25`
