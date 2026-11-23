# P6 Retrofit Core Features to Audiences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make lectures, announcements, quests and notifications level-, offering- and session-aware through a deny-by-default audience model enforced in RLS, migrating existing 200-level data without loss.

**Architecture:** Per-content audience tables with a shared shape plus one SQL predicate `audience_matches(...)`. Legacy rows are backfilled where the mapping is unambiguous; everything else goes to `admin_migration_review` for human resolution **before** the RLS switch (035), which ships with a rollback file. Student queries and notification targeting move to the new helpers.

**Tech Stack:** PostgreSQL/pgTAP, Next.js 16, Zod 4.

**Spec:** `department-expansion/02` §4–5, `03` (mapping table and cut-over), `06` §1–2, `07` (E4–E5).

## Global Constraints

- **Deny by default:** published content with zero audience rows is invisible to students.
- Visibility for students also requires `is_verified_student()` (P2) except for the categories decision 0004 grants to pending and rejected students (department-wide announcements and the timetable for their claimed level).
- Never guess ambiguous legacy data. Write it to `migration_review_items`.
- 035 must be applied in one transaction (drop old select policies + create new) and must have `supabase/rollback/035_audience_rls_down.sql`.
- Admins keep full visibility.

## Review Focus

- A verified level-200 student must not see a level-300 announcement, lecture or quest, even via direct PostgREST queries.
- A level-300 carry-over student enrolled in the 200-level GET209 offering must see GET209 lectures and course announcements, but not other 200-level content.
- A resource explicitly shared with levels 200 **and** 300 must be visible to both, and to no one else.
- A legacy `scope='level'` announcement must be hidden until an admin resolves its level in the review queue, and the review UI must show it.
- Lecture reminders must reach carry-over students and must not reach students who dropped the offering.

---

### Task 1: Audience tables and the matching predicate (E4 part 1)

**Files:**
- Create: `supabase/migrations/033_content_audiences.sql`
- Test: `supabase/tests/database/300_audiences.test.sql`

**Interfaces:**
- Shared shape for `announcement_audiences(announcement_id fk cascade, …)` and `quest_audiences(quest_id fk cascade, …)`: `id uuid pk`, `audience_kind text check in ('department','level','course','offering','staff_only')`, `department_id`, `level_code`, `course_id`, `offering_id`, `session_id`, `semester_id`, `created_by`, `created_at`, plus a CHECK requiring the right targets per kind (department → department_id; level → level_code; course → course_id; offering → offering_id; staff_only → all null).
- New nullable columns: `lecture_sessions.offering_id fk restrict`, `quests.offering_id`, `quests.semester_id`, `study_sessions.semester_id`, `announcements.session_id`.
- Predicate (stable, definer): `public.audience_matches(p_kind text, p_department_id uuid, p_level_code text, p_course_id uuid, p_offering_id uuid, p_session_id uuid, p_semester_id uuid) returns boolean`, evaluated for `auth.uid()` using placements (confirmed, session = coalesce(p_session_id, current)) and active enrolments (offering, or any offering of the course, filtered by semester when given).
- Convenience: `can_view_announcement(p_id uuid)`, `can_view_quest(p_id uuid)`, `can_view_lecture(p_id uuid)` (lecture: admin, or `offering_id in my_offering_ids()`, or `offering_id is null and level = my_confirmed_level()` as the legacy fallback).

- [ ] **Step 1: Write failing tests** with fixtures (levels 200 and 300 confirmed students, a carry-over enrolment, offerings): a `level 300` audience matches only the 300 student; `offering GET209@200` matches the 200 student and the carry-over 300 student; `course` matches any enrolled offering; `staff_only` matches nobody; a `session_id` qualifier for a past session doesn't match the current placement.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement 033.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(db): content audience tables and audience_matches predicate (E4)`.

### Task 2: Legacy backfill and review queue (E4 part 2)

**Files:**
- Create: `supabase/migrations/034_legacy_backfill.sql`
- Test: `supabase/tests/database/310_legacy_backfill.test.sql`

