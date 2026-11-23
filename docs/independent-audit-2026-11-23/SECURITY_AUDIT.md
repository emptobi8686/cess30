# BLUEPRINT — Security Audit

**Audit date:** 2026-11-23 · **Mode:** read-only, static analysis plus limited local test execution
**Scope:** application code (`src/`, `middleware.ts`, `public/sw.js`), Supabase migrations 001–019, Storage policies, secrets handling.

> **Evidence levels used in this document**
> - **Confirmed (static):** proven by reading the source or SQL; no runtime needed to establish the defect.
> - **Confirmed (library source):** proven by reading the exact dependency version's published source (`@base-ui/react@1.9.0`, downloaded to a scratch directory only).
> - **Probable (runtime):** strong static evidence; final confirmation needs a running app or database.
> - **Unverified:** depends on remote state that could not be inspected.
>
> **Live RLS enforcement was not verified.** The Supabase MCP connection listed **zero projects**, so the remote schema, migration ledger, grants and policies could not be inspected. Every database statement below describes what the *local migration files* would do if applied.

---

## 1. Summary

| Severity | Count | IDs |
|---|---:|---|
| Critical | 1 | BP-001 |
| High | 4 (security-relevant) | BP-005, BP-006, BP-010, BP-002/003 (blockers) |
| Medium | 11 | BP-014, BP-015, BP-016, BP-017, BP-018, BP-019, BP-020, BP-021, BP-022, BP-023, BP-026 |
| Low | 6 | BP-040, BP-041, BP-043, BP-046, BP-047, BP-044 |
| Informational | 4 | BP-053, BP-056, BP-057, BP-058 |

The most serious security problem is that the verification audit-trail table is created **without Row Level Security**. The most serious *authorization* problem is that the documented verification-state access model (pending / rejected / suspended / verified) is **not enforced anywhere**.

---

## 2. Detailed findings

### BP-001 — `profile_verification_history` is created without RLS; `matric_verification_history` view bypasses RLS

| Field | Detail |
|---|---|
| Severity | **Critical** |
| Status | Confirmed (static). The impact depends on live default privileges, which need live verification. |
| Feature | Profile verification / audit trail |
| Location | `supabase/migrations/015_matric_verification_workflow.sql:18-43`, `:139-176`; `016_verification_security_hardening.sql:207-215` |
| Observed | The table `public.profile_verification_history` is created and policies are attached to it, but **no migration runs `alter table public.profile_verification_history enable row level security`** (`grep` across all migrations finds RLS enabled only on the 13 other tables). The table also has no `revoke`. Migration 016's comment says direct INSERT was "revoked", but it only drops a policy, and policies have no effect while RLS is disabled. Migration 015 also creates `create or replace view public.matric_verification_history as select * from public.profile_verification_history`. A view defined this way runs with the view owner's privileges (no `security_invoker = true`), so it bypasses RLS on the base table anyway. |
| Expected | RLS enabled. SELECT limited to the owner and admins. No INSERT/UPDATE/DELETE for `anon` or `authenticated`. View created `with (security_invoker = true)` or not exposed at all. |
| Root cause | Missing `enable row level security` and no explicit `revoke`. Supabase's default privileges on the `public` schema normally grant table privileges to `anon` and `authenticated`. |
| Impact | Under Supabase's standard default privileges, anyone holding the **public anon key** could, through PostgREST: read every student's verification decisions and rejection reasons, **forge** history rows, **edit** them, or **delete** the audit trail. The view exposes the same data even after RLS is enabled. |
| Evidence / reproduction | `grep -n "enable row level security" supabase/migrations/*.sql` shows no entry for `profile_verification_history`. After 015/016 are applied to a staging project: `curl "$URL/rest/v1/profile_verification_history?select=*" -H "apikey: $ANON"`, and the same request for `matric_verification_history`. |
| Recommendation | Add a forward migration that runs `alter table ... enable row level security; revoke all on public.profile_verification_history, public.matric_verification_history from anon, authenticated; grant select on public.profile_verification_history to authenticated;` and then drops the view or recreates it `with (security_invoker = true)`. Run the Supabase security advisor afterwards. |
| DB change required | **Yes** |
| Live verification required | **Yes**: check the default privileges and the advisor output on the target project |

