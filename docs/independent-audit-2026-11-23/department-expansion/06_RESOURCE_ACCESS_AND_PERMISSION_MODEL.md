# 06 — Resource Visibility, Access Control and Revised Administrator Permission Model

## 1. Visibility rules (students)

A student **S** can view content item **C** only if all of the following hold:

1. S is authenticated and **verified** (`is_verified_student()`). Pending and rejected students get only the read-only categories approved for them (proposed: department-wide announcements and timetable). Suspended students get nothing (fixes parent BP-005).
2. C is `published` (and not archived or removed), and `published_at <= now()`.
3. At least one audience row of C matches S:

| Audience kind | Matches when |
|---|---|
| `department` | S has a **confirmed** placement in that department for the audience's session (or the current session if the audience has no session) |
| `level` | S's confirmed placement level for the referenced or current session equals `level_code` |
| `course` | S has an active enrolment in any offering of `course_id` |
| `offering` | S has an active enrolment in `offering_id` |
| `session` / `semester` qualifiers | Additionally restrict the above to the given session or semester |
| `staff_only` | Never matches a student |

4. Content with **no audience rows is invisible** to students (deny by default).

**Cross-level sharing** is therefore always an explicit extra audience row, created by staff with permission for the target level. It is never a side effect of missing filters. Every audience change is logged (`audience_change_log`).

**Defaults per module:** Library and Tutorials default to the uploader's scope (offering or level). Announcements require an explicit audience choice. Quests default to an offering.

## 2. Where enforcement happens

| Layer | Responsibility |
|---|---|
| **RLS (authoritative)** | `select` policies call `can_view_<module>(id)` → `audience_matches(...)`. Write policies call `has_capability(...)`. |
| Server actions and routes | Same helpers via `rpc()` or user-context queries for defence in depth. Minting signed URLs (Library) **always** happens after a user-context, RLS-checked read. |
| Middleware / layouts | Coarse gating (authenticated, verification state, admin area). Not relied on for data access. |
| UI | Default filters only (my level, my semester). Never treated as authorisation. |

Performance: helpers are `stable` SECURITY DEFINER functions with `(select auth.uid())`. Indexes on placements, enrolments and audience targets. Expected cost is negligible at departmental scale (~1,000 students).

## 3. Is the current administrator model sufficient?

**No.** Today there is a single global `admin` role (`user_roles`). Every admin can do everything, and resolution is buggy for multi-role users (parent BP-006). For department-wide content this means either (a) a few admins become a bottleneck for five levels of content, or (b) many people (including student course reps) receive full admin rights, including verification decisions and XP awarding. That is **excessive privilege**.

## 4. Proposed scoped capabilities (proposed only; not approved)

Implement as **assignments** in a `staff_assignments` table (`user_id`, `capability`, scope columns, `granted_by`, `granted_at`, `expires_at`, `revoked_at`, `reason`), checked by `has_capability(cap, level_code, course_id, offering_id)`. The existing `admin` role maps to **department_admin**. No new rows in `user_roles` are needed.

| Capability | Scope | Can | Cannot |
|---|---|---|---|
| **Department administrator** | Department | Everything below; manage sessions, semesters, offerings and placements; grant or revoke assignments; verification decisions | Grant themselves capabilities (needs a second department admin); review their own submissions |
| **Level coordinator** | One level (+ session) | Confirm placements for that level; level announcements; level quests; manage audiences within the level; view level reports | Verification of identity (matric); cross-level audiences; XP grants outside the quest RPC |
| **Course content manager** | Course or offering | Lectures, course announcements, Library and Tutorials for that course; review AI tutorials for that course | Level- or department-wide audiences; placements |
| **Library manager** | Department or level | Upload, edit, publish, archive and remove Library resources; handle Library reports and takedowns | Tutorials, quests, placements, verification |
| **Tutorial curator** | Department or level | Add tutorials, curate official playlists, review AI content (not their own), handle tutorial reports | Library files, placements, verification |

### Security implications (must be accepted before implementation)