**Interfaces:**
- `migration_review_items(id, item_type text check in ('placement','offering_semester','announcement_level','quest_audience','lecture_out_of_range','profile_no_matric'), entity_id uuid, details jsonb, status text check in ('open','resolved','dismissed') default 'open', resolved_by, resolved_at, unique(item_type, entity_id))`. RLS admin only.
- Backfill rules (idempotent, `where … is null`, `source='legacy_backfill'`), exactly as in doc 03 §2:
  - each profile with no placement for the current session → `claimed` placement at `profiles.level` + review item `placement`;
  - `announcements.scope='all'` or `'department'` → a `department` audience (CVE);
  - `scope='level'` → **no audience** + review item `announcement_level` (`details: {suggested_level:"200"}`);
  - `scope='course'` → an `offering` audience from `offering_for(course_id, published_at::date, courses.level)`, else a `course` audience;
  - lectures → `offering_id = offering_for(course_id, lecture_date, courses.level)`, else review item `lecture_out_of_range`;
  - quests with no audience → review item `quest_audience`;
  - profiles without matric → review item `profile_no_matric`.
- View: `admin_migration_review` (open items joined to readable labels).

- [ ] **Step 1: Write failing tests** on fixtures reproducing each legacy shape. Assert the audience rows and review items created, and that a **second run** creates nothing new.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(db): non-destructive legacy backfill with review queue (E4)`.

### Task 3: Admin migration review UI

**Files:**
- Create: `src/features/academic/review-actions.ts`: `resolveReviewItemAction(prev, formData)`. It dispatches on `item_type`: `announcement_level` → insert a level audience; `quest_audience` → insert the chosen audience; `offering_semester` → create an offering; `lecture_out_of_range` → set `offering_id` or dismiss; `placement` → confirm via `confirm_placements`; `profile_no_matric` → dismiss. Each marks the item resolved.
- Create: `src/app/admin/academic/review/page.tsx` + `_components/review-item-form.tsx`
- Test: `src/features/academic/__tests__/review-dispatch.test.ts` (pure `planResolution(item, formValues): ResolutionPlan`, where `type ResolutionPlan = { kind: "insert_audience" | "create_offering" | "set_lecture_offering" | "confirm_placement" | "dismiss"; payload: Record<string, string> }`)

- [ ] **Step 1: Write failing tests:** `planResolution({item_type:"announcement_level",entity_id:"a"},{level_code:"200"})` deep-equals `{kind:"insert_audience",payload:{announcement_id:"a",audience_kind:"level",level_code:"200"}}`; unknown item types throw.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. Add an e2e test: an admin resolves a seeded `announcement_level` item with 200 → the item disappears and the announcement has one audience. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(admin): migration review queue`.

### Task 4: Audience picker in admin forms

