# 03 — Existing Data Preservation and Migration Impact

**No data transformation has been performed.** The remote database could not be inspected (the Supabase MCP lists no projects), so row counts and actual contents are **unknown**. If migrations 014–019 never applied remotely (likely, given BP-002/003), then `quests`, `quest_submissions`, `xp_ledger`, `profile_verification_history` and `nickname` **do not exist remotely** and hold no data to migrate.

## 1. Preservation principles

1. **Additive only:** new tables plus nullable columns. No `drop`, `rename`, type change or in-place rewrite of existing values.
2. **Backfill only unambiguous mappings.** Everything else goes to a review queue (`migration_review_items` table or an admin report), and an admin decides.
3. **Expand then contract:** application code reads the new columns with a fallback to the legacy ones until the backfill is verified. `NOT NULL` is applied only in a later, separate migration after verification.
4. Run on a **branch or staging copy first**. Take a `pg_dump` (or PITR snapshot) before production. Make each backfill idempotent (`where offering_id is null`).
5. Record provenance: `source = 'legacy_backfill'` on placements, enrolments and audiences created by migration.

## 2. Record-by-record mapping

| Data | Current shape | Target | Mapping rule | Safe to auto-migrate? |
|---|---|---|---|---|
| **Departments** | free text `'Civil Engineering'` | `departments` row | Insert one row (`code 'CVE'`, confirm the official code); set `department_id` where the text matches exactly | ✅ Yes |
| **Courses** (7 seeded) | `courses` with `level='200'` | Catalogue (unchanged) + `department_id` | Exact text match | ✅ Yes |
| **Course offerings** | none | `course_offerings` | Requires knowing **which session and semester** each of the 7 courses runs in. Not stored anywhere. | ❌ **Needs admin input:** admin confirms the 2025/2026 (or current) semester per course |
| **Student profiles** | `level` (client-supplied, default `'200'`), `department` text | `student_placements` for the current session | Create a placement `status='claimed'`, `source='legacy_backfill'`, level = `profiles.level`. Never `confirmed` automatically, because the level came from untrusted metadata (BP-018). | ⚠️ Partial: claimed only; an admin confirms in bulk |
| — verified students | `verification_status='verified'` | Placement | Admin may bulk-confirm with a single audited action | ⚠️ Admin action |
| — pending, rejected, suspended | | Placement `claimed` | Unchanged status; confirmation follows the verification fix (BP-007) | ⚠️ |
| — profiles without matric | `matric_number is null` (Google sign-ups) | Placement `claimed` | Flag: insufficient identity context | ❌ Flag |
| — profiles whose level was the trigger default | Not distinguishable from an explicit '200' | | Cannot tell "chose 200" from "defaulted to 200" | ❌ **Lacks context**, so admin confirmation is required for all |
| **Course enrolments** | none | `course_enrollments` | Auto-enrol each confirmed 200-level placement into the 200-level offerings of its semester (`enrolment_type='core'`). Carry-overs are unknown. | ⚠️ After offerings and placements are confirmed |
| **Verification history** | per profile (if 015 applied) | unchanged | Identity verification is not session-scoped. Keep as is. Fix BP-001 first. | ✅ No change |
| **Lecture sessions** | `course_id`, `lecture_date` | `offering_id` | course + semester whose `[starts_on, ends_on]` contains `lecture_date` + `courses.level` | ✅ when exactly one semester matches; ❌ flag rows outside every semester range or matching more than one |
| **Study sessions** | personal, `course_id` optional | unchanged (+ optional `semester_id`) | Personal data; no audience needed. Optional semester derived by date. | ✅ No change required |
| **Announcements** `scope='all'` | no target | `department` audience | All-department | ✅ Yes (the pilot had one department) |
| `scope='department'` | no target column | `department` audience (Civil Eng.) | Single department | ✅ Yes |
| `scope='level'` | **no level stored** | `level` audience | The target level was never recorded. The pilot implies 200, but that is an assumption. | ❌ **Lacks context.** Admin confirms (default suggestion: 200). |
| `scope='course'` | `course_id` | `offering` audience | course + semester containing `published_at` | ⚠️ Auto when unambiguous, else use a `course` audience (all offerings) |
| **Quests** (if any) | no course, level or session | audiences | Never targeted | ❌ **Lacks context.** Admin assigns, with a suggested default of level 200, current session. Until then they are visible to no students (safe default). That is a behaviour change, so it needs an admin decision before cut-over. |
| **Quest submissions** | link to quest | unchanged | Follow the quest | ✅ |
| **XP ledger** | `user_id`, `created_at` | + `session_id`, `semester_id`, `level_code_at_award` | Session and semester from `created_at` date ranges; level from the placement valid then | ⚠️ Auto for session and semester; level only after placements are confirmed. Unmatched rows → null (shown in "all-time" only). |
| **Notifications** | per user, transient | unchanged | No academic context needed | ✅ No change |
| **Notification preferences, push subscriptions** | per user | unchanged | – | ✅ |
| **user_roles** | student/admin | unchanged + optional `staff_assignments` | Existing admins keep `admin` (= department admin capability) | ✅ |

## 3. Records that cannot be migrated safely without human input

1. The session and semester for each existing course (needed for offerings).
2. The actual level of every student (all are client-claimed).
3. The target level of `scope='level'` announcements.
4. The audience of existing quests.
5. Lectures whose dates fall outside the semester dates the admin defines.
6. Profiles without matric numbers.

The migration should produce a **review report** (a SQL view, `admin_migration_review`) listing these, and the admin UI should resolve them before the expanded RLS is switched on.

## 4. Cut-over sequence (non-destructive)

1. E1–E3 (structure, offerings, placements). Create the current session and semesters through the admin UI or seed **with admin-supplied dates**.
2. Run the backfills (idempotent). Generate the review report.
3. Admin resolves the review items: confirm placements, offering semesters, announcement levels and quest audiences.
4. Deploy app code that reads the new structures **with legacy fallback**. Verify on staging.
5. Enable the new audience-based RLS (E5). Old policies are replaced in the same transaction to avoid a visibility gap.
6. After one stable release, apply `NOT NULL` where appropriate (e.g. `lecture_sessions.offering_id`) in a separate migration. Legacy columns (`profiles.level`, `announcements.scope`) are **kept** as cached or descriptive values and never dropped.

## 5. Rollback

- Every migration in E1–E4 is additive, so rollback means ignoring the new columns or tables in app code. No data restore is needed.
- E5 (RLS switch) must ship with a ready-to-run reverse migration that restores the previous policies.
- Backfilled rows carry `source='legacy_backfill'` and can be deleted selectively if needed.
