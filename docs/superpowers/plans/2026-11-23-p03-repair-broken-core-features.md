# P3 Repair Broken Core Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every existing feature that is currently broken work end to end: sign-out and menus, quests (create, edit, submit, cancel, review with evidence), leaderboard, admin overview, notifications (lecture reminders, verification notices, push display) and course management.

**Architecture:** Forms that need feedback become small client components using `useActionState` against `"use server"` actions returning a shared `ActionState`. Pure helpers (relation normalisation, safe links, period parsing, payload building) are unit-tested. The service worker's logic moves to `public/sw-core.js`, which is testable in Node.

**Tech Stack:** Next.js 16, React 19 `useActionState`, Base UI 1.9, Zod 4, Supabase, Web Push, pgTAP, Playwright.

**Spec:** `FEATURE_COMPLETENESS_MATRIX.md` (BP-008…013, 024, 025, 027…030), `UX_AND_ACCESSIBILITY_AUDIT.md` §1, `SECURITY_AUDIT.md` BP-010/023/041.

## Global Constraints

- Shared result type: reuse `ActionState` from `src/features/verification/action-state.ts` (P2). Move it to `src/lib/action-state.ts` in Task 2 and re-export it from the old path.
- Never pass a plain closure to `<form action>` in a Server Component. Use imported server actions or client components.
- External links rendered from user data must go through `toSafeExternalHref` (https only) and use `rel="noopener noreferrer" target="_blank"`.
- Dates are formatted with `formatDisplayDate` / `formatTimestamp` from `src/lib/dates.ts` (Africa/Lagos).
- Base UI menus: `DropdownMenuLabel` must sit inside `DropdownMenuGroup`; items use `onClick`; triggers use `render={<Button …/>}`.

## Review Focus

- An evidence URL `javascript:alert(1)` or `http://…` stored before 019 must never render as a clickable link to admins.
- A quest due "2026-12-01 17:00" entered by an admin must close at 17:00 **Lagos** time, not 18:00.
- Unchecking "Active" on a quest and saving must actually deactivate it.
- A push notification click must open the in-app path and must never open an external URL, even if the payload is tampered with.
- The leaderboard with `?period=garbage` must fall back to all-time, not crash.

---

### Task 1: Account menus and sign-out (BP-010)

**Files:**
- Modify: `src/components/shared/dashboard-shell.tsx:152-197`, `src/components/shared/admin-shell.tsx:151-176`
- Modify: `src/app/settings/page.tsx` (add a "Sign out" card with `<form action={signOut}><Button type="submit">Sign out</Button></form>`)
- Test: `e2e/sign-out.spec.ts`

- [ ] **Step 1: Write the failing e2e test:** log in as a seeded verified student; open the account menu (`getByRole('button', { name: /account|student/i })`); click "Sign out"; expect URL `/login`; then `goto('/dashboard')` → `/login`. Second test: Settings → "Sign out" button → `/login`.
- [ ] **Step 2:** Run `npm run e2e -- e2e/sign-out.spec.ts --trace off`. Expected: FAIL (the menu throws or sign-out is inert).
- [ ] **Step 3:** Wrap the label in `DropdownMenuGroup`, change `onSelect` → `onClick`, change the trigger to `render={<Button …/>}`, and make the "Profile & settings" item `render={<Link href="/settings/profile" />}`. Apply to both shells. Add the settings card.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `fix(ui): working account menus and sign-out (BP-010)`.

### Task 2: Quest administration (BP-008, BP-009, BP-013, BP-024, BP-028)

**Files:**
- Create: `src/lib/action-state.ts` (move `ActionState`, `rpcErrorToMessage`)
- Create: `src/lib/safe-links.ts`: `toSafeExternalHref(value: string | null | undefined): string | null` (https absolute URL with host and no credentials; else null)
- Create: `src/lib/__tests__/safe-links.test.ts`
- Modify: `src/features/quests/validation.ts`: add `questUpsertSchema` (Zod): `title` 3–160 trimmed, `description` 10–1000, `xp_reward` int 1–10000 (coerced), `due_date` optional `datetime-local` string converted with `lagosDateTimeLocalToUtcIso`, `is_active` boolean from `"on"`/absent
- Create: `src/lib/dates.ts` addition: `lagosDateTimeLocalToUtcIso(value: string): string` (e.g. `"2026-12-01T17:00"` → `"2026-12-01T16:00:00.000Z"`)
- Modify: `src/features/quests/actions.ts`: `createQuestAction(prev: ActionState, formData)` sets `created_by: ctx.userId`; `updateQuestAction(prev, formData)` validates with the same schema (all fields, including description, due date and `is_active=false`) and uses `.select("id").maybeSingle()` to detect "not found"
- Create: `src/app/admin/quests/_components/{quest-create-form,quest-edit-form,submission-review-row}.tsx` (client)
- Modify: `src/app/admin/quests/page.tsx` (remove the `handle*` closures; render the components; the submissions table shows evidence link (via `toSafeExternalHref`, otherwise plain text "Unsafe link hidden") and notes)
- Test: `src/features/quests/__tests__/validation.test.ts` (extend), `src/lib/__tests__/dates.test.ts` (extend), `e2e/quests-admin.spec.ts`

