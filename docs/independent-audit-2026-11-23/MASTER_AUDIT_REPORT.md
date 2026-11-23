# BLUEPRINT — Master Independent Audit Report

| | |
|---|---|
| **Project** | BLUEPRINT (UNILAG Civil Engineering, 200-level pilot; independent student project) |
| **Audit date** | 2026-11-23 |
| **Auditor** | Claude Code (independent, read-only) |
| **Commit audited** | `4561810` (`master` = `claude/upbeat-lovelace-rot6of`) |
| **Mode** | Read-only. No source, config, migration or documentation was changed. No dependencies installed, no SQL executed, nothing deployed, committed or pushed. The only files created are this audit directory. |

## Verdict: **NO-GO**

Critical security, data-integrity and functionality problems prevent safe deployment, even for a controlled pilot:

1. **The migration chain cannot apply.** Migrations 014, 018 and 019 contain PostgreSQL syntax errors (BP-002, BP-003). A database built from this repository cannot hold the objects that the profile, verification, quest, XP and leaderboard code queries.
2. **The verification audit table is created without Row Level Security**, and an accompanying view bypasses RLS (BP-001, Critical).
3. **The verification-state access model is not enforced anywhere.** Pending, rejected and suspended users get full student functionality (BP-005).
4. **Administrators who also hold a student role lose admin access** (BP-006). The reported multi-role fix is not in the code.
5. **Core flows are broken:** quest creation always fails (BP-008), the quest pages pass non-action closures to forms (BP-009), `get_leaderboard()` cannot return rows (BP-004), **users cannot sign out** (BP-010), lecture reminders are never generated (BP-012), and Web Push cannot display anything (BP-011).
6. **The previously reported "Phase 3, seven batches complete" work is not present in the repository** (§4).

---

## 1. Audit limitations (read first)

| Limitation | Consequence |
|---|---|
| `node_modules` absent; install prohibited | `typecheck`, `lint` and `build` **not run**. Unit tests were run via Node 22 type stripping: **134/159 passed, 25 blocked** (missing packages). |
| Supabase MCP returned **zero projects** | The remote migration ledger, schema, RLS, grants, Storage and Auth configuration are **UNVERIFIED**. All DB conclusions are from local migration files. |
| No PostgreSQL server locally | Migrations could not be dry-run. Syntax findings are from the PostgreSQL grammar. |
| No browser session | UI findings come from static analysis and the exact `@base-ui/react@1.9.0` source (downloaded to a scratch directory only). Visual, contrast and mobile checks are UNVERIFIED. |
| Hosting not selected; Vercel not queried | Deployment state is unknown |

## 2. Separation of evidence

| Category | Items |
|---|---|
| **Exists** | 27 routes (all spec routes; no extras), 19 migrations, seed of 7 courses / 19 units, notification pipeline, quests/XP schema, verification RPC, PWA manifest |
| **Works locally (proven by executing code)** | Pure logic only: Lagos date utilities, timetable/study-planner/quest/announcement validation, notification time math and URL validation, password rules (134 passing tests) |
| **Tested with mocks** | Nothing meaningful. Several "security" tests are tautological (`role.test.ts`, parts of `verification-security.test.ts`). |
| **Tested with real services** | **Nothing.** No test touches Supabase, RLS, Storage, Auth, push or a browser. |
| **Broken** | Migrations 014/018/019; `get_leaderboard`; quest creation; quest page forms; sign-out and account menus; lecture reminders; push display; verification notifications; admin "[object Object]" stat; multi-role admin access |
| **Incomplete** | Verification access model; rejected-student recovery; suspend/reinstate; course CRUD; announcement targeting; quest cancellation; evidence upload and display; leaderboard periods; dashboard quest/XP widgets; recurring lectures; error boundaries; CI; monitoring |
| **Unknown** | Remote schema and ledger; live RLS; OAuth config; email delivery; build/lint/typecheck status; bundle size; mobile rendering; dependency vulnerabilities; cron secret rotation |
| **Requires a DB migration** | BP-001, 002, 003, 004, 005 (defence in depth), 007, 014, 015, 016, 017, 018, 019, 029, 030, 043–046, 050 |
| **Requires human approval** | Any remote migration push, secret rotation, Vault/pg_cron setup, OAuth/SMTP config, host selection, deployment, recovery of the missing Phase 3 work |

## 3. Findings overview

58 findings in total. The full list is in `RISK_REGISTER.md`.

| Severity | Count |
|---|---:|
| Critical | 1 |
| High | 12 |
| Medium | 25 |
| Low | 14 |
| Informational | 6 |

Top findings (details in the domain documents):