### BP-005 — The verification-state access model is not enforced at any layer

| Field | Detail |
|---|---|
| Severity | **High** |
| Status | Confirmed (static) |
| Feature | Authorization / verification states (spec Part 3.3) |
| Location | `middleware.ts:19-81` (checks session and the admin role only); `src/lib/supabase/auth.ts:9-21`; every student page and server action; RLS policies in 002/009/012/013/018 (`auth.role() = 'authenticated'` or ownership only) |
| Observed | The only code that reads `verification_status` is display logic: `verification-banner.tsx`, the profile settings badge, and the admin queue. Nothing blocks a **pending**, **rejected** or **suspended** user from the study planner (full CRUD), quest submission, leaderboard, notifications or push registration. Self-registration is open (`supabase/config.toml` `enable_signup = true`), so any member of the public can create an account and use every student feature. |
| Expected | Pending users: read-only timetable and announcements plus profile and verification pages. Rejected users: the same plus a recovery flow. Suspended users: only access-denied, logout and support. Verified users: everything. Enforced server-side (middleware or layout, server actions) **and** in RLS. |
| Root cause | The access model was never implemented. Only the UI banner exists. |
| Impact | The verification workflow does not gate anything. Suspension has no effect. |
| Evidence | `grep -rn "suspended\|verification_status" src` lists only display code (see the Authorization doc). |
| Recommendation | Add `requireVerifiedStudent()` / `requireAccess(level)` helpers used by every protected layout and server action. Add a `public.current_verification_status()` SECURITY DEFINER helper and include it in RLS for `study_sessions`, `quest_submissions`, `notifications` and similar tables. Add a dedicated suspended page. |
| DB change required | Yes, for defence in depth |
| Live verification required | Yes |

### BP-006 — Multi-role users lose administrator access (`.maybeSingle()` on `user_roles`)

| Field | Detail |
|---|---|
| Severity | **High** |
| Status | Confirmed (static) |
| Location | `src/lib/supabase/role.ts:14-20` |
| Observed | `select role from user_roles where user_id = $1` → `.maybeSingle()`. A user with both `student` and `admin` rows (allowed by `user_roles_unique (user_id, role)`) makes PostgREST return an error because there are multiple rows. `data` is then `null`, and the function returns `"student"`. |
| Expected | `.eq("role","admin")` existence check, or aggregate the roles. |
| Impact | For an admin who also has a student row: the admin layout (`src/app/admin/layout.tsx:12-16`) redirects to `/access-denied` even though middleware allowed the request, and **every** admin server action (`requireAdminSession` in timetable, announcements, quests, verification) throws "Administrator access required". The design explicitly allows multiple roles. The previously reported "Phase 3 batch 1" fix is **not present**. |
| Recommendation | Replace the query with `.eq("role","admin").maybeSingle()` or `rpc("is_admin")`. Centralise `requireAdminSession` in a single module and add unit tests with a mocked client covering 0, 1 and 2 role rows. |
| DB change required | No |
| Live verification required | Yes (with a two-role test account) |

### BP-010 — Sign-out is unreachable; account menus are broken