- [ ] **Step 1: Write failing unit tests**

```ts
assert.equal(toSafeExternalHref("javascript:alert(1)"), null);
assert.equal(toSafeExternalHref("http://example.com"), null);
assert.equal(toSafeExternalHref("https://user:pw@example.com"), null);
assert.equal(toSafeExternalHref("https://drive.google.com/x"), "https://drive.google.com/x");
assert.equal(lagosDateTimeLocalToUtcIso("2026-12-01T17:00"), "2026-12-01T16:00:00.000Z");
const r = questUpsertSchema.safeParse({ title:"Lab 1", description:"Submit your lab write-up", xp_reward:"50" });
assert.equal(r.success && r.data.is_active, false);
```

- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement the helpers, schema, actions and components.
- [ ] **Step 4:** Run `npm test && npm run typecheck`. Add an e2e test: an admin creates a quest → it appears in the list with a success message; the admin unchecks Active → Save → the badge shows "Inactive". Run. Expected: PASS.
- [ ] **Step 5:** Commit: `fix(quests): admin create/edit with created_by, validation, evidence display (BP-008/009/013/028)`.

### Task 3: Student quest submission and cancellation (BP-009, BP-029)

**Files:**
- Create: `supabase/migrations/026_quest_cancel.sql`: extend the status CHECK to include `'cancelled'`; `public.cancel_quest_submission(p_submission_id uuid) returns void` (definer; caller owns it; status `pending` → `cancelled`); unique constraint replaced by a partial unique index `on (quest_id, student_id) where status <> 'cancelled'` so a student can resubmit after cancelling
- Test: `supabase/tests/database/080_quest_cancel.test.sql`
- Create: `src/app/quests/_components/submit-evidence-dialog.tsx` (client, `useActionState(submitQuestAction)`, `DialogClose` for Cancel)
- Modify: `src/features/quests/actions.ts`: `submitQuestAction(prev, formData)` returns `ActionState`; evidence must pass `toSafeExternalHref`; new `cancelQuestSubmissionAction(prev, formData)`
- Modify: `src/app/quests/page.tsx` (use the component; show the cancel button for pending; show the rejection reason; show dates via `formatDisplayDate`)

- [ ] **Step 1: Write failing DB tests:** owner cancels pending → lives, status `cancelled`; non-owner → raises; cancelling approved → raises; resubmit after cancel → lives.
- [ ] **Step 2:** Run `supabase test db`. Expected: FAIL.
- [ ] **Step 3:** Implement 026, the actions and the UI.
- [ ] **Step 4:** Run `supabase test db && npm test`. Add an e2e test: a verified student submits evidence → sees "Pending" → cancels → sees "Submit evidence" again. Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(quests): student submission feedback and cancellation (BP-009, BP-029)`.

### Task 4: Leaderboard page (BP-027)

**Files:**
- Create: `src/features/quests/leaderboard.ts`: `parseLeaderboardPeriod(value: string | string[] | undefined): LeaderboardPeriod` (default `"all-time"`)
- Modify: `src/app/leaderboard/page.tsx` (read `searchParams.period`; one `getLeaderboard(period)` call; period switcher as `<Link>`s with `aria-current`; on RPC error show the personal XP summary from `getUserXpSummary` plus the notice "Rankings are temporarily unavailable.")
- Create: `src/app/leaderboard/error.tsx`
- Test: `src/features/quests/__tests__/leaderboard.test.ts`

- [ ] **Step 1: Write failing tests:** `parseLeaderboardPeriod("weekly")==="weekly"`; `parseLeaderboardPeriod("garbage")==="all-time"`; `parseLeaderboardPeriod(["monthly","weekly"])==="monthly"`; `parseLeaderboardPeriod(undefined)==="all-time"`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. Add an e2e test: `/leaderboard?period=weekly` shows the "Weekly" link with `aria-current="page"`. Run. Expected: PASS.
- [ ] **Step 5:** Commit: `fix(leaderboard): working period selection, single RPC, fallback (BP-027)`.

### Task 5: Admin verification queue fixes (BP-041, BP-042)

**Files:**
- Create: `src/lib/postgrest.ts`: `escapeIlikeValue(value: string): string` (escapes `\`, `%`, `_`, `"`, then wraps in double quotes for `.or()`), `buildVerificationSearchFilter(q: string): string | null` (returns `full_name.ilike."%…%",matric_number.ilike."%…%"`, or null for an empty or >60-character input)
- Test: `src/lib/__tests__/postgrest.test.ts`
- Modify: `src/features/verification/queries.ts:45-49`; add pagination (`range`, 50 per page, `?page=`)