| ID | Sev | Title | Doc |
|---|---|---|---|
| BP-001 | Critical | Verification history table without RLS; view bypasses RLS | Security, DB |
| BP-002 | High | `CREATE POLICY IF NOT EXISTS` invalid (014, 019) | DB |
| BP-003 | High | String literal syntax error (018:65) | DB |
| BP-004 | High | `get_leaderboard` type mismatch and ambiguity | DB |
| BP-005 | High | Verification states unenforced | AuthZ |
| BP-006 | High | Multi-role role resolution | AuthZ |
| BP-007 | High | Verification deadlock (no resubmit, suspend or restore) | Feature, DB |
| BP-008 | High | Quest `created_by` missing | Feature |
| BP-009 | High | Closures as form actions in Server Components | Feature |
| BP-010 | High | Sign-out unreachable; menus throw | Security, UX |
| BP-011 | High | Service worker cannot display push | Feature |
| BP-012 | High | Lecture reminders never created | Feature |
| BP-013 | High | Evidence not shown to reviewers | Feature |

## 4. Verification of the reported Phase 3 work

**Claim:** "all seven Phase 3 application-layer batches were completed". The repository has 5 commits; the last 3 (14–15 Nov) touch quests and the service worker only.

| # | Batch | Expected fix | Evidence in code | Verdict |
|---|---|---|---|---|
| 1 | Authorization and multi-role | Correct role resolution; independent server checks | `lib/supabase/role.ts:14-20` still uses unfiltered `.maybeSingle()`. No verification-state guards. | **NOT PRESENT** |
| 2 | Profile and matric validation | RLS-independent uniqueness; no raw errors | `actions/profile.ts:41-61` unchanged (RLS-blind check, `error.message`) | **NOT PRESENT** |
| 3 | Admin verification workflows | Correct review actions, feedback, notifications, recovery | The RPC (016) exists. Actions shown for reviewed rows; `console.error` only; notification insert cannot succeed; no recovery; unsafe `.or()` search. | **PARTIAL** (DB side only, and unapplyable) |
| 4 | Quest creation and submissions | `created_by`, update validation, feedback, cancellation, notes and evidence display, evidence upload | `created_by` absent; no update validation; no feedback; no cancellation; notes and evidence not displayed; no upload. Only the validation functions were moved to `validation.ts` (ecfea5a). | **NOT PRESENT** |
| 5 | Dashboard and notification corrections | Raw object display, preference defaults, error surfacing, relation handling, SW push handlers, registration cleanup | `[object Object]` remains; `courses?.[0]` remains; prefs throw; **SW push handlers removed** (4561810). | **NOT PRESENT / REGRESSED** |
| 6 | Avatar and OAuth security | Safe deletion, external images, ownership, orphans, remote image config | No `remotePatterns`; URL-parsing delete; orphans; `safeNextPath` bypassable. Storage RLS ownership exists in 014 but cannot apply. | **NOT PRESENT** |
| 7 | Leaderboard fallback and period selection | Application fallback; working period selection; RPC fix | No fallback; decorative buttons; RPC unchanged; **no migration 020** | **NOT PRESENT** |

Other claims:

| Claim | Verdict |
|---|---|
| No migrations 014–019 / 020 executed or pushed | Cannot verify remotely. 020 does not exist locally. 014/018/019 could not have applied as written. |
| No remote schema, RLS or grant changes | UNVERIFIED |
| "Local application tests performed" / 159 tests pass | 159 tests exist; 134 executed and passed here, 25 blocked. Typecheck, lint and build claims UNVERIFIED. |

**Conclusion:** the Phase 3 completion report is **not supported by the repository**. Either the work was never done or it exists only outside GitHub. Treat it as not done until it is produced and reviewed.

## 5. Historical defects re-check (spec Part 10)