| Implication | Mitigation |
|---|---|
| Privilege escalation via grant management | Only department admins grant. No self-grant (DB check `user_id <> granted_by`). Granting department_admin requires a second admin (two-person rule implemented as a pending-grant approval). Every grant and revoke is logged immutably. |
| Student course reps with staff powers | Capabilities are scoped and expire with the session (`expires_at` = session end). Separation of duties: cannot confirm their own placement, review their own submissions or approve their own AI tutorial. |
| RLS complexity bugs | Single helper family; pgTAP matrix tests per capability × scope × table; Supabase advisor in CI |
| Stale access after a role ends | Automatic expiry; a scheduled job flags assignments past session end |
| Audit | `staff_assignment_events`, `audience_change_log`, review events, report resolutions |

**Recommendation:** Phase 1 ships only **department_admin** (= current admin) plus **library_manager** and **tutorial_curator** at department scope. Level coordinator and course content manager follow after RLS tests prove the scoping. **Explicit approval from the project owner is required** before any of these capabilities is introduced.

## 5. Capability × table write matrix (target)

| Table | dept_admin | level_coord | course_mgr | library_mgr | tutorial_curator | student |
|---|---|---|---|---|---|---|
| sessions, semesters, offerings | CRUD | R | R | R | R | R (current) |
| placements | CRUD | confirm (own level) | – | – | – | read own |
| enrolments | CRUD | CRUD (own level) | R (own offering) | – | – | read own |
| lecture_sessions | CRUD | CRUD (level offerings) | CRUD (own offering) | – | – | read (audience) |
| announcements + audiences | CRUD | CRUD (level) | CRUD (offering) | – | – | read (audience) |
| quests + audiences | CRUD | CRUD (level) | CRUD (offering) | – | – | read (audience) |
| quest review / XP | review | review (level) | review (offering) | – | – | – |
| library_* | CRUD | – | CRUD (own course) | CRUD (scope) | – | read, bookmark, report |
| tutorials_* | CRUD | – | CRUD (own course) | – | CRUD (scope), review AI | read, save, progress, playlists (own), report |
| verification (identity) | decide | – | – | – | – | read own |
| staff_assignments | grant/revoke | – | – | – | – | – |

## 6. Security risks introduced by the expansion (consolidated)

| # | Risk | Severity if unmitigated | Primary control |
|---|---|---|---|
| R1 | Cross-level data leakage through unscoped queries or missing audience checks | High | Deny-by-default audiences in RLS; tests |
| R2 | Library files exposed publicly (bucket misconfiguration) | High | Private bucket; no authenticated storage policies; CI assertion |
| R3 | Signed URL sharing outside the platform | Medium | Short TTL; access log; per-request minting |
| R4 | Malicious uploads (macros, PDF JS, polyglots, SVG/HTML) | High | Allow-list, magic bytes, no macro formats, scanning (external) |
| R5 | Copyright infringement / takedown liability | High (legal) | Copyright basis, attestation, reports, takedown SLA, non-public audiences |
| R6 | Embed abuse, clickjacking, third-party tracking | Medium | ID-only embeds, CSP, `youtube-nocookie` |
| R7 | SSRF from metadata fetching | Medium | Fixed provider endpoints |
| R8 | Privilege sprawl (many admins / course reps) | High | Scoped, expiring capabilities; separation of duties |
| R9 | AI misinformation presented as authoritative | Medium | Review gate, labels, re-review, reports |
| R10 | Placement spoofing (claiming another level for access) | Medium | Placements confirmed by staff; client metadata ignored (fixes BP-018) |
| R11 | Storage cost or quota exhaustion | Medium | Size limits, staff-only upload, de-duplication, quotas |
| R12 | Privacy of learning analytics (progress, downloads) | Medium | Owner-only RLS; aggregate staff views; privacy notice |
| R13 | Search enumeration bypassing RLS | Medium | SECURITY INVOKER search; no definer search functions |
| R14 | Existing unfixed defects amplified at 5× user scale (BP-001, BP-005, BP-006) | Critical | Fix before expansion (Roadmap Phase E0) |
