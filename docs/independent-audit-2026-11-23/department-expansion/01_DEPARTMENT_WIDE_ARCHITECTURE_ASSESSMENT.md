# 01 — Department-Wide Architecture Assessment

**Scope change received:** 2026-11-23 (supersedes the single-level product scope). This document **does not authorise implementation**.
**Mode:** read-only. No code, migrations, SQL or Storage changes were made.
**Baseline:** the findings BP-001 … BP-058 in the parent audit still apply. The expansion sits **on top of** them, and several blockers (migration syntax, missing RLS, unenforced verification) must be fixed first.

---

## 1. Can the existing architecture support the pivot?

**Yes at the platform level, no at the data-model level.**

| Layer | Fit for department-wide use | Reasoning |
|---|---|---|
| Next.js App Router, server actions, Supabase SSR | ✅ Reusable | Nothing in the framework layer is level-specific |
| Supabase Auth, profiles, verification RPC | ✅ Reusable (after BP-005/006/007 fixes) | Identity is independent of level |
| PostgreSQL + RLS + SECURITY DEFINER helpers | ✅ Reusable | The pattern (`is_admin()`, split policies) extends naturally to a `can_view_*()` helper family |
| Storage (buckets + RLS) | ⚠️ Pattern reusable, configuration not | No private document bucket is in use. `quest-evidence` is defined but unused, and migrations 014/019 don't apply (BP-002). |
| Notification pipeline | ✅ Design reusable | Targeting logic must be rewritten (currently hard-coded to "Civil Engineering" / "200") |
| **Academic data model** | ❌ **Not fit** | There is no session, semester, course-offering, placement or enrolment concept. Level is a free-standing text column copied from client-supplied sign-up metadata. |
| **Authorization model** | ❌ **Not fit** | Two global roles only, and the admin resolver is buggy. No scoped permissions. Verification is unenforced. |
| **Content visibility** | ❌ **Not fit** | Every authenticated user can read every lecture, announcement and quest. The announcement `scope` has no target columns. |

**Conclusion:** expand rather than rewrite. The pivot needs (a) new relational entities for academic structure, (b) a unified audience/visibility mechanism enforced in RLS, (c) scoped staff permissions, and (d) two new modules built on private Storage and external embeds.

## 2. Single-level assumptions found in the codebase

All of these must be removed or parameterised. None of them requires destructive data change.

| # | Location | Assumption |
|---|---|---|
| 1 | `001_initial_schema.sql:7-8, 21-22` | `profiles.level` / `courses.level` default `'200'`; department default `'Civil Engineering'` (free text) |
| 2 | `006:27-28`, `011:63-64` | `handle_new_user` defaults level `'200'` and reads level and department from **client metadata** (BP-018) |
| 3 | `src/app/register/register-form.tsx:84-85` | Registration hard-codes `department:"Civil Engineering", level:"200"` |
| 4 | `src/lib/notifications/targeting.ts:20,23` | `scope='department'` means `=== "Civil Engineering"`; `scope='level'` means `=== "200"` |
| 5 | `src/lib/notifications/delivery.ts:268-273` | Lecture reminders match `profile.level === course.level`. Carry-over students are excluded, and the reminders are broken anyway (BP-012). |
| 6 | `announcements.scope` (001:69) | Values `department`/`level` have **no target column**, so the actual level or department targeted is not recorded |
| 7 | `features/timetable/queries.ts` | All lectures for all courses are shown to every student. At department scale every student would see all five levels. |
| 8 | `features/{dashboard,study-planner}/queries.ts:getCourses()` | The whole catalogue appears in every dropdown |
| 9 | `quests` (018) | No course, level, session or semester columns. Every active quest is visible to everyone. |
| 10 | `get_leaderboard` (019) | One global ranking, with no level or session dimension |
| 11 | UI copy: `dashboard-shell.tsx:79-80`, `admin/courses/page.tsx:35,55`, `admin/page.tsx:81`, `dashboard/page.tsx:87`, `study-planner/page.tsx:34`, `login-form.tsx:109`, `register-form.tsx:118`, `verification-banner.tsx:40,91`, `announcements/page.tsx:16`, `admin-announcements-table.tsx:30`, `page.tsx:187,290,303`, `config/site.ts:7` | "200 Level" text is hard-coded in the copy |
| 12 | `seed/001_civil_engineering_courses.sql` | Catalogue contains only the 7 courses at level 200 |

## 3. Academic structure: what can and cannot be determined

The repository encodes only `level ∈ {100,200,300,400,500}` (`001:13,24`) and a single-level seed. **The real departmental calendar is not in the codebase** and must be confirmed by the department or the project owner. Working assumptions for the design (to be confirmed):

