# P4 Hardening and Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining medium and low findings: open redirect, raw error leakage, avatar pipeline, error boundaries, accessibility, timezone display, study-planner range, announcement limits, auth page redirects, security headers and generated DB types.

**Architecture:** Small, independent changes. Each is backed by a pure-function unit test, a pgTAP test or an e2e/axe check. A central `toUserError` mapper replaces ad-hoc `error.message` returns.

**Tech Stack:** Next.js 16 (`next.config.ts` headers and images), Supabase Storage (browser upload with RLS), Zod 4, `@axe-core/playwright`, Supabase CLI type generation.

**Spec:** `SECURITY_AUDIT.md`, `UX_AND_ACCESSIBILITY_AUDIT.md`, `PERFORMANCE_AND_MAINTAINABILITY.md`, `RISK_REGISTER.md` (BP-019 partial, 020, 021, 022, 026, 031, 036–040, 047–053, 055).

## Global Constraints

- New dependency allowed in this phase: `@axe-core/playwright` (dev only, pinned exact). No other new runtime dependencies.
- The CSP introduced here must not break Supabase (REST, Auth, Realtime websockets, Storage) or Google OAuth redirects. Later phases (P8/P9) extend it; they never loosen it to `*`.
- Read `node_modules/next/dist/docs/` for the `headers()` and `images` config in Next 16 before Task 10 and Task 3.

## Review Focus

- `next=%2F%09%2Fevil.example` and `next=%2F%0D%0A%2Fevil.example` must redirect to the default path, not off-site.
- A 4.5 MB avatar upload must succeed (it exceeds the 1 MB server-action body limit), and a 6 MB upload must show "Profile picture must be smaller than 5 MB."
- Replacing an avatar twice must leave exactly one object in the user's storage folder.
- Each route that previously had no error boundary must render a friendly error with a "Try again" button when its query throws.
- An announcement title of 161 characters must be rejected by both the app and the database.

---

### Task 1: Open redirect fix (BP-020)

**Files:**
- Modify: `src/app/auth/confirm/route.ts:26-32` (`safeNextPath(value: string | null, fallback: string, origin = "https://blueprint.invalid"): string`. Reject any value containing characters `\u0000-\u001f` or `\\`. Resolve `new URL(value, origin)`. Require `url.origin === origin`. Return `pathname + search + hash`.)
- Move it to `src/lib/auth/safe-next.ts` and import it in the route (this lets the existing test run without `@supabase/ssr`)
- Modify: `src/lib/__tests__/phase43-auth.test.ts` (import from the new module)

- [ ] **Step 1: Write failing tests:** `safeNextPath("/\t/evil.example","/dashboard")==="/dashboard"`; the same for `"\n"`, `"\r"`; `safeNextPath("/quests?x=1","/d")==="/quests?x=1"`; `safeNextPath("https://evil","/d")==="/d"`; `safeNextPath("//evil","/d")==="/d"`.
- [ ] **Step 2:** Run. Expected: the tab, newline and carriage-return cases FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `fix(auth): reject control characters in post-auth redirects (BP-020)`.

### Task 2: Central error mapping (BP-021, BP-022)

**Files:**
- Create: `src/lib/errors.ts`: `toUserError(error: unknown, context: "matric" | "course" | "announcement" | "lecture" | "study" | "quest" | "generic"): string` and `logServerError(scope: string, error: unknown): string` (logs `{scope, code, message, ref}` and returns a short `ref` id such as `err_k3j9`)
- Test: `src/lib/__tests__/errors.test.ts`
- Modify: every `return { ok:false, error: error.message }` in `src/features/**/actions.ts`, `src/app/actions/*.ts`, `src/features/verification/actions.ts` → `toUserError(error, ctx)`, plus `logServerError`
- Modify: `src/app/actions/profile.ts:41-53` (delete the RLS-blind pre-check; rely on 23505 mapping)