- [ ] **Step 1: Write failing tests:** `buildVerificationSearchFilter("ab,c)")` contains `"%ab,c)%"` inside quotes; `buildVerificationSearchFilter("")===null`; `escapeIlikeValue('a"b')` → `"a\"b"`; `%` → `\%`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `fix(admin): safe verification search and pagination (BP-041)`.

### Task 6: Admin overview (BP-025)

**Files:**
- Create: `src/features/admin/overview.ts`: `async function getAdminOverviewStats(): Promise<AdminOverviewStats>`, where `type AdminOverviewStats = { courses: number; sessions: number; published: number; drafts: number; pendingVerifications: number; activeQuests: number | null; pendingSubmissions: number | null; notifications: NotificationDeliveryStats | null; warnings: string[] }`. Service-role-dependent values are `null` with a warning "Server notification statistics are unavailable." when `SUPABASE_SERVICE_ROLE_KEY` is missing or the call fails.
- Create: `src/features/admin/__tests__/overview.test.ts` (pure `countOf(res: { count: number | null } | null): number`)
- Modify: `src/app/admin/page.tsx` (use the stats; render "—" for null; render warnings)
- Create: `src/app/admin/error.tsx`

- [ ] **Step 1: Write failing tests:** `countOf({count:3})===3`; `countOf({count:null})===0`; `countOf(null)===0`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. Add an e2e test: the admin overview shows a numeric "Pending verifications" value (regex `^\d+$`). Expected: PASS.
- [ ] **Step 5:** Commit: `fix(admin): correct overview counts and graceful degradation (BP-025)`.

### Task 7: Notification delivery fixes (BP-012, BP-023, BP-032)

**Files:**
- Create: `src/lib/supabase/relations.ts`: `firstRelation<T>(rel: T | T[] | null | undefined): T | null`
- Modify: `src/lib/notifications/delivery.ts:41-51,262` (use `firstRelation`); `loadTargetingData` filters profiles to `verification_status = 'verified'` and **includes** admins who have a `student` role row (exclude only admin-only accounts)
- Modify: `src/features/verification/actions.ts:createVerificationNotification` → use `createAdminSupabaseClient()`, `await` it, `upsert(…, { onConflict: "dedupe_key", ignoreDuplicates: true })`, dedupe key `verification:${profileId}:${status}:${historyId}`; return a warning string on failure, which the action surfaces to the admin
- Create: `src/lib/notifications/payload.ts`: `buildPushPayload(n: Pick<AppNotification,"id"|"notification_type"|"title"|"action_url">): { notificationId: string; title: string; body: string; actionUrl: string }`. Titles by type: lecture → "Lecture reminder", study → "Study session reminder", announcement → "New announcement", system → "BLUEPRINT update". The body is the notification title truncated to 120 characters. `actionUrl` via `getSafeActionUrl`.
- Modify: `src/lib/notifications/push.ts:121-126` (use `buildPushPayload`); log `error.message` (not only the name) without the endpoint
- Modify: `src/features/notifications/queries.ts:getNotificationPreferences` (BP-048): when no row exists, return `DEFAULT_NOTIFICATION_PREFERENCES` (values exactly as the column defaults in `013_notifications.sql:52-67`: push off, all reminder types on, 30 minutes, quiet hours off 22:00–07:00) instead of throwing; the first save upserts the row. Export the constant from `src/lib/notifications/defaults.ts` and assert it in `payload.test.ts`.
- Tests: `src/lib/supabase/__tests__/relations.test.ts`, `src/lib/notifications/__tests__/payload.test.ts`, `src/lib/notifications/__tests__/delivery-shape.test.ts`