| Defect | Status | Ref |
|---|---|---|
| Multi-role `.maybeSingle()` | **Still present** | BP-006 |
| Inconsistent admin resolution | **Still present** (middleware correct, layout and actions wrong) | BP-006 |
| Missing independent server-side privilege checks | Admin: present but buggy. Verification: **absent**. | BP-005 |
| Verification-state bypasses | **Still present** | BP-005 |
| Matric uniqueness limited by RLS | **Still present** (DB unique constraint does enforce it) | BP-021 |
| Raw DB errors exposed | **Still present** | BP-022 |
| Rejected resubmission deadlock | **Still present** | BP-007 |
| Review actions on already-reviewed submissions | UI still offers them; the RPC blocks them silently | BP-042 |
| Verification notification creation failure | **Still present** | BP-023 |
| Duplicate notification keys | Mitigated: global `unique(dedupe_key)` plus pre-check; deterministic keys | – |
| Unsafe verification search filter | **Still present** | BP-041 |
| Missing `created_by` | **Still present** | BP-008 |
| Incomplete quest update validation | **Still present** | BP-028 |
| Missing submission feedback | **Still present** | BP-024 |
| Nonfunctional cancellation | **Absent entirely** | BP-029 |
| Notes/evidence display | **Absent** | BP-013 |
| Unsafe evidence URL handling | DB regex only (019, http allowed); not rendered | BP-029 |
| Private evidence upload/access | Bucket defined (019); **no app code** | BP-029 |
| Duplicate XP / self-review | Fixed in 019 for the review path; `award_xp` bypass remains; 019 unapplyable | BP-015 |
| Admin dashboard raw objects | **Still present** | BP-025 |
| Notification preference defaults | DB defaults OK; query throws if missing | BP-048 |
| Notification errors swallowed | Partially (logged by name only) | BP-024, BP-032 |
| Lecture/course relation handling | **Still present** | BP-012 |
| Push handlers missing from SW | **Now missing** (removed in the last commit) | BP-011 |
| SW registration/cleanup | Registration only on push enable; cleanup component unused | BP-011 |
| Unsafe avatar deletion paths | Mitigated by Storage RLS, but parses a user-controlled URL | BP-026 |
| External avatar handling / remote image config | **Still present** | BP-026 |
| Orphaned files | **Still present** | BP-026 |
| Leaderboard RPC return types | **Still present** (plus ambiguity) | BP-004 |
| Unsupported period selection | **Still present** | BP-027 |
| Misleading fallback | No fallback at all | BP-027 |
| PWA offline / installability / cache | Offline removed. Install via manifest likely OK (UNVERIFIED). Cache cleanup only. | BP-011 |
| Incomplete CRUD | Courses read-only; quests partial | BP-030, BP-028 |
| Missing loading/error states | Many routes | BP-031 |
| Accessibility | Nested interactive elements; label association | BP-036 |
| Inadequate integration testing | **None exist** | BP-035 |

## 6. Cross-layer contradictions (Stage 6)

| Layer A says | Layer B says |
|---|---|
| Handoff: "Admin routes double-guarded" | `getCurrentUserRole` locks out multi-role admins (BP-006) |
| Handoff: migrations 010/011/012 = phase43 / phase5 / completed_at | Files: 010 = least-privilege grants, 011 = phase43, 012 = phase5 (BP-052) |
| Migration 016 comment: "revoked direct INSERT on history" | No revoke and no RLS (BP-001) |
| Verification banner: "update your matric and resubmit" | Trigger forbids matric change; RPC forbids re-decision (BP-007) |
| Push UI: "Push notifications are enabled" | SW has no push handler (BP-011) |
| Leaderboard UI: period buttons | No behaviour (BP-027) |
| Admin courses copy: "Courses referenced by existing sessions are protected from deletion" | FK is `on delete cascade` (`001:38`) |
| Spec: announcement targeting | Reads ignore scope (BP-019) |
| App code queries `quests`, `nickname`, `get_leaderboard` | Migrations defining them cannot apply (BP-002/003) |

## 7. Final scorecard

Scale 0–10 (10 = production-grade). Scores reflect static evidence only. **UNVERIFIED** means the evidence was insufficient to score.

| # | Category | Score | Evidence and rationale |
|---|---|---:|---|
| 1 | Product requirement coverage | **4** | All routes exist and timetable, study planner, announcements and inbox are substantially built. Verification model, quests, leaderboard, course CRUD, targeting and push are broken or missing (Feature matrix). |
| 2 | Architecture integrity | **6** | Stack matches the spec. Layering (queries/actions/lib) and Lagos time handling are good. Undermined by schema–code drift, no generated types and duplicated guards. |
| 3 | Authentication | **5** | `getUser()` used correctly; PKCE/OTP callback; password flow sound. Open redirect (BP-020), no working sign-out (BP-010), metadata trust (BP-018). |
| 4 | Authorization | **2** | Admin checks exist but break for multi-role users. Verification states unenforced at every layer. |
| 5 | Database security | **3** | Solid patterns in 001–013 (split policies, audit triggers, hardened definers, column grants). Critical RLS omission, insert-policy gaps, admin self-bypass, unapplyable 014–019. Live state UNVERIFIED. |
| 6 | Storage security | **4** | Ownership-by-folder policies are well designed but cannot apply (BP-002). Evidence bucket unused. Avatar pipeline gaps. |
| 7 | Core student functionality | **5** | Timetable, study planner, announcements and inbox OK statically. Quests and leaderboard broken, sign-out broken, verification recovery impossible. |
| 8 | Administrative functionality | **3** | Timetable and announcement CRUD good. Courses read-only. Quests broken. Verification has no feedback and no suspend. Overview defects. |
| 9 | Notifications | **3** | Strong pipeline design. Lecture reminders dead, push display dead, verification notices dead, scheduler unconfigured. |
| 10 | Quest and XP integrity | **2** | Good RPC design (locks, unique XP). Creation fails, forged statuses possible, admin XP minting, blind reviews. |
| 11 | Leaderboard reliability | **1** | RPC cannot return rows; no fallback; decorative periods. |
| 12 | Mobile responsiveness | **UNVERIFIED** | Static indicators are positive (mobile sheet nav, responsive grids, overflow tables). No rendering performed. |
| 13 | Accessibility | **4** | Base UI primitives and some ARIA labels. Nested interactive elements, unassociated labels, unverified contrast. |
| 14 | Performance | **UNVERIFIED** | No build possible. Static review shows no N+1 and adequate indexes at pilot scale; a 982 KB logo asset. |
| 15 | Automated testing | **2** | 159 unit tests, mostly pure logic; several tautological; no action, route or RLS tests; no CI. |
| 16 | Integration testing | **0** | None exist. SQL scripts are non-executable prose with invalid UUIDs. |
| 17 | PWA readiness | **1** | Manifest only. SW stripped of offline and push. |
| 18 | Deployment readiness | **1** | Migrations fail; no host, CI, monitoring, headers, backup plan or scheduler. |
| 19 | Documentation quality | **3** | Useful setup docs (OAuth, notifications). Handoff contains inaccurate and unverifiable claims. Default README. Referenced docs missing. |
| 20 | Maintainability | **5** | Readable, consistent code with good comments. Duplication, no generated types, inconsistent validation and errors, poor commit hygiene. |