**Mappings (exact copy):**
- `23505` + context `matric` → `"This matriculation number is already registered. Contact your course representative."`
- `23505` + `course` → `"A course with this code already exists."`
- `23505` + `lecture` → `"An identical session already exists for this course, date and time."`
- `23503` → `"This item is referenced elsewhere and cannot be removed."`
- `42501` → `"You do not have permission to perform this action."`
- `22P02` → `"The request contained an invalid identifier."`
- `23514` → `"Some values are outside the allowed limits."`
- default → `"Something went wrong. Please try again."`

- [ ] **Step 1: Write failing tests** for each mapping and for "message text is never returned verbatim" (`toUserError({code:"XX000",message:"secret detail"},"generic")` does not include `"secret"`).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement and replace the call sites (`grep -rn "error.message" src/features src/app/actions` must return no `return` lines afterwards).
- [ ] **Step 4:** Run `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit: `fix: map database errors to safe user messages (BP-021, BP-022)`.

### Task 3: Avatar pipeline (BP-026)

**Files:**
- Modify: `next.config.ts` (`images.remotePatterns: [{ protocol: "https", hostname: <host of NEXT_PUBLIC_SUPABASE_URL>, pathname: "/storage/v1/object/public/profile-pictures/**" }]`; for local dev also `http`/`127.0.0.1`)
- Create: `src/features/profile/avatar.ts`: `extensionForMime(mime: string): "jpg" | "png" | "webp" | "gif" | null`; `avatarObjectPath(userId: string, mime: string): string` (`${userId}/${crypto.randomUUID()}.${ext}`); `objectPathFromPublicUrl(url: string, bucket: "profile-pictures"): string | null`
- Test: `src/features/profile/__tests__/avatar.test.ts`
- Modify: `src/app/settings/profile/_components/profile-settings-client.tsx`: upload with the **browser** client (`supabase.storage.from("profile-pictures").upload(path, file, { contentType: file.type, upsert:false })`). Real states: idle, uploading, error, success. Then call a server action `setAvatarAction(path)` that verifies `path.startsWith(user.id + "/")`, updates `avatar_url`, deletes the previous object if it is in the same folder, and returns `ActionState`. The UI shows the results.
- Modify: `src/app/actions/profile.ts` (remove `uploadProfilePicture`; rewrite `deleteProfilePicture` with `objectPathFromPublicUrl`; null `avatar_url` even when the URL is not a storage URL)

- [ ] **Step 1: Write failing tests:** `extensionForMime("image/svg+xml")===null`; `avatarObjectPath("u1","image/png")` matches `/^u1\/[0-9a-f-]{36}\.png$/`; `objectPathFromPublicUrl("https://x.supabase.co/storage/v1/object/public/profile-pictures/u1/a.png","profile-pictures")==="u1/a.png"`; a Google URL → `null`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. Add an e2e test: upload a 4.5 MB PNG fixture → the avatar `img` is visible; upload again → `supabase.storage.list(uid)` (via the admin client in the test) returns 1 object; a 6 MB file shows the size error. Expected: PASS.
- [ ] **Step 5:** Commit: `fix(profile): direct avatar upload, cleanup and remote image config (BP-026)`.

### Task 4: Error boundaries and not-found (BP-031)

**Files:**
- Create: `src/app/error.tsx`, `src/app/global-error.tsx`, `src/app/not-found.tsx`, `src/app/{timetable,announcements,quests,admin/timetable,admin/announcements,admin/quests,admin/verifications,admin/courses}/error.tsx`, and matching `loading.tsx` for `timetable`, `announcements`, `quests`, `leaderboard`, `admin`
- Create: `src/components/shared/route-error.tsx` (client; props `{ title: string; reset: () => void }`; copy "We couldn't load this page." + "Try again")

- [ ] **Step 1: Write the failing e2e test** `e2e/errors.spec.ts`: `/this-does-not-exist` shows "Page not found"; with Supabase stopped (route intercept `**/rest/v1/announcements**` → 500), `/announcements` shows "We couldn't load this page."
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(ui): route error, loading and not-found boundaries (BP-031)`.

### Task 5: Accessibility pass (BP-036)