**Files:**
- Create: `src/components/shared/audience-picker.tsx` (client). Props `{ name: string; levels: {code:string;label:string}[]; offerings: {id:string;label:string}[]; courses: {id:string;label:string}[]; defaultValue?: AudienceInput[] }`. It serialises a JSON array into a hidden input. Supports multiple rows (explicit cross-level sharing) and shows an inline warning "Not visible to any student" when empty.
- Create: `src/features/audiences/schema.ts`: `audienceInputSchema` (Zod discriminated union on `audience_kind`), `audienceListSchema` (min 0, max 20); `replaceAudiences(table: "announcement_audiences"|"quest_audiences", ownerColumn: string, ownerId: string, list: AudienceInput[])` (server-only; delete + insert in one RPC `replace_audiences(p_table text, p_owner uuid, p_rows jsonb)` defined in 033's follow-up file `033b_replace_audiences.sql`, with the table name validated against an allow-list inside the function)
- Modify: `src/components/shared/announcement-form.tsx`, the quest forms (P3), `src/components/shared/lecture-session-form.tsx` (lecture: offering select instead of course; course derived)
- Modify: `src/features/{announcements,quests,timetable}/actions.ts` (parse and persist audiences; lecture actions require `offering_id`)
- Test: `src/features/audiences/__tests__/schema.test.ts`; `supabase/tests/database/320_replace_audiences.test.sql`

- [ ] **Step 1: Write failing tests:** the schema rejects `{audience_kind:"level"}` without `level_code`; it accepts two level rows; `replace_audiences('profiles', …)` raises (not allow-listed).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test && supabase test db`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(admin): audience targeting for announcements, quests and lectures`.

### Task 5: Audience-aware RLS switch (E5)

**Files:**
- Create: `supabase/migrations/035_audience_rls.sql`, `supabase/rollback/035_audience_rls_down.sql`
- Test: `supabase/tests/database/330_audience_isolation.test.sql`

**Interfaces:**
- Replace `announcements_select_authenticated` with `using (is_published and published_at <= now() and (public.is_admin() or public.can_view_announcement(id)))`.
- Replace `lecture_sessions_select_authenticated` with `using (public.is_admin() or public.can_view_lecture(id))`.
- Replace `quests_select_active` with `using (public.is_admin() or (is_active and public.can_view_quest(id)))`.
- Audience tables: select for admin, or rows whose parent is visible. Writes go through the RPC only.
- Pending and rejected allowance per decision 0004 (implemented inside the `can_view_*` helpers, which check `verification_status`).

- [ ] **Step 1: Write the failing isolation matrix:** for each content type × {level 200 student, level 300 student, carry-over student, pending student, suspended student, admin}, assert the visible counts against expected values listed in the test header table. Include direct `select * from public.announcements`.
- [ ] **Step 2:** Run. Expected: FAIL (everyone sees everything).
- [ ] **Step 3:** Implement 035 and the down file. Verify the down file restores the previous policies by applying it in the test (`\i ../../rollback/035_audience_rls_down.sql`) and checking the old counts.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(db): audience- and verification-aware read policies (E5)`.

### Task 6: Student views follow the academic context

**Files:**
- Modify: `src/features/timetable/queries.ts` (rely on RLS; add an optional `offeringIds` filter and a "Show all my courses / This level" toggle)
- Modify: `src/features/study-planner/queries.ts:getCourses` → `getMyCourses()`: catalogue courses of active enrolments, falling back to all non-archived courses when the student has none
- Modify: `src/app/dashboard/page.tsx` (header shows "Level {level} · {semester}"; widgets "My quests" (top 3 visible open quests) and "My XP" (from `getUserXpSummary`); spec 5.2)
- Modify: `src/app/announcements/page.tsx` (audience badge: "Level 300", "GET209", "Department")
- Test: `e2e/level-isolation.spec.ts`

- [ ] **Step 1: Write the failing e2e test:** a level-200 student sees the "GET209 lecture" and not the "CEE301 lecture"; the dashboard shows "Level 200"; a level-300 student sees the opposite.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(student): level- and enrolment-scoped dashboard, timetable and planner`.

### Task 7: Notification targeting in SQL

**Files:**
- Create: `supabase/migrations/035b_notification_targeting.sql`: service-role-only functions `announcement_recipients(p_announcement_id uuid) returns setof uuid` (verified students matching any audience, with `announcement_notifications_enabled`) and `lecture_reminder_candidates(p_from timestamptz, p_to timestamptz) returns table(user_id uuid, lecture_id uuid, course_code text, starts_at timestamptz, reminder_minutes smallint, push_enabled bool)` (active enrolments in the lecture's offering, with `lecture_reminders_enabled`)
- Modify: `src/lib/notifications/delivery.ts` (use the RPCs; delete `loadTargetingData` and the in-memory filters)
- Delete: `src/lib/notifications/targeting.ts` and its tests (replaced by DB tests)
- Test: `supabase/tests/database/340_notification_targeting.test.sql`

- [ ] **Step 1: Write failing tests:** a level-300 announcement recipient list = only the verified level-300 students with preference enabled; lecture candidates include the carry-over student and exclude a dropped enrolment.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `supabase test db && npm test`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(notifications): audience-based targeting in SQL`.

### Task 8: Recurring lecture schedules (spec 5.4 gap)

**Files:**
- Create: `src/features/timetable/series.ts`: `expandWeeklySeries(input: { offeringSemester: { starts_on: string; ends_on: string }; weekdays: number[]; startTime: string; endTime: string; skipDates: string[] }): string[]` (returns `lecture_date` values in Lagos calendar terms, using `addDays` and `getDayOfWeek` from `src/lib/dates.ts`; at most 120 dates)
- Modify: `src/features/timetable/actions.ts`: `createLectureSeriesAction(prev, formData)` (offering, weekdays, times, venue, lecturer, skip dates). It runs the existing conflict checks per date, inserts in one batch, and returns `{ created, skipped: Array<{ date: string; reason: string }> }`. Each row gets `series_id` (new nullable column `lecture_sessions.series_id uuid`, added in `033_content_audiences.sql`).
- Modify: `src/components/shared/lecture-session-form.tsx` (a "Repeat weekly this semester" option); `admin-sessions-table.tsx` ("Cancel all future sessions in this series")
- Test: `src/features/timetable/__tests__/series.test.ts`

- [ ] **Step 1: Write failing tests:** a Mon+Wed series over `2026-11-02`…`2026-11-15` with skip `2026-11-04` → `["2026-11-02","2026-11-09","2026-11-11"]`; an empty weekdays list → `[]`; a 2-year range is capped at 120 dates.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. Add an e2e test: an admin creates a weekly GET209 series → the timetable for 3 consecutive weeks shows the lecture; one conflicting date is reported as skipped. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(timetable): weekly lecture series per offering`.
