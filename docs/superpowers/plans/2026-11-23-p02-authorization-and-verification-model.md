# P2 Authorization and Verification Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve roles correctly for multi-role users and enforce the pending/rejected/suspended/verified access model in middleware, layouts, server actions and RLS, including resubmission and suspend/reinstate flows.

**Architecture:** One server-side access context (`getAccessContext`) built on pure decision functions (`resolveAccess`, `canAccess`, `routeAccessLevel`) that are unit-tested. Middleware does coarse redirects, and guards in every server action do the fine checks. RLS adds `is_verified_student()` for student writes. Two new RPCs model verification transitions.

**Tech Stack:** Next.js 16 middleware and server actions, `@supabase/ssr`, Zod 4, pgTAP.

**Spec:** `AUTHORIZATION_AND_RLS_AUDIT.md` §1, spec Part 3.3 (in the audit brief), `FEATURE_COMPLETENESS_MATRIX.md` BP-007.

## Global Constraints

- Access policy (spec Part 3.3, decision doc 0004 may narrow it): **pending** = read-only timetable and announcements, plus profile, verification and notifications; **rejected** = pending's access plus the resubmission flow; **suspended** = only `/suspended`, sign-out and support; **verified** = full student access; **admin** = admin area plus student access per their own verification status.
- Never trust client-supplied role or status. Always read them via the server Supabase client.
- Read `node_modules/next/dist/docs/` for middleware/proxy conventions before Task 3.

## Review Focus

- A user with **both** `student` and `admin` rows must reach `/admin` and run admin actions.
- A user with **no profile row** (trigger failure) must be treated as `pending`, not verified and not crashing.
- A suspended user who bookmarked `/study-planner` must land on `/suspended`, not on a blank error.
- A pending student calling the `createStudySession` server action directly (bypassing the UI) must get `{ ok:false }`.
- A rejected student resubmitting the **same** matric number must be allowed, and history must record the transition.

---

### Task 1: Access context with correct multi-role resolution (BP-006)

**Files:**
- Create: `src/lib/auth/access.ts`
- Create: `src/lib/auth/__tests__/access.test.ts`
- Modify: `src/lib/supabase/role.ts` (re-implement `getCurrentUserRole()` as `(await getAccessContext())?.isAdmin ? "admin" : "student"`, kept only for back-compat)

**Interfaces:**
- Produces:
  - `type AccessLevel = "none" | "read" | "full"`
  - `type AccessContext = { userId: string; isAdmin: boolean; roles: Array<"student"|"admin">; verificationStatus: VerificationStatus }`
  - `function resolveAccess(userId: string, roleRows: Array<{ role: string }>, profile: { verification_status: string } | null): AccessContext` (pure)
  - `function studentAccessLevel(ctx: AccessContext): AccessLevel` (pure): verified→full, pending/rejected→read, suspended→none
  - `async function getAccessContext(): Promise<AccessContext | null>`: `getUser()`, then `user_roles.select("role").eq("user_id", id)` (**no** `.maybeSingle()`), then the profile `verification_status`

- [ ] **Step 1: Write failing tests**

```ts
test("admin+student rows resolve isAdmin true", () => {
  const ctx = resolveAccess("u1", [{ role: "student" }, { role: "admin" }], { verification_status: "verified" });
  assert.equal(ctx.isAdmin, true);
  assert.deepEqual(ctx.roles.sort(), ["admin", "student"]);
});
test("missing profile resolves to pending", () => {
  assert.equal(resolveAccess("u1", [], null).verificationStatus, "pending");
});
test("unknown status resolves to pending", () => {
  assert.equal(resolveAccess("u1", [], { verification_status: "weird" }).verificationStatus, "pending");
});
test("studentAccessLevel maps statuses", () => {
  for (const [s, l] of [["verified","full"],["pending","read"],["rejected","read"],["suspended","none"]] as const)
    assert.equal(studentAccessLevel(resolveAccess("u", [], { verification_status: s })), l);
});
```

- [ ] **Step 2:** Run `npm test`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement `access.ts` per the interfaces.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit: `fix(auth): resolve multi-role users via access context (BP-006)`.

### Task 2: Guards replacing duplicated admin checks

**Files:**
- Create: `src/lib/auth/guards.ts`, `src/lib/auth/__tests__/guards.test.ts`
- Modify: remove the local `requireAdminSession` from `src/features/{timetable,announcements,quests,verification}/actions.ts` and import from guards. Replace the `getCurrentUserRole()` checks in `src/features/quests/queries.ts`, `src/features/notifications/queries.ts:getNotificationDeliveryStats`, `src/app/admin/layout.tsx`, `src/app/leaderboard/page.tsx`.

