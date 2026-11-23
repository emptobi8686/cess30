# BLUEPRINT — Authorization and RLS Audit

**Audit date:** 2026-11-23
**Important:** every RLS statement here comes from **static reading of local migrations 001–019** as if they all applied. They currently do **not** apply (BP-002/BP-003). **Live RLS enforcement has not been verified.** The remote project could not be reached (the Supabase MCP lists no projects).

---

## 1. Layered authorization: what is actually checked

| Layer | Session | Admin role | Verification state | Evidence |
|---|---|---|---|---|
| Middleware | Yes, `getUser()` on matched paths | Yes for `/admin/*` (`eq role admin`, which handles multiple roles correctly) | **No** | `middleware.ts:58-77` |
| Admin layout | Yes, `requireUserSession()` | Yes via `getCurrentUserRole()`, **broken for multi-role** (BP-006) | No | `app/admin/layout.tsx:10-21` |
| Student pages | Yes, `requireUserSession()` per page | n/a | **No** | `app/*/page.tsx` |
| Server actions (admin) | Yes | Yes via `requireAdminSession()`, duplicated in 4 files, affected by BP-006 | No | `features/{timetable,announcements,quests,verification}/actions.ts` |
| Server actions (student) | Yes | n/a | **No** | `features/study-planner/actions.ts`, `features/quests/actions.ts:148`, `app/actions/profile.ts` |
| API routes | Yes, `getUser()` plus same-origin check for mutations | n/a | No | `app/api/push/subscriptions/*` |
| Cron route | Bearer `CRON_SECRET`, constant-time comparison | n/a | n/a | `app/api/cron/notifications/route.ts:9-17` |
| Database RLS | Yes (`auth.uid()`) | Yes (`is_admin()`) | **No** | migrations |

**Conclusion:** session and admin checks are present at several layers. The **verification-state model in spec Part 3.3 is not implemented at any layer (BP-005).** Navigation hiding does not exist either: every nav item is shown to every user.

### Verification-state matrix (spec vs implementation)

| State | Spec | Implemented behaviour |
|---|---|---|
| Pending | Read-only timetable and announcements; profile; verification | **Full student functionality** |
| Rejected | Read-only academic access plus a recovery and resubmission workflow, with history preserved | Full functionality. The banner tells the user to "update your matriculation number … and submit it again", but the DB trigger forbids changing matric and no resubmission path exists (**BP-007, deadlock**). The rejection reason is not passed to the dashboard banner (`dashboard/page.tsx:91-94`). |
| Suspended | No academic access; only access-denied, logout and support | **Full functionality** plus a red banner. Logout is broken (BP-010). No admin UI can set suspended after the first review. |
| Verified | Full | Full |
| Admin (+student) | Admin features; student access kept | Admin features **lost** if a student role row also exists (BP-006) |

---

## 2. Per-table RLS matrix (final local state, if 001–019 applied)

Notation: **A** = `is_admin()`, **Own** = row belongs to `auth.uid()`, **Auth** = any authenticated user. A grant column of "–" means no grant to `authenticated`.