**Files:**
- Modify: every `<Link><Button/></Link>` (`admin/quests`, `admin/verifications`, `timetable/page.tsx`, `admin/*`) → `<Button render={<Link href=… />}>`; every unlabeled `<label>` → `<Label htmlFor>` + `id`; `dashboard/page.tsx:287` emoji → `<MapPin aria-hidden />` + text; distinct leaderboard icon (`Trophy` → `Medal` for Leaderboard, keep `Trophy` for Quests); `role="status" aria-live="polite"` on the study-planner toast region
- Modify: `package.json` (dev `@axe-core/playwright` pinned exact)
- Create: `e2e/a11y.spec.ts`

- [ ] **Step 1: Write the failing test:** for each of `/`, `/login`, `/dashboard`, `/timetable`, `/study-planner`, `/quests`, `/leaderboard`, `/admin`, `/admin/quests`, `/admin/verifications`: `const r = await new AxeBuilder({ page }).withTags(["wcag2a","wcag2aa"]).analyze(); expect(r.violations).toEqual([]);`
- [ ] **Step 2:** Run. Expected: FAIL (nested-interactive, label violations).
- [ ] **Step 3:** Fix the violations.
- [ ] **Step 4:** Run on both Playwright projects (desktop and mobile). Expected: PASS.
- [ ] **Step 5:** Commit: `fix(a11y): remove nested interactive elements and label inputs (BP-036)`.

### Task 6: Lagos-consistent dates (BP-037)

**Files:**
- Modify: all `toLocaleDateString` / `toLocaleString` call sites (`grep -rn "toLocale" src`, 6 occurrences) → `formatDisplayDate` / `formatTimestamp`
- Test: `src/lib/__tests__/no-local-date.test.ts` (reads every `.tsx` file under `src/app` and `src/components` with `fs`, and asserts that none contains `toLocaleDateString(` or `toLocaleString(`)

- [ ] **Step 1:** Write the test. Run. Expected: FAIL (6 hits).
- [ ] **Step 2:** Replace the call sites.
- [ ] **Step 3:** Run. Expected: PASS.
- [ ] **Step 4:** Commit: `fix(ui): format all dates in Africa/Lagos (BP-037)`.

### Task 7: Study planner range and validation parity (BP-038, BP-049)