| Item | Working assumption | Confirmation needed |
|---|---|---|
| Programme length | B.Sc. Civil Engineering, 5 levels (100–500), matching the existing CHECK | Is 100-level managed by the department or faculty-wide (GET/MTH/PHY/CHM courses)? Are there direct-entry students starting at 200? Are extra years (spill-over) modelled as level "500" with carry-overs? |
| Academic session | Labelled `YYYY/YYYY` (e.g. `2025/2026`), one active at a time | Official start and end dates; strike or calendar disruptions mean dates must be editable, not derived |
| Semesters | Two per session (First, Second) | Official names, dates and examination windows. Is there a long-vacation or SIWES period (industrial training, typically 300/400-level) needing special handling? |
| Course codes | `CEE`, `GET`, `ENT` prefixes, stable across sessions | Whether a course can be offered at more than one level (it can, via carry-overs or electives) |

The model below therefore keeps sessions, semesters and levels **data-driven** (rows, not enums), so calendar changes never need a migration.

## 4. Impact on existing core features

| Feature | Required change for department scope | Depends on |
|---|---|---|
| Dashboard | Filter lectures, announcements and quests by the student's current placement and enrolments. Show the current session and semester. | Placement, enrolment, audience model |
| Timetable | Lectures attach to a **course offering** (course × semester × level), and students see the offerings they are enrolled in. Admins get level and semester filters. | `course_offerings`, `lecture_sessions.offering_id` |
| Study planner | Course dropdown limited to enrolled offerings (fall back to the full catalogue). Optional semester tagging. | Enrolment |
| Announcements | Real audience targeting (department, level(s), offering) enforced in RLS, with notification fan-out using the same rules | Audience model |
| Notifications | Targeting rewritten to query placements and enrolments in SQL. Carry-over students included. | Same |
| Quests | Audience (level, offering, semester). Leaderboard eligibility per scope. | Audience model, `xp_ledger` context |
| Leaderboard | Filter by level, session and semester; verified students only | xp context columns, placements |
| Profile | Show placement history (level by session); matric and identity verification unchanged | `student_placements` |
| Verification | Extended to **placement confirmation**: an admin or level coordinator confirms the level per session | Placements, scoped permissions |
| Admin | Session/semester management, offering management, placement management, scoped dashboards | All of the above |

## 5. Answers to the required conclusions (summary; detail in the linked docs)

1. **Can the architecture support the pivot?** Yes, platform-wise. The data model, authorization and visibility layers must be extended (§1).
2. **What must change in the data model?** Add `departments`, `academic_levels`, `academic_sessions`, `semesters`, `course_offerings`, `student_placements` and `course_enrollments`. Extend `courses`, `lecture_sessions`, `announcements`, `quests` and `xp_ledger` with nullable context columns, plus a unified audience mechanism. See `02_ACADEMIC_DATA_MODEL_AND_ERD.md`.
3. **How is 200-level data preserved?** Additive, nullable-first migrations. Backfill only where the mapping is unambiguous. Ambiguous rows are flagged for admin confirmation rather than guessed, and nothing is deleted or rewritten in place. See `03_EXISTING_DATA_PRESERVATION_AND_MIGRATION_IMPACT.md`.
4. **How should the Library be implemented?** Metadata tables, versioned file rows and a private bucket. All reads go through server-minted short-TTL signed URLs after an RLS-checked authorization query. Postgres full-text search, a copyright-basis field and a report/takedown workflow. See `04_LIBRARY_MODULE_ASSESSMENT.md`.
5. **How should Tutorials Pack be implemented?** Link and embed only: YouTube through `youtube-nocookie` by validated video ID, plus an allow-listed set of other providers. Playlists, saves and progress tables. A mandatory human academic review gate for AI-generated content, enforced by DB constraint. See `05_TUTORIALS_PACK_ASSESSMENT.md`.
6. **How should resource access be controlled?** A single audience model (department / level / offering / course × session/semester) evaluated by SECURITY DEFINER helper functions used in every RLS policy, and verification-aware. See `06_RESOURCE_ACCESS_AND_PERMISSION_MODEL.md`.
7. **What new admin permissions may be necessary?** Scoped capabilities (department admin, level coordinator, course content manager, library manager, tutorial curator) as **assignments**, not new global roles. These are proposed and need approval. See doc 06.
8. **Which migrations are required?** E0 (existing blockers) plus E1–E10. See `07_REVISED_IMPLEMENTATION_ROADMAP.md` §2.
9. **What security risks does the expansion introduce?** Cross-level leakage, Storage misconfiguration, signed-URL leakage, malicious uploads, copyright exposure, embed/CSP and privacy issues, SSRF in metadata fetching, privilege sprawl, AI misinformation and storage cost abuse. See doc 06 §6, doc 04 §5 and doc 05 §5.
10. **What is the roadmap?** A dependency-ordered plan in doc 07.