| Field | Detail |
|---|---|
| Severity | **High** (security hygiene on shared or lab devices, and core UX) |
| Status | Confirmed (library source, `@base-ui/react@1.9.0`) |
| Location | `src/components/shared/dashboard-shell.tsx:154,178,186-187`; `src/components/shared/admin-shell.tsx:153,166,169`; `src/components/ui/dropdown-menu.tsx:56-73` |
| Observed | (1) `DropdownMenuLabel` renders `Menu.GroupLabel` outside a `Menu.Group`. In 1.9.0, `menu/group-label/MenuGroupLabel.js:29` calls `useMenuGroupRootContext()`, which **throws** "MenuGroupContext is missing" (`menu/group/MenuGroupContext.js:18`). (2) The sign-out item uses `onSelect`. `MenuItemProps` exposes only `onClick` and `closeOnClick` (no `onSelect` anywhere under `menu/`), so `onSelect` falls through to the DOM `select` event and never runs on a click. (3) `<DropdownMenuTrigger><Button/></DropdownMenuTrigger>` nests a `<button>` inside a `<button>`. |
| Impact | Opening the profile menu is expected to throw during render. Even without the throw, the sign-out handler never runs. **There is no other sign-out control in the application.** Students on shared university or lab machines cannot end their session. |
| Recommendation | Wrap the label in `DropdownMenuGroup`, or use a plain heading. Change `onSelect` to `onClick`. Use `render={<Button …/>}` on triggers. Add an E2E test for sign-out. |
| DB change required | No |
| Live verification required | Yes (browser) |

### BP-002 / BP-003 — The migration chain 014–019 cannot apply (syntax errors)

Security relevance: every hardening measure in 014–019 (storage policies, the verification RPC, removal of the broad admin policy, quest RLS, the duplicate-XP constraint) is **absent** until these are fixed. Details are in `DATABASE_AND_MIGRATION_AUDIT.md`.

### BP-014 — Students can insert quest submissions in any state

| Field | Detail |
|---|---|
| Severity | Medium |
| Status | Confirmed (static) |
| Location | `018_quests_and_xp.sql:164-173` (`quest_submissions_insert_own`: `with check (student_id = auth.uid())`); grant `insert` at `:112` |
| Observed | The only INSERT check is ownership. A student can POST to `/rest/v1/quest_submissions` with `status='approved'`, arbitrary `reviewed_by` / `reviewed_at`, and a quest that is **inactive or past its due date**. The server action's checks (`actions.ts:166-201`) are bypassed by calling PostgREST directly with the anon key and the user's JWT. |
| Impact | Forged "approved" submissions show as approved in the UI and admin lists. XP is not awarded, because `xp_ledger` writes require the RPC. Integrity of quest state is lost. |
| Recommendation | Add a column-restricted insert (`grant insert (quest_id, student_id, evidence_url, notes)`) and a `with check` requiring `status='pending' and reviewed_by is null and reviewed_at is null and rejection_reason is null` plus an active, not-overdue quest (via a SECURITY DEFINER helper). Alternatively, route submission through an RPC. |
| DB change required | Yes |
| Live verification required | Yes |

### BP-015 — Any administrator can mint XP for anyone, including themselves

| Field | Detail |
|---|---|
| Severity | Medium |
| Location | `019_quests_security_fixes.sql:179-263` (`award_xp`, granted to `authenticated`) |
| Observed | Self-review is blocked only inside `review_quest_submission`. `award_xp` itself is callable by any admin via `rpc('award_xp', {p_user_id: <self>, p_quest_id: null, p_xp_amount: 10000, …})` with no limit: the uniqueness check applies only when `quest_id` is non-null. |
| Impact | Leaderboard integrity depends entirely on administrator honesty. The "prevention of self-review" requirement is not met. |
| Recommendation | Revoke `award_xp` from `authenticated` and keep it internal to `review_quest_submission`. If manual awards are needed, add a separate audited RPC that forbids `p_user_id = auth.uid()` and records `awarded_by`. |
| DB change required | Yes |

### BP-016 — Administrators can rewrite their own protected profile fields, including self-verification

| Field | Detail |
|---|---|
| Severity | Medium |
| Location | `016_verification_security_hardening.sql:30-33` (`if public.is_admin() then return new;`), with `profiles_update_own` (002/014) |
| Observed | The trigger exempts admins from every check. Migration 017 removed the admin-updates-anyone policy, but an admin can still `update profiles set verification_status='verified', matric_number=… where id = auth.uid()` through the own-row policy. No history row is written. |
| Recommendation | Change the trigger so that verification fields can only change when a transaction-local flag set by `verify_profile_decision` is present (`set_config('blueprint.verification_rpc','on',true)`). Never exempt the caller's own row. |
| DB change required | Yes |