**Files:**
- Create: `src/features/study-planner/range.ts`: `rangeForView(view: "daily"|"weekly"|"monthly"|"status", anchor: string): { start: string; end: string }` (daily: anchor±0; weekly: Monday–Sunday of anchor; monthly: first–last day of anchor's month; status: anchor−60 to anchor+120)
- Create: `src/app/study-planner/data/route.ts` or a server action `loadStudyRange(start, end)` (validates a range ≤ 190 days)
- Modify: `study-planner-container.tsx` (fetch when the anchor leaves the loaded range; loading indicator)
- Modify: `src/features/study-planner/actions.ts` (Zod `studySessionSchema` shared by create, update and reschedule: title 1–150, notes ≤1000, location ≤120, course id uuid or null; toggle and reschedule use `.select("id").maybeSingle()` and return "Study session not found." when null)
- Test: `src/features/study-planner/__tests__/range.test.ts`, `…/schema.test.ts`

- [ ] **Step 1: Write failing tests:** `rangeForView("monthly","2026-02-14")` deep-equals `{start:"2026-02-01",end:"2026-02-28"}`; `rangeForView("weekly","2026-11-26")` deep-equals `{start:"2026-11-23",end:"2026-11-29"}`; the schema rejects notes of 1001 characters.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. Add an e2e test: navigate to a date 60 days ahead that has a seeded session → the session is visible. Expected: PASS.
- [ ] **Step 5:** Commit: `fix(study-planner): load data for the viewed range; consistent validation (BP-038, BP-049)`.

### Task 8: Announcement limits (BP-050)

**Files:**
- Create: `supabase/migrations/028_announcement_limits.sql`: CHECKs `length(title) between 1 and 160`, `length(content) between 1 and 5000`. Add them `not valid`, then `validate` after a pre-check `do` block that raises with a list of the offending ids if any exist.
- Modify: `src/features/announcements/validation.ts` (`announcementSchema` Zod with the same limits; used by create and update)
- Test: `supabase/tests/database/100_announcement_limits.test.sql`; `src/lib/__tests__/phase4.test.ts` (extend)

- [ ] **Step 1: Write failing tests:** the DB insert of a 161-character title → `23514`; the schema rejects 161 and accepts 160.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `fix(announcements): enforce title and content limits (BP-050)`.

### Task 9: Auth page redirects and message codes (BP-039, BP-040)

**Files:**
- Create: `src/lib/auth/messages.ts`: `AUTH_MESSAGES: Record<"oauth_cancelled"|"account_exists"|"link_expired"|"signin_failed"|"password_updated"|"not_configured", string>`; `messageFromCode(code: string | undefined): string | null`
- Modify: `src/app/auth/confirm/route.ts` (redirect with `?error=<code>` instead of free text; `formatOAuthError` returns a code)
- Modify: `src/app/login/page.tsx`, `src/app/register/page.tsx` (move `redirect("/dashboard")` **outside** `try/catch`: compute `user` inside the try, redirect after it); render `messageFromCode`
- Modify: `src/app/actions/auth.ts:71-75` (`?message=password_updated`)
- Test: `src/lib/auth/__tests__/messages.test.ts`

- [ ] **Step 1: Write failing tests:** `messageFromCode("oauth_cancelled")` is a non-empty string; `messageFromCode("<script>")===null`; `messageFromCode(undefined)===null`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. Add an e2e test: a logged-in user visiting `/login` ends at `/dashboard`; `/login?error=<b>hi</b>` shows no injected text. Expected: PASS.
- [ ] **Step 5:** Commit: `fix(auth): logged-in redirects and allow-listed auth messages (BP-039, BP-040)`.

### Task 10: Security headers, push-route validation, dependency and type hygiene (BP-047, BP-053, BP-055)

**Files:**
- Create: `src/lib/security/csp.ts`: `buildCsp(opts: { supabaseUrl: string; extraFrameSrc?: string[]; extraScriptSrc?: string[]; extraImgSrc?: string[] }): string`. Baseline: `default-src 'self'`; `script-src 'self' 'unsafe-inline'` (tighten to nonces once the Next 16 docs confirm support); `connect-src 'self' <supabase> wss://<supabase-host>`; `img-src 'self' data: blob: <supabase>`; `frame-src 'none'` (P8/P9 extend); `frame-ancestors 'none'`; `base-uri 'self'`; `form-action 'self' https://accounts.google.com <supabase>`.
- Modify: `next.config.ts` `headers()`: CSP, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Strict-Transport-Security` (production only)
- Modify: `src/app/api/push/subscriptions/[id]/route.ts` (validate `id` with `z.string().uuid()` → 400). `route.ts` POST: when the endpoint belongs to another user, reassign it to the current user (delete the old row, insert new) instead of returning 409.
- Modify: `package.json` (move `shadcn` to devDependencies; replace the `cn` package with `clsx` + `tailwind-merge`, pinned exact, in `src/lib/utils.ts` as `cn(...inputs) = twMerge(clsx(inputs))`, and update the `from "cn"` imports to `@/lib/utils`)
- Create: `src/types/database.ts` via `supabase gen types typescript --local > src/types/database.ts`; add script `"db:types"`; type the clients `createServerClient<Database>` / `createBrowserClient<Database>` / `createClient<Database>`
- Modify: `src/config/site.ts` (`url` from `NEXT_PUBLIC_SITE_URL`)
- Test: `src/lib/security/__tests__/csp.test.ts`; `src/app/api/push/subscriptions/__tests__/id-validation.test.ts` (pure `parseDeviceId`)

- [ ] **Step 1: Write failing tests:** `buildCsp({supabaseUrl:"https://x.supabase.co"})` contains `frame-ancestors 'none'`, `connect-src 'self' https://x.supabase.co wss://x.supabase.co` and `frame-src 'none'`; `parseDeviceId("abc")===null`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Run `npm run db:types && npm run typecheck` and fix the type errors the generated types reveal.
- [ ] **Step 4:** Run `npm test && npm run build && npm run e2e -- --trace off` (all suites, so the CSP breaks nothing). Expected: PASS.
- [ ] **Step 5:** Commit: `chore(security): CSP and headers, typed Supabase clients, dependency hygiene (BP-047/053/055)`.