**Interfaces:**
- Produces:
  - `class AccessDeniedError extends Error { code: "unauthenticated" | "forbidden" | "suspended" }`
  - `function assertAccess(ctx: AccessContext | null, need: "admin" | "read" | "full"): AccessContext` (pure; throws `AccessDeniedError`)
  - `async function requireAdmin(): Promise<AccessContext>`, `async function requireStudentAccess(need: "read" | "full"): Promise<AccessContext>` (wrap `getAccessContext` + `assertAccess`)
  - Actions convert `AccessDeniedError` to `{ ok:false, error: "You do not have access to this action." }`

- [ ] **Step 1: Write failing tests** for `assertAccess`: null ctx → `unauthenticated`; non-admin with need `admin` → `forbidden`; suspended with need `read` → `suspended`; pending with need `full` → `forbidden`; verified with need `full` → returns ctx; admin+pending with need `admin` → returns ctx.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement and replace the call sites. Run `npm run typecheck`.
- [ ] **Step 4:** Run `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit: `refactor(auth): central guards for admin and student access`.

### Task 3: Route-level enforcement and suspended page (BP-005)

**Files:**
- Create: `src/lib/auth/routes.ts`, `src/lib/auth/__tests__/routes.test.ts`
- Create: `src/app/suspended/page.tsx` (explains suspension, includes the sign-out form from P3 Task 1 or, until then, a `<form action={signOut}>`)
- Modify: `middleware.ts` (after `getUser`, load roles and profile status, call `routeDecision`)
- Modify: `src/app/access-denied/page.tsx` (student-facing copy; no "configure Supabase" text)

**Interfaces:**
- Produces:
  - `function routeAccessLevel(pathname: string): "public" | "read" | "full" | "admin" | "suspended-page"`. Read routes: `/dashboard`, `/timetable`, `/announcements`, `/notifications`, `/settings`, `/settings/profile`, `/settings/notifications`. Full routes: `/study-planner`, `/quests`, `/leaderboard`. Admin: `/admin` and children. Suspended page: `/suspended`.
  - `function routeDecision(ctx: AccessContext, pathname: string): { action: "allow" } | { action: "redirect"; to: "/suspended" | "/access-denied" | "/dashboard" }`. Suspended (non-admin) → `/suspended` for every protected route; read-level user on a full route → `/dashboard`; non-admin on admin → `/access-denied`; non-suspended user visiting `/suspended` → `/dashboard`.
- Add `/suspended` to the middleware matcher.
- BP-054: if the Next 16.4.6 docs in `node_modules/next/dist/docs/` mark `middleware.ts` as deprecated in favour of `proxy.ts`, rename the file and export per the documented convention in this task. Record which convention was used in the commit message.

- [ ] **Step 1: Write failing tests** with table-driven cases covering every route class × status (pending, rejected, suspended, verified) × isAdmin.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement `routes.ts` and wire up the middleware.
- [ ] **Step 4:** Run `npm test`. Then add `e2e/access.spec.ts`: a seeded pending user visiting `/study-planner` ends at `/dashboard`; a suspended user visiting `/dashboard` ends at `/suspended`. Run `npm run e2e -- --trace off`. Expected: PASS. (Seed users via `supabase/tests/e2e_seed.sql`, executed in the e2e job with `psql` against the local DB.)
- [ ] **Step 5:** Commit: `feat(auth): enforce verification states at route level (BP-005)`.

### Task 4: Server-action and API enforcement

**Files:**
- Modify: `src/features/study-planner/actions.ts` (all exported actions → `requireStudentAccess("full")`)
- Modify: `src/features/quests/actions.ts:submitQuestAction` (`requireStudentAccess("full")`)
- Modify: `src/app/api/push/subscriptions/route.ts` POST (`read` minimum; suspended → 403)
- Modify: `src/features/notifications/actions.ts` (`read`)
- Test: `src/features/study-planner/__tests__/actions-guard.test.ts`

**Interfaces:**
- Consumes: `requireStudentAccess` (Task 2).
- Produces (in `src/lib/auth/guards.ts`, **not** in any `"use server"` file, because every export of a `"use server"` module becomes a publicly callable server action): `setAccessResolverForTests(fn: (() => Promise<AccessContext | null>) | null): void`. It throws unless `process.env.NODE_ENV === "test"`, and `requireStudentAccess` / `requireAdmin` use the override when set.

- [ ] **Step 1: Write failing test:** with the resolver returning a pending ctx, `await createStudySession(new FormData())` deep-equals `{ ok:false, error:"You do not have access to this action." }`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement guards in each listed action.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(auth): enforce verification in student actions and push API (BP-005)`.