### BP-017 — Students can change `full_name` and `avatar_url` at will

| Field | Detail |
|---|---|
| Severity | Medium |
| Location | Trigger `prevent_profile_identity_changes` (016) does not protect `full_name` or `avatar_url`. Policy `profiles_update_own`. `get_leaderboard` (019:384-386) exposes both to all users. |
| Observed | After verification, a student can rename themselves (for example to another student's name) and set `avatar_url` to any external URL, including tracking pixels or offensive images. These appear on the leaderboard for everyone and in the admin queue. |
| Recommendation | Lock `full_name` after verification, or route changes through re-verification. Restrict `avatar_url` to the project's own Storage public prefix with a CHECK constraint or trigger. |
| DB change required | Yes |

### BP-018 — Cohort identity is taken from client-supplied sign-up metadata

| Field | Detail |
|---|---|
| Severity | Medium |
| Location | `011_phase43_auth_options.sql:56-69` (`handle_new_user`); `src/app/register/register-form.tsx:81-86`; `src/lib/notifications/targeting.ts:12-26`; `src/lib/notifications/delivery.ts:268-273` |
| Observed | `department`, `level` and `matric_number` come from `raw_user_meta_data`, which the user controls by calling `supabase.auth.signUp({options:{data:{level:'400', department:'X'}}})` directly. These values drive announcement and lecture-reminder targeting. Students cannot correct them afterwards because the trigger forbids it. Anyone can also **pre-claim another student's matric number** at sign-up. The unique constraint then blocks the real student, whose sign-up fails with a raw "Database error saving new user". |
| Recommendation | Ignore `department` and `level` from metadata and set them only on admin verification. Treat `matric_number` as a claim pending review. Return a friendly error for a duplicate matric number. |
| DB change required | Yes |

### BP-019 — Announcement scope is not enforced for readers

| Field | Detail |
|---|---|
| Severity | Medium |
| Location | `002/007` select policy; `src/features/announcements/queries.ts:14-26` |
| Observed | Any authenticated user can read every published announcement regardless of `scope` or `course_id`. Targeting exists only for notifications, and there it uses hard-coded values: `department === "Civil Engineering"`, `level === "200"`. |
| Recommendation | Add audience columns (department, level) and an RLS predicate joining the reader's verified profile. Alternatively, document that the scope is a label only. |

### BP-020 — Open redirect in the auth callback (`safeNextPath` bypass)

| Field | Detail |
|---|---|
| Severity | Medium |
| Status | Confirmed (static). The WHATWG URL parser removes ASCII tab and newline characters. |
| Location | `src/app/auth/confirm/route.ts:26-32`, `:110` |
| Observed | `safeNextPath("/\t/evil.example")` passes: the value starts with `/`, does not start with `//`, and contains no `\`. `new URL("/\t/evil.example", request.url)` then resolves to `https://evil.example/`. |
| Reproduction | `GET /auth/confirm?token_hash=<valid>&type=magiclink&next=%2F%09%2Fevil.example`. After a successful verification the user is redirected off-site. An attacker can use a token for their *own* account (login CSRF plus redirect). |
| Recommendation | Resolve with `new URL(value, origin)` and require `url.origin === origin`. Reject any control characters. Add unit tests for `%09`, `%0A` and `%0D`. |
| DB change required | No |

### BP-021 — Matric uniqueness pre-check cannot see other students

| Field | Detail |
|---|---|
| Severity | Medium |
| Location | `src/app/actions/profile.ts:41-53`, `:60-61` |
| Observed | The duplicate check runs with the student's own RLS context (`profiles_select_own`), so it **always** returns no rows. The real enforcement is the unique constraint (`001:12`), and its raw message ("duplicate key value violates unique constraint "profiles_matric_number_unique"") is returned to the user. The historical defect is **not fixed**. |
| Recommendation | Catch error code `23505` and map it to a friendly message. Optionally add a SECURITY DEFINER `matric_number_available(text)` that returns only a boolean. |

### BP-022 — Raw database and RPC error text is returned to users

| Field | Detail |
|---|---|
| Severity | Medium (information disclosure, poor UX) |
| Location | `features/timetable/actions.ts` (multiple `error.message` returns), `features/announcements/actions.ts:72,130,165,209,234`, `features/quests/actions.ts` (all actions), `features/study-planner/actions.ts:361,397`, `app/actions/profile.ts:61,107,194,207`, `app/actions/auth.ts:61`, `features/verification/actions.ts:93` |
| Recommendation | Add a single `toUserError(error)` mapper (constraint codes → friendly text, log the full error server-side with a correlation id). |

### BP-023 — Verification notifications can never be inserted

| Field | Detail |
|---|---|
| Severity | Medium (functional; failure is logged and otherwise silent) |
| Location | `src/features/verification/actions.ts:21-63`, `:98`; grants in `013_notifications.sql:84-89` |
| Observed | The insert uses the admin's **user-context** client. `authenticated` has no INSERT grant on `notifications`, so the insert fails every time and is only `console.error`'d. It is also launched with `void` from a server action and is not awaited. The historical defect is **not fixed**. |
| Recommendation | Insert via the service-role client (`createAdminSupabaseClient`) or via the decision RPC itself. Await it and surface failures to the admin. |

### BP-026 — Avatar pipeline weaknesses

| Field | Detail |
|---|---|
| Severity | Medium |
| Location | `next.config.ts` (no `images.remotePatterns`, no `serverActions.bodySizeLimit`); `src/app/actions/profile.ts:159-271`; `profile-settings-client.tsx:136-176` |
| Observed | (a) `next/image` is used for avatars from Google (`handle_new_user` copies the `picture` URL) and from Supabase Storage, but no remote hosts are configured. In development this throws an "Invalid src prop" error. In production the optimiser rejects the URL and the image breaks. (b) Server actions have a default 1 MB body limit, but the UI and server allow 5 MB. (c) The upload result is discarded, and the progress bar is simulated with `setInterval`. (d) Replacing an avatar leaves the old object behind as an orphan. (e) Deleting a Google avatar fails ("Unable to parse profile picture path"). (f) The file extension comes from the client-supplied filename. |
| Positive | Deletion relies on Storage RLS (`014:78-85`, owner folder), which prevents deleting other users' files even though the path is parsed from a user-controlled URL. |
| Recommendation | Configure `images.remotePatterns` for the Supabase host (and Google if kept). Upload directly from the browser using the RLS-scoped client, or raise `bodySizeLimit`. Derive the extension from the validated MIME type. Delete the previous object after a successful replacement. |

### Low findings

| ID | Finding | Location | Recommendation |
|---|---|---|---|
| BP-040 | `?error=` / `?message=` query text is rendered on `/login` and `/reset-password`, and `formatOAuthError` echoes the provider-supplied `error_description`. This allows content spoofing (React escapes it, so it is not XSS). | `app/login/page.tsx:26-29`, `auth/confirm/route.ts:69` | Map to an allow-list of message codes. |
| BP-041 | Admin search is string-interpolated into a PostgREST `.or()` filter. Commas or parentheses alter the filter. Admin-only, so impact is limited. | `features/verification/queries.ts:45-49` | Escape PostgREST reserved characters or use separate `.ilike` calls / an RPC. |
| BP-043 | In `grant_admin_role`, `current_user` is always the function owner inside a SECURITY DEFINER function, so the "trusted caller" branch never runs. Mitigated because EXECUTE is revoked from `authenticated`. | `004_security_hardening.sql:60-64` | Use `session_user` / `auth.role()` or delete the branch. |
| BP-044 | 018 redefines `update_updated_at_column()` without `set search_path`, reverting the 009 hardening. | `018:223-231` | Restore `security invoker set search_path = pg_catalog, public`. |
| BP-046 | `profiles_insert_own` lets a user insert their own profile with any `verification_status` if no row exists (BEFORE UPDATE trigger only). This is an edge case because the auth trigger normally creates the row. | `002:47-50`, `014:107-119` | Revoke INSERT on profiles from `authenticated`, or add a BEFORE INSERT guard. |
| BP-047 | `DELETE /api/push/subscriptions/[id]` does not validate that `id` is a UUID, so a bad id returns 500. An endpoint already registered to another account returns 409, which permanently blocks a shared device. | `app/api/push/subscriptions/[id]/route.ts:44-52`; `route.ts:91-93` | Validate with `z.string().uuid()`. On a same-endpoint conflict, reassign the endpoint to the current user. |

### Informational

| ID | Observation |
|---|---|
| BP-053 | No security headers (CSP, `frame-ancestors`, `Referrer-Policy`, HSTS) are configured in `next.config.ts`. There is no hosting configuration. |
| BP-056 | Auth cookies are `httpOnly: false` (`lib/supabase/client.ts:18`). This is required by `@supabase/ssr` browser clients, but it raises the impact of any future XSS. A CSP is the main mitigation. |
| BP-057 | **Secrets:** a scan of all 5 commits for token-shaped strings, `.env*` files and key names found **no committed secret values**. `.env*` is ignored and `.env.example` contains placeholders only. `SUPABASE_SERVICE_ROLE_KEY` is imported only in `server-only` modules (`lib/supabase/admin.ts`). No secret is logged: error logs record only `error.name` or `code`. **The historically exposed `CRON_SECRET` could not be checked from this repository. Treat it as compromised and rotate it in the host environment and the Supabase Vault (`notifications_cron_secret`).** |
| BP-058 | The `profile-pictures` bucket is `public: true` (`014:36-44`), so avatars are world-readable by URL. This is acceptable by design but should be stated in the privacy notice. The `quest-evidence` bucket is private (`019:271-279`) but is **unused by the app**. |

---

## 3. Input validation review (spec 8.4)

| Vector | Result |
|---|---|
| SQL injection | No raw SQL in the app. All access goes through supabase-js. RPCs use parameters. **No SQL injection found.** |
| PostgREST filter injection | **BP-041** (admin search). |
| URL schemes | `evidence_url`: the app checks length only (`features/quests/validation.ts:50-53`). Migration 019 adds `^https?://` (http still allowed). With 018 alone, `javascript:` would be stored. The app currently never renders evidence URLs (BP-013), which removes the click-XSS path but also makes review impossible. `action_url` in notifications is constrained in the DB (`013:13-20`) and re-validated (`getSafeActionUrl`). Good. |
| Open redirect | **BP-020**. |
| Stored / reflected XSS | No `dangerouslySetInnerHTML`, `innerHTML` or `eval` in `src/`. React escaping covers announcement content, names and notes. No XSS found. |
| UUID handling | Quest, notification and submission IDs are regex/zod-checked. Push `[id]`, study session IDs and announcement or lecture IDs passed to actions are not validated; a bad ID produces a PG `22P02` error passed back raw (BP-022). |
| File uploads | MIME allow-list plus 5 MB limit, both client-reported (`file.type`). The bucket also enforces MIME and size (`014:36-44`). The extension is taken from the filename (BP-026). |
| Payload sizes | Announcements have **no length limits** (BP-050). Study session notes and location have no limits. The push API has zod limits. |

## 4. Privileged code paths that use the service-role key

| File | Purpose | Guard |
|---|---|---|
| `lib/notifications/delivery.ts` | Fan-out of announcement and reminder notifications | Callers: admin actions (role-checked) and the cron route (bearer secret) |
| `lib/notifications/push.ts` | Web Push dispatch | Cron route only |
| `api/push/subscriptions/*` | Device registration | `getUser()` plus same-origin check, scoped by `user_id` |
| `features/notifications/actions.ts:43-60` | Preference upsert | `requireUserSession()`, scoped by `user.id` |
| `features/notifications/queries.ts:157-168, 190-237` | Devices and delivery stats | Session, and admin role for stats |
| `features/quests/queries.ts:149-230` | Admin quest lists and counts | `getCurrentUserRole()`, which is affected by BP-006 |

The cron route uses a constant-time bearer comparison (`api/cron/notifications/route.ts:9-17`). Good.
