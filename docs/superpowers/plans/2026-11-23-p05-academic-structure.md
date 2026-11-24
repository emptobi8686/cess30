# P5 Academic Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce departments, levels, academic sessions, semesters, course offerings, student placements and course enrolments (with admin tools), so BLUEPRINT can represent every Civil Engineering level without hard-coding 200-level.

**Architecture:** Three additive migrations (030–032) create reference and relationship tables plus SECURITY DEFINER context helpers. Existing tables receive only nullable columns. Admin UIs live under `/admin/academic/*`. Registration stops sending level; students *request* a placement and staff confirm it.

**Tech Stack:** PostgreSQL/pgTAP, Next.js 16 server actions, Zod 4.

**Spec:** `department-expansion/02_ACADEMIC_DATA_MODEL_AND_ERD.md`, `03_EXISTING_DATA_PRESERVATION_AND_MIGRATION_IMPACT.md`, `07_REVISED_IMPLEMENTATION_ROADMAP.md` (E1–E3); decision `docs/decisions/0003-academic-calendar.md`.

## Global Constraints

- **Gate 🔐:** `0003-academic-calendar.md` must have no `OPEN` items for the level range and the current session and semester dates.
- Levels, sessions and semesters are data (rows), never enums. Level codes stay text (`'100'`…`'500'`) for compatibility with `profiles.level` and `courses.level`.
- Additive only: no drop, rename or type change of existing columns. `profiles.level` remains as a cached "current level" value.
- Exactly one current session and one current semester (partial unique indexes).
- Placements grant level-scoped access only when `status = 'confirmed'`.

## Review Focus

- Making a new session "current" while another is current must succeed atomically (the old one is un-set), not fail on the unique index or leave two current.
- A semester whose dates fall outside its session must be rejected.
- A student who claims level 400 must not get level-400 access until staff confirm it.
- Auto-enrolment run twice must not create duplicate enrolments.
- A course offered to two levels in the same semester must produce two offerings, both enrollable.

---

### Task 1: Departments, levels, sessions, semesters (E1)

**Files:**
- Create: `supabase/migrations/030_academic_structure.sql`
- Test: `supabase/tests/database/200_academic_structure.test.sql`

