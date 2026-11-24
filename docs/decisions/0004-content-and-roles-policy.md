# 0004 — Content access, roles and content policies

**Status:** PARTIALLY DECIDED (2026-11-23). Items 2–3 decided by the project owner; others OPEN.

| # | Decision | Default proposed by the audit | Answer |
|---|---|---|---|
| 1 | What pending and rejected students may read | Department-wide announcements, the timetable for their claimed level, profile, notifications | OPEN |
| 2 | Approved staff capabilities | `department_admin`, `library_manager`, `tutorial_curator` first; `level_coordinator` and `course_content_manager` later | **DECIDED:** each class is run by its **course representative** (`level_coordinator`, scoped to one level) or an administrator (`department_admin`). Reps add their level's courses and manage its timetable, announcements and quests. `library_manager`/`tutorial_curator` follow later. |
| 3 | Who holds each capability (named people) | – | **DECIDED (model):** one course representative per level, granted by a department admin; names recorded in `/admin/staff` when built. |
| 4 | Library copyright policy and attestation wording | Uploads need a copyright basis and an uploader attestation; takedown within 48 h | **PROVISIONAL (built in P8, 2026-11-24):** every resource records a copyright basis; uploaders tick "I confirm I have the right to share this file with the chosen students, and it contains no personal data."; students can report; staff take down (files deleted, audit rows kept). The 48 h response target is not enforced in software. Confirm or change. |
| 5 | Past-question approval process | Department approval required; `copyright_basis = approved_past_question` | **PROVISIONAL (built in P8):** only a department administrator can mark a resource `approved_past_question`, and a past question cannot exist without it (database rule). Confirm or change. |
| 6 | AI-generated content policy and reviewer pool | Human reviewer ≠ creator, label always visible, re-review on edit | OPEN |
| 7 | Allowed external tutorial domains | youtube.com, youtu.be, vimeo.com, ocw.mit.edu, khanacademy.org, nptel.ac.in | OPEN |
| 8 | External services: malware scanning, document conversion, YouTube Data API key, video hosting, error monitoring | Not approved by default | OPEN |
| 9 | Hosting provider | – | OPEN |

## Course-representative guardrails (decided with item 2)

- Scope: their own level only (courses, offerings, timetable, announcements, quests, placements of that level).
- Never: identity/matric verification, granting permissions, reviewing their own quest submissions, confirming their own placement.
- Assignments expire at the end of the academic session; renewal by a department admin.
- All grants, revocations and audience changes are logged. Rules are enforced in the database (RLS/RPC), not only in the UI.