### Task 5: Verification-aware RLS for student writes

**Files:**
- Create: `supabase/migrations/024_verification_access_rls.sql`
- Test: `supabase/tests/database/060_verification_access.test.sql`

**Interfaces:**
- Produces: `public.is_verified_student() returns boolean` (stable, definer): the profile for `auth.uid()` has `verification_status = 'verified'`.
- Policies: `study_sessions_insert_own` / `_update_own` add `and public.is_verified_student()`; `quest_submissions_insert_own` adds `and public.is_verified_student()`. Select and delete on own study sessions remain allowed for every status (data portability).

- [ ] **Step 1: Write failing tests:** a pending student inserting a study session → `42501`; a verified student → lives; a suspended student selecting own sessions → returns rows; a pending student inserting a quest submission → `42501`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement 024.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(db): verification-aware student write policies (BP-005)`.

### Task 6: Verification transitions (BP-007)

**Files:**
- Create: `supabase/migrations/025_verification_transitions.sql`
- Test: `supabase/tests/database/070_verification_transitions.test.sql`

**Interfaces:**
- Produces: `public.request_reverification(p_matric_number text) returns text` (definer, `authenticated`): caller status must be `rejected`. Validates the matric against `^[A-Za-z0-9/_-]{6,15}$`. Sets the flag `blueprint.verification_rpc`. Updates `matric_number` (uniqueness → raises `23505`), `verification_status='pending'`, clears the reviewer fields. Inserts history (`previous_status='rejected'`, `new_status='pending'`, `reviewed_by = auth.uid()`).
- Produces: `public.admin_change_status(p_profile_id uuid, p_new_status text, p_reason text) returns text` (definer, admin only, not self). Allowed transitions: `verified→suspended`, `suspended→verified`, `rejected→pending` (admin reopen). `p_reason` must be ≥12 characters for `suspended`. Writes history.
- Modifies: the history CHECK `verification_history_reason_required_for_rejection` stays valid (reason null unless `new_status='rejected'`). Add column `note text` for suspension reasons instead of reusing `rejection_reason`.

- [ ] **Step 1: Write failing tests:** rejected→pending by owner (same matric) lives and writes 1 history row; a pending student calling it → raises; admin suspends verified → lives; admin suspends self → raises; admin reinstates suspended → lives; `verified→pending` via admin → raises.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement 025.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(db): verification resubmission and suspend/reinstate RPCs (BP-007)`.

### Task 7: Verification flows in the UI

**Files:**
- Create: `src/features/verification/student-actions.ts` (`"use server"`): `requestReverificationAction(prev: ActionState, formData: FormData): Promise<ActionState>`
- Modify: `src/features/verification/actions.ts`: approve and reject return `ActionState` (for `useActionState`); add `changeVerificationStatusAction(prev, formData)`
- Create: `src/features/verification/action-state.ts`: `type ActionState = { status: "idle" | "success" | "error"; message: string | null }`; `function rpcErrorToMessage(error: { code?: string; message?: string }): string` (pure)
- Create: `src/app/admin/verifications/_components/review-forms.tsx` (client; approve, reject, suspend, reinstate with inline status)
- Modify: `src/app/admin/verifications/page.tsx` (actions per status: pending → approve/reject (approve disabled when matric is null); verified → suspend; suspended → reinstate; rejected → reopen)
- Modify: `src/components/shared/verification-banner.tsx` (rejected → resubmission form with reason shown; copy matches the real flow)
- Modify: `src/app/dashboard/page.tsx:49-58,91-94` (select and pass `verification_rejection_reason`)
- Test: `src/features/verification/__tests__/action-state.test.ts`

- [ ] **Step 1: Write failing tests** for `rpcErrorToMessage`: `{code:"23505"}` → `"This matriculation number is already registered. Contact your course representative."`; a message containing `already been reviewed` → `"This profile has already been reviewed."`; a message containing `cannot review their own` → `"You cannot review your own profile."`; anything else → `"The action could not be completed. Please try again."`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement the helper, the actions and the components.
- [ ] **Step 4:** Run `npm test && npm run typecheck`. Add `e2e/verification.spec.ts`: admin rejects a pending seeded student with a reason; the student sees the reason, resubmits and sees "pending"; admin approves; the student reaches `/study-planner`. Run e2e. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(verification): resubmission, suspend/reinstate and action feedback (BP-007, BP-024 partial)`.