- [ ] **Step 1: Write failing tests:** `firstRelation({a:1})` deep-equals `{a:1}`; `firstRelation([{a:1}])` deep-equals `{a:1}`; `firstRelation([])===null`. `buildPushPayload({notification_type:"announcement", title:"x".repeat(200), action_url:"//evil", id:"n"})` gives `actionUrl==="/notifications"` and `body.length===120`. Extract `lectureCourse(row: LectureRow): { course_code; department; level } | null` from delivery and test it with an **object-shaped** `courses` value.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit: `fix(notifications): lecture reminders, verification notices, typed push payloads (BP-012/023/032)`.

### Task 8: Service worker restoration (BP-011)

**Files:**
- Create: `public/sw-core.js`: UMD-style. Defines `getSafeTarget(value)` (same rules as `getSafeActionUrl`), `parsePushPayload(data)` (returns `{title, body, tag, target}` with defaults "BLUEPRINT" / "You have a new update."), `CACHE_VERSION = "blueprint-static-v2"`. Exposes them on `self.BlueprintSW`, and on `module.exports` when present.
- Modify: `public/sw.js`: `importScripts("/sw-core.js")`; install pre-caches `/offline.html` and icons; activate deletes `blueprint-static-*` caches other than `CACHE_VERSION` and calls `clients.claim()`; fetch handles navigate requests by network first, falling back to cached `/offline.html` (`async` callbacks only); `push` → `showNotification`; `notificationclick` → focus an existing client on the same origin or `openWindow(new URL(target, self.location.origin))`
- Delete: `src/components/shared/pwa-service-worker-registration.tsx` (unused, and it unregisters workers)
- Modify: `src/components/shared/pwa-install-provider.tsx` (register `/sw.js` once on mount, inside a `"serviceWorker" in navigator` check)
- Test: `src/lib/__tests__/sw-core.test.ts` (`require("../../../public/sw-core.js")`)

- [ ] **Step 1: Write failing tests:** `getSafeTarget("https://evil")==="/notifications"`; `getSafeTarget("/quests?x=1")==="/quests?x=1"`; `getSafeTarget("/\\evil")==="/notifications"`; `parsePushPayload(null).title==="BLUEPRINT"`; `parsePushPayload({json:()=>({title:5})}).title==="BLUEPRINT"`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Then run `node --check public/sw.js && node --check public/sw-core.js` (this guards against the earlier `await`-in-non-async syntax error).
- [ ] **Step 4:** Run `npm test`. Add an e2e test: `page.evaluate(() => navigator.serviceWorker.ready.then(r => !!r.active))` is true; with `context.setOffline(true)`, navigating to `/timetable` shows the offline page text. Expected: PASS.
- [ ] **Step 5:** Commit: `fix(pwa): restore service worker push, click and offline handling (BP-011)`.

### Task 9: Course management with archive (BP-030)

**Files:**
- Create: `supabase/migrations/027_course_archive.sql`: `courses.archived_at timestamptz`; change FK `lecture_sessions.course_id` from `on delete cascade` to `on delete restrict` (drop and re-add the constraint, `not valid` then `validate`); policy changes none
- Test: `supabase/tests/database/090_course_archive.test.sql` (deleting a course with lectures → `23503`; an admin can set `archived_at`)
- Create: `src/features/courses/{validation,actions,queries}.ts`: `courseSchema` (`course_code` `^[A-Z]{3}\d{3}$` uppercased, `course_title` 3–160, `credit_units` int 1–6, `level` in `100`–`500`); `createCourseAction`, `updateCourseAction`, `archiveCourseAction`, `restoreCourseAction` (all `requireAdmin`, `ActionState`); `getCourses({ includeArchived })`. Delete is available only when the course has no references (otherwise the action returns "Archive this course instead; it is referenced by timetable entries.")
- Modify: `src/app/admin/courses/page.tsx` (+ client form components); `src/features/dashboard/queries.ts:getCourses` and `src/features/study-planner/queries.ts:getCourses` exclude archived courses
- Test: `src/features/courses/__tests__/validation.test.ts`

- [ ] **Step 1: Write failing tests:** `courseSchema` accepts `{course_code:"cee301",course_title:"Structures I",credit_units:3,level:"300"}` with the code normalised to `"CEE301"`; rejects `credit_units: 0` and `course_code:"CE30"`; DB tests as listed.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test && supabase test db`. Add an e2e test: an admin adds CEE301, edits the title, archives it, and it disappears from the study-planner course dropdown. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(courses): admin course CRUD with archive and delete protection (BP-030)`.
