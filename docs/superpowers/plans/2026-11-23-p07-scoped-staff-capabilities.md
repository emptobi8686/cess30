# P7 Scoped Staff Capabilities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace "admin can do everything" with scoped, expiring, audited capability assignments for department administration, level coordination, course content, Library and Tutorials.

**Architecture:** `staff_assignments` rows checked by `has_capability(cap, level, course, offering)`. Existing `user_roles.admin` maps to `department_admin` (implicitly holds every capability). Grants go through RPCs with no-self-grant and a two-person rule for `department_admin`. Write policies switch from `is_admin()` to `has_capability(...)`.

**Tech Stack:** PostgreSQL/pgTAP, Next.js 16.

**Spec:** `department-expansion/06_RESOURCE_ACCESS_AND_PERMISSION_MODEL.md` §3–5.

## Global Constraints

- **Gate 🔐:** `docs/decisions/0004-content-and-roles-policy.md` must approve the capability set. If only a subset is approved, implement only that subset. The recommended first release is `department_admin`, `library_manager` and `tutorial_curator` at department scope.
- Capabilities: `department_admin`, `level_coordinator`, `course_content_manager`, `library_manager`, `tutorial_curator`. No other values.
- Every assignment expires (`expires_at` defaults to the current session's `ends_on`, except `department_admin`, which may be null).
- Separation of duties: nobody can grant to themselves, confirm their own placement, review their own quest submission or approve their own AI tutorial.

## Review Focus

- A course content manager for GET209 must not be able to create a **level-wide** announcement or a level-300 audience row.
- A revoked or expired assignment must stop working immediately, with no app cache.
- A level coordinator who is also a student must not confirm their own placement.
- A single department admin must not be able to create a second department admin without approval from another department admin.
- Existing admins must keep working with zero assignments after the migration (backward compatibility).

---

### Task 1: Assignments, events and `has_capability`

**Files:**
- Create: `supabase/migrations/036_staff_capabilities.sql`
- Test: `supabase/tests/database/400_capabilities.test.sql`

**Interfaces:**
- `staff_assignments(id, user_id fk, capability text check in (…5 values), level_code fk null, course_id fk null, offering_id fk null, granted_by uuid not null, granted_at, expires_at timestamptz null, revoked_at, revoked_by, reason text not null check (length(reason) >= 8), status text check in ('pending_approval','active','revoked') default 'active', approved_by uuid null, check (user_id <> granted_by))`. Scope CHECK: `level_coordinator` requires `level_code`; `course_content_manager` requires `course_id` or `offering_id`; others allow department scope (all null) or `level_code`.
- `staff_assignment_events(id, assignment_id, action text check in ('granted','approved','revoked','expired'), actor uuid, at, details jsonb)`, append-only (no update or delete grants).
- `public.has_capability(p_cap text, p_level_code text default null, p_course_id uuid default null, p_offering_id uuid default null) returns boolean` (stable, definer). True if `is_admin()`. Otherwise true if an `active`, unrevoked, unexpired assignment for `auth.uid()` with that capability covers the scope: department scope covers all; level scope covers the same level, or an offering or course at that level; course scope covers its offerings.
- `public.user_has_capability(p_user uuid, p_cap text, p_level_code text default null, p_course_id uuid default null, p_offering_id uuid default null) returns boolean` (stable, definer, **not** granted to `authenticated`; used by triggers such as P9's AI review gate). `has_capability(...)` is `user_has_capability(auth.uid(), ...)`. The admin check inside it uses `exists (select 1 from user_roles where user_id = p_user and role = 'admin')`.
- RPCs: `grant_capability(p_user uuid, p_cap text, p_level text, p_course uuid, p_offering uuid, p_expires timestamptz, p_reason text) returns uuid` (caller must be `department_admin`; `department_admin` grants are created as `pending_approval`); `approve_capability(p_id uuid)` (a different department admin); `revoke_capability(p_id uuid, p_reason text)`.
- RLS: select own assignments and the department admin's; no direct writes.

- [ ] **Step 1: Write failing tests:** self-grant → raises; a `course_content_manager` for GET209 has the capability for GET209 offerings and not for CEE301; expired → false; revoked → false; a `department_admin` grant is pending until a second admin approves; an admin with no assignments → `has_capability` true; events are written for grant, approve and revoke.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(db): scoped staff capabilities with audit and two-person rule (E6)`.

### Task 2: Capability-scoped write policies

**Files:**
- Create: `supabase/migrations/036b_capability_write_policies.sql`, `supabase/rollback/036b_capability_write_policies_down.sql`
- Test: `supabase/tests/database/410_capability_writes.test.sql`

**Interfaces (exact policy predicates):**
- `lecture_sessions` insert, update, delete: `has_capability('course_content_manager', null, null, offering_id) or has_capability('level_coordinator', (select level_code from course_offerings where id = offering_id))`
- `announcement_audiences` / `quest_audiences` writes (through `replace_audiences`): every row must satisfy `audience_row_allowed(kind, level_code, course_id, offering_id)`: department or staff_only → `department_admin`; level → `level_coordinator` for that level; course or offering → `course_content_manager` for that course or offering, or the level coordinator of its level
- `announcements` and `quests` insert, update and delete: author is the caller, and `has_capability` for at least one of the item's audiences (checked in `replace_audiences` and by trigger at publish time)
- Quest review: `review_quest_submission` additionally requires `has_capability('course_content_manager', …)` or `level_coordinator` for the quest's audience, and `student_id <> auth.uid()` (kept)
- `confirm_placements`: `level_coordinator` for each placement's level (plus not own)

- [ ] **Step 1: Write the failing matrix tests** (capability × action × scope), including every Review Focus line.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement and test the down file as in P6 Task 5.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(db): capability-scoped write policies`.

### Task 3: App guards and staff UI

**Files:**
- Modify: `src/lib/auth/guards.ts`: `requireCapability(cap: Capability, scope?: { levelCode?: string; courseId?: string; offeringId?: string }): Promise<AccessContext>` (calls `rpc("has_capability")`); `type Capability = "department_admin" | "level_coordinator" | "course_content_manager" | "library_manager" | "tutorial_curator"`
- Modify: `src/lib/auth/access.ts`: `AccessContext.capabilities: Array<{ capability: Capability; levelCode: string | null; courseId: string | null; offeringId: string | null }>` (for nav rendering only, never for authorization)
- Modify: `middleware.ts`/`routes.ts`: `/admin` is reachable by any active assignment holder; each admin page calls its own `requireCapability`
- Create: `src/features/staff/{actions,queries}.ts`, `src/app/admin/staff/page.tsx` (list, grant, approve pending, revoke; department admins only)
- Modify: `src/components/shared/admin-shell.tsx` (nav items filtered by capabilities)
- Test: `src/lib/auth/__tests__/routes.test.ts` (extend: a `library_manager` can reach `/admin/library` but `routeDecision` for `/admin/staff` with no department_admin → redirect)

- [ ] **Step 1: Write failing tests** for the extended route decisions.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. Add an e2e test: department admin A grants `tutorial_curator` to user T → T sees only "Tutorials" in the admin nav; A grants `department_admin` to B → shown as "Pending approval"; admin C approves → active. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(admin): staff capability management and scoped admin navigation`.