## 8. Path to a pilot

Follow `REMEDIATION_ROADMAP.md` Phases 0–5. The minimum before **CONDITIONAL GO** (controlled test environment): Phase 0 complete, Phase 1 and 2 complete with a green RLS suite on staging, and Phase 3.1, 3.2, 3.4 and 3.7. A **GO FOR PILOT** additionally requires Phase 4.1–4.4, Phase 5.1–5.4 and the roadmap exit criteria.

## 9. Document index

| Document | Contents |
|---|---|
| `ARCHITECTURE_AND_CODEBASE_MAP.md` | Repo integrity, stack, directory map, **route inventory** |
| `FEATURE_COMPLETENESS_MATRIX.md` | Requirement-by-requirement status and functional findings |
| `SECURITY_AUDIT.md` | Security findings, input validation, secrets, privileged paths |
| `DATABASE_AND_MIGRATION_AUDIT.md` | Migration-by-migration review, function inventory, feature→migration map |
| `AUTHORIZATION_AND_RLS_AUDIT.md` | Layered authorization, per-table RLS matrix, escalation analysis |
| `TESTING_AND_QA_REPORT.md` | Executed test results, coverage gaps, QA plan |
| `UX_AND_ACCESSIBILITY_AUDIT.md` | Dead controls, feedback states, a11y, mobile |
| `PERFORMANCE_AND_MAINTAINABILITY.md` | Query patterns, client boundaries, tech debt |
| `DEPLOYMENT_READINESS.md` | Env vars, checklist, deployment sequence |
| `RISK_REGISTER.md` | All 58 findings with severity, status and flags |
| `REMEDIATION_ROADMAP.md` | Phased plan and exit criteria |

## 10. Addendum: department-wide expansion (scope change received 2026-11-23)

The product scope now covers the whole Civil Engineering department and adds the **Library** and **Tutorials Pack** modules. The combined assessment is in `department-expansion/`:

| Document | Contents |
|---|---|
| `01_DEPARTMENT_WIDE_ARCHITECTURE_ASSESSMENT.md` | Feasibility, single-level assumptions inventory, feature impact, answers to the 10 required conclusions |
| `02_ACADEMIC_DATA_MODEL_AND_ERD.md` | Catalogue vs offering, ERD, audience model, helper functions |
| `03_EXISTING_DATA_PRESERVATION_AND_MIGRATION_IMPACT.md` | Record-by-record mapping, records lacking context, non-destructive cut-over |
| `04_LIBRARY_MODULE_ASSESSMENT.md` | Completeness, data model, private Storage design, Library security |
| `05_TUTORIALS_PACK_ASSESSMENT.md` | Completeness, external video integration, AI content governance |
| `06_RESOURCE_ACCESS_AND_PERMISSION_MODEL.md` | Visibility rules, scoped capability model (proposed), expansion risk register |
| `07_REVISED_IMPLEMENTATION_ROADMAP.md` | Migrations E0–E10, infrastructure classification, dependency-ordered phases, blocking decisions |

**Verdict unchanged: NO-GO.** The pivot is architecturally feasible: the platform layers are reusable, but the academic data model, authorization and visibility layers must be extended. It must be preceded by the existing Critical and High fixes.

**Remediation has not started. It awaits explicit approval.**