**Interfaces:**
- Tables: `departments(id uuid pk, code text unique, name text unique, created_at)`. Seed one row `('CVE','Civil Engineering')`, with the code from decision 0003. `academic_levels(code text pk check (code ~ '^[1-9]00$'), ordinal smallint unique, label text)`, seeded with the 0003 levels. `academic_sessions(id, label text unique check (label ~ '^\d{4}/\d{4}$'), starts_on date, ends_on date, is_current bool default false, check (starts_on < ends_on))`. `semesters(id, session_id fk restrict, number smallint check (number in (1,2,3)), label text, starts_on, ends_on, is_current bool default false, unique(session_id, number))`.
- Partial unique indexes: `academic_sessions(is_current) where is_current`, `semesters(is_current) where is_current`.
- Trigger `semesters_within_session` (raise `23514` when the dates fall outside the parent session).
- RPCs (definer, admin only): `set_current_session(p_session_id uuid) returns void`, `set_current_semester(p_semester_id uuid) returns void` (un-sets the others in one statement; the semester's session must be current).
- Helpers (stable, definer, granted to `authenticated`): `current_session_id() returns uuid`, `current_semester_id() returns uuid`, `semester_for_date(p_date date) returns uuid` (null when no semester or more than one matches).
- RLS: select for `authenticated`; writes admin only.
- Add `profiles.department_id uuid references departments`, `courses.department_id uuid references departments`; backfill both where `department = 'Civil Engineering'`.

- [ ] **Step 1: Write failing tests:** a semester outside its session → `23514`; `set_current_session` swaps the current flag (count of current = 1); a student cannot insert a session → `42501`; `semester_for_date` returns the right id and null on a gap; the profile and course `department_id` backfill is non-null for the Civil Engineering rows.
- [ ] **Step 2:** Run `supabase test db`. Expected: FAIL.
- [ ] **Step 3:** Implement 030.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(db): departments, levels, sessions, semesters (E1)`.

### Task 2: Course offerings (E2)

**Files:**
- Create: `supabase/migrations/031_course_offerings.sql`
- Test: `supabase/tests/database/210_course_offerings.test.sql`

**Interfaces:**
- `course_offerings(id uuid pk, course_id fk restrict, semester_id fk restrict, level_code fk academic_levels, department_id fk, status text check in ('planned','active','completed','cancelled') default 'planned', created_by uuid, created_at, unique(course_id, semester_id, level_code))`.
- Index `(semester_id, level_code)`.
- RLS: select authenticated; writes admin (P7 widens this to capabilities).
- Helper: `offering_for(p_course_id uuid, p_date date, p_level_code text) returns uuid` (stable): the offering whose semester contains the date, or null.

- [ ] **Step 1: Write failing tests:** a duplicate (course, semester, level) → `23505`; the same course at levels 200 and 300 in one semester → 2 rows; deleting a semester with offerings → `23503`; `offering_for` resolves.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(db): course offerings (E2)`.

### Task 3: Placements, enrolments and access context (E3)

**Files:**
- Create: `supabase/migrations/032_placements_enrollments.sql`
- Test: `supabase/tests/database/220_placements.test.sql`

**Interfaces:**
- `student_placements(id, student_id fk profiles cascade, session_id fk restrict, level_code fk, department_id fk, status text check in ('claimed','confirmed','rejected') default 'claimed', source text check in ('student_request','admin','legacy_backfill'), confirmed_by uuid, confirmed_at timestamptz, note text, created_at, unique(student_id, session_id))`.
- `course_enrollments(id, student_id fk cascade, offering_id fk restrict, enrolment_type text check in ('core','carryover','elective','audit'), status text check in ('active','dropped','completed') default 'active', source text, created_by uuid, created_at, unique(student_id, offering_id))`.
- RPCs:
  - `request_placement(p_level_code text) returns uuid`: a student, for the current session; upserts `claimed` only while there is no `confirmed` row.
  - `confirm_placements(p_placement_ids uuid[], p_status text, p_note text) returns int`: admin; not own; sets `confirmed_by`/`at`; updates `profiles.level` to the level when confirmed (sets `blueprint.verification_rpc`-style flag `blueprint.placement_rpc`, which the P1 trigger accepts for `level` changes).
  - `enroll_level_core(p_semester_id uuid, p_level_code text) returns int`: admin; enrols every confirmed placement at that level into all non-cancelled offerings of that semester and level; `on conflict do nothing`; returns the inserted count.
  - `enroll_student(p_student_id uuid, p_offering_id uuid, p_type text) returns uuid`: admin; for carry-overs and electives.
- Helpers (stable, definer): `my_access_context() returns table(is_admin bool, verification_status text, department_id uuid, level_code text, session_id uuid, placement_status text)`, `my_offering_ids() returns setof uuid` (active enrolments), `my_confirmed_level(p_session_id uuid default null) returns text`.
- Trigger change: extend `prevent_profile_identity_changes` so `level` may change only under `blueprint.placement_rpc = 'on'`.
- RLS: a student selects own placements and enrolments; admin all; no direct student writes (RPC only).

- [ ] **Step 1: Write failing tests:** a student `request_placement('400')` creates `claimed`; `my_confirmed_level()` is null; an admin confirms → `my_confirmed_level()='400'` and `profiles.level='400'`; a student confirming own → raises; `enroll_level_core` twice → second returns 0; a student inserting directly into `course_enrollments` → `42501`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(db): placements, enrolments and access-context helpers (E3)`.

### Task 4: Admin sessions and semesters UI

**Files:**
- Create: `src/features/academic/{validation,queries,actions}.ts`: `sessionSchema` (`label` `^\d{4}/\d{4}$` where the second year = first+1; `starts_on < ends_on`), `semesterSchema` (number 1–3, label 3–40, dates); actions `createSessionAction`, `updateSessionAction`, `setCurrentSessionAction`, `createSemesterAction`, `updateSemesterAction`, `setCurrentSemesterAction` (all `requireAdmin`, `ActionState`, `toUserError`)
- Create: `src/app/admin/academic/page.tsx` (overview), `src/app/admin/academic/sessions/page.tsx` + `_components/*`
- Modify: `src/components/shared/admin-shell.tsx` (nav item "Academic")
- Test: `src/features/academic/__tests__/validation.test.ts`

- [ ] **Step 1: Write failing tests:** `sessionSchema` accepts `2025/2026` and rejects `2025/2027`; `semesterSchema` rejects number 4.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. Add an e2e test: an admin creates 2026/2027 with two semesters and makes it current; the overview shows "Current: 2026/2027 · First Semester". Expected: PASS.
- [ ] **Step 5:** Commit: `feat(admin): manage academic sessions and semesters`.

### Task 5: Admin course offerings UI

**Files:**
- Modify: `src/features/academic/{queries,actions}.ts`: `getOfferings({ semesterId, levelCode })`, `createOfferingAction`, `updateOfferingStatusAction`, `bulkCreateOfferingsAction(semesterId, levelCode, courseIds[])`
- Create: `src/app/admin/academic/offerings/page.tsx` + `_components/*` (filter by semester and level; bulk "offer these courses to level X this semester")
- Test: `e2e/offerings.spec.ts`

- [ ] **Step 1: Write the failing e2e test:** an admin offers the 7 seeded courses to level 200 for the current first semester → the table shows 7 rows; a repeat bulk action shows "0 new offerings (7 already existed)".
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(admin): manage course offerings`.

### Task 6: Placement requests and confirmation

**Files:**
- Modify: `src/app/register/register-form.tsx:81-86` (stop sending `department`/`level` metadata)
- Create: `src/features/academic/placement-actions.ts`: `requestPlacementAction(prev, formData)` (student, `requireStudentAccess("read")`), `confirmPlacementsAction(prev, formData)` (admin; ids from checkboxes; status confirmed or rejected)
- Modify: `src/app/settings/profile/_components/profile-settings-client.tsx` (a "Level for {session}" section: current claimed or confirmed placement, plus a request form)
- Modify: `src/components/shared/verification-banner.tsx` (when verified but with no confirmed placement: "Select your level for {session}")
- Create: `src/app/admin/academic/placements/page.tsx` (claimed queue, filter by level, bulk confirm or reject)
- Test: `e2e/placements.spec.ts`

- [ ] **Step 1: Write the failing e2e test:** a verified student requests level 300 → sees "Awaiting confirmation"; an admin bulk-confirms → the student sees "Level 300 · 2026/2027".
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(academic): student placement requests and admin confirmation`.

### Task 7: Enrolments

**Files:**
- Modify: `src/features/academic/actions.ts`: `enrollLevelCoreAction(prev, formData)`, `enrollStudentAction(prev, formData)`, `dropEnrollmentAction(prev, formData)`
- Create: `src/app/admin/academic/enrollments/page.tsx` (per offering: enrolled students; "Enrol all confirmed level-X students"; add a carry-over student by matric search using `buildVerificationSearchFilter` from P3)
- Create: `src/features/academic/context.ts`: `getAcademicContext(): Promise<{ sessionLabel: string | null; semesterLabel: string | null; levelCode: string | null; placementStatus: "none"|"claimed"|"confirmed"|"rejected"; offeringIds: string[] }>` (wraps `my_access_context` and `my_offering_ids`)
- Test: `src/features/academic/__tests__/context.test.ts` (pure `toAcademicContext(row, offeringRows)` mapper)

- [ ] **Step 1: Write failing tests:** the mapper returns `placementStatus:"none"` for a null row; it maps the offering ids.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. Add an e2e test: an admin enrols level 200 → the enrolment count is 1 for a seeded confirmed student; adds a level-300 carry-over student to GET209 → appears with type "carryover". Expected: PASS.
- [ ] **Step 5:** Commit: `feat(academic): enrolment management and academic context`.

### Task 8: Remove hard-coded 200-level copy

**Files:**
- Modify: every location listed in `department-expansion/01_DEPARTMENT_WIDE_ARCHITECTURE_ASSESSMENT.md` §2 row 11, plus `src/lib/notifications/targeting.ts` constants (temporarily keep the logic; P6 rewrites it) and `src/features/dashboard/queries.ts` docblock
- Modify: `src/components/shared/dashboard-shell.tsx:77-81` (sidebar card reads `getAcademicContext()` values passed as props: "Level {level} · {session}" or "Level not set")
- Modify: `src/config/site.ts` (`foundation` removed; description "for Civil Engineering students at the University of Lagos")
- Test: `src/lib/__tests__/no-hardcoded-level.test.ts` (scans `src/**/*.tsx` and `src/**/*.ts`, excluding tests, for `/200[- ]?[Ll]evel|"200 Level"/`, and expects 0 matches)

- [ ] **Step 1:** Write the test. Run. Expected: FAIL (~15 matches).
- [ ] **Step 2:** Replace the copy with context-driven or neutral text.
- [ ] **Step 3:** Run `npm test`. Expected: PASS.
- [ ] **Step 4:** Commit: `refactor(ui): remove hard-coded 200-level assumptions from copy`.