| Table | RLS | SELECT | INSERT | UPDATE | DELETE | Notes |
|---|---|---|---|---|---|---|
| `profiles` | Yes | Own, A | Own (grant from 014) | Own (column guard trigger) | grant only, no policy, so denied | Trigger exempts admins (BP-016). `full_name` and `avatar_url` are freely editable (BP-017). Self-insert with any status if no row exists (BP-046). |
| `courses` | Yes | Auth | A (FOR ALL) | A | A | Delete cascades to lectures (DB audit §3) |
| `user_roles` | Yes | Own, A | A and `assigned_by = auth.uid()`, **but table grants revoked by 010** (only SELECT) | same | same | Admin role management via the API is therefore impossible, which is safe; provisioning is SQL-only. OK. |
| `lecture_sessions` | Yes | Auth (includes cancelled rows) | A and `created_by = uid` | A | A | Audit-column trigger (009). Good. |
| `study_sessions` | Yes | Own | Own | Own | Own | Correct isolation. Also tested by the app filter `.eq("user_id")`. |
| `announcements` | Yes | Auth and published (007), plus A for all | A and `created_by = uid` | A | A | **Scope is not used for reads** (BP-019) |
| `notifications` | Yes | Own | – (service role only) | Own, columns `is_read`/`read_at` only (column grant) | Own | Good design. Verification notifications therefore fail with the user client (BP-023). |
| `notification_preferences` | Yes | Own | – | – | – | Writes go through the service role in server actions. OK. |
| `push_subscriptions` | Yes | – | – | – | – | Service role only. Good. |
| `profile_verification_history` | **NO** | (policies Own, A are ignored) | **default privileges** | **default privileges** | **default privileges** | **BP-001 Critical** |
| `matric_verification_history` (view) | n/a (owner rights) | **default privileges, bypasses RLS** | – | – | – | BP-001 |
| `quests` | Yes | `is_active` for Auth; A for all | A | A | A (FOR ALL) | Students can see active but overdue quests. Fine. |
| `quest_submissions` | Yes | Own, A | Own (**any status**, BP-014), A | A | none | No student cancel (spec 5.8) |
| `xp_ledger` | Yes | Own, A | – (RPC) | – | – | Append-only. Good. `award_xp` abuse (BP-015). |
| `storage.objects` / `profile-pictures` | Supabase-managed | Auth; plus **public bucket** URL access | first folder = uid | first folder = uid | first folder = uid | Good path ownership. Policies cannot be created (BP-002). |
| `storage.objects` / `quest-evidence` | Supabase-managed | `owner = uid` or A | `owner = uid` | `owner = uid` | `owner = uid` | Private. **Unused by the app.** Uses the deprecated `owner` column (`owner_id` is current); verify on the target Storage version. |

### SECURITY DEFINER functions vs RLS intent

| Function | Bypasses RLS? | Re-checks inside? | Risk |
|---|---|---|---|
| `verify_profile_decision` | Yes | `auth.uid()`, `is_admin()`, self-review, row lock | BP-007 (state model) |
| `review_quest_submission` | Yes | admin, self-review, pending-only, row lock | OK |
| `award_xp` | Yes | admin only | BP-015 |
| `get_leaderboard` | Yes (reads all ledger and profile rows) | none beyond the `authenticated` grant | Exposes `full_name` and `avatar_url` for all ledger users, including suspended ones. Broken anyway (BP-004). |
| `claim_pending_notification_pushes` | Yes | service role only | OK |
| `handle_new_user` | Yes | n/a | BP-018 |

---

## 3. Role escalation analysis

| Path | Result |
|---|---|
| Student inserts `user_roles(admin)` via REST | **Blocked.** 010 removed the INSERT grant and the policy also requires `is_admin()`. |
| Student updates own `verification_status` | **Blocked** by trigger (011/016), *if* those triggers are applied remotely |
| Student escalates via OAuth metadata (`role`, `is_admin`) | **Blocked.** `is_admin()` reads only `user_roles`, and `handle_new_user` never writes roles. |
| Student sets own `level` or `department` at sign-up | **Possible** (BP-018). Affects targeting, not privileges. |
| Student forges an approved quest submission | **Possible** (BP-014). No XP is gained. |
| Admin self-verifies or edits own protected fields | **Possible** (BP-016) |
| Admin mints XP for self | **Possible** (BP-015) |
| Anonymous user reads or writes verification history | **Possible under default privileges** (BP-001) |
| Pending or suspended user uses student features | **Possible** (BP-005) |
| Browser-provided role trusted | **No.** Roles are never read from the client. Good. |

---

## 4. Multi-role handling (historical defect re-check)

| Location | Behaviour with student+admin rows | Status |
|---|---|---|
| `middleware.ts:66-72` | `.eq("role","admin").maybeSingle()` → correct | OK |
| `lib/supabase/role.ts:14-20` | `.maybeSingle()` without a role filter → error → `"student"` | **Not fixed** (BP-006) |
| `lib/notifications/delivery.ts:95-108` | Excludes every admin from student notifications, including admin-students | Design gap. Course-rep admins receive no lecture reminders. |

## 5. Recommendations (priority order)

1. Enable RLS on `profile_verification_history` and lock down the view (BP-001).
2. Implement `requireAccess()` server helpers and verification-aware RLS (BP-005).
3. Fix `getCurrentUserRole` and centralise admin checks (BP-006).
4. Add verification state-transition RPCs (BP-007).
5. Tighten the `quest_submissions` insert, revoke `award_xp`, and remove the trigger admin bypass (BP-014/015/016).
6. Build an automated RLS test suite (pgTAP, or the Supabase CLI against local Docker) that impersonates anon, a student, a second student, an admin and an admin-student, and asserts on every table in §2.
