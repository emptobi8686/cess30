# BLUEPRINT — Architecture and Codebase Map

**Audit date:** 2026-11-23

## 1. Repository integrity (Stage 1)

| Item | Observation |
|---|---|
| Remote | `origin` → `github.com/emptobi8686/cess30` (GitHub is the canonical source, as intended) |
| Branches | `master` and `claude/upbeat-lovelace-rot6of` (both at `4561810`); remotes for both |
| Working tree | Clean at audit start |
| History | **5 commits total.** 9f25d14 (13 Nov, bulk import of phases 1–6, message truncated), b976f3a "..", 2ebb212 "..", ecfea5a "...", 4561810 "..". Four of the five commit messages carry no information. |
| Tracked files | 185 (application, migrations, docs, `package-lock.json`) |
| Ignored but referenced | `.gitignore` lists `AI_HANDOFF.md` (three times), `docs/PHASE_7_5_DEPLOYMENT_GUIDE.md` and `docs/VERIFICATION_SECURITY_TESTING.md`. `AI_HANDOFF.md` is still tracked. The two docs referenced by the handoff **are not in the repository**. |
| `node_modules` | **Not present.** Install was prohibited, so build, lint, typecheck and most tests could not run (see the Testing report). |
| CI | None (`.github/` absent) |
| Hosting config | None (no `vercel.json`, Dockerfile, or `app.yaml`) |
| Completeness verdict | The repository contains the application and migrations. It does **not** contain the "Phase 3 seven-batch" fixes reported earlier (see the Master report §4). Either they were never committed, or they live in an unpushed local copy. **The GitHub repository is not a complete record of the reported work.** |

## 2. Technology stack (actual vs expected)

| Layer | Expected | Actual (`package.json`) | Divergence |
|---|---|---|---|
| Framework | Next.js 16 App Router | `next 16.4.6` | Uses `middleware.ts`. Next 16 introduced the `proxy` convention; whether `middleware` is deprecated in 16.4.6 could not be checked because the bundled docs in `node_modules/next/dist/docs` are not installed (BP-054, unverified). |
| React | 19 | `19.3.0` | – |
| TypeScript | 5 | `^5`, `strict: true` | – |
| Styling | Tailwind 4 | `tailwindcss 4.3.3` via the turbopack loader | – |
| UI | shadcn/ui + Base UI + Lucide | `shadcn 4.23.0` (**runtime dependency**; it is a CLI), `@base-ui/react ^1.9.0`, `lucide-react` | `cn` helper is imported from npm package `cn@0.5.2` instead of the usual clsx + tailwind-merge. Tailwind class conflicts are **not merged** (no tailwind-merge). |
| Backend | Supabase (Auth, PG, Storage, RLS, RPC) | `@supabase/ssr 0.12.7`, `supabase-js 2.119` | – |
| Validation | Zod 4 | `zod ^4.6.7`, used only in env config, push API and notification actions. **Most server actions hand-validate.** | Partial |
| Tests | node:test via `tsx --test` | Same. **Vitest and Playwright are still not configured.** | – |
| Push | web-push | `web-push 4.0.0` | – |

## 3. Directory map

```
middleware.ts                 Session guard (protected paths) and admin guard (/admin)
next.config.ts                Turbopack CSS loader only (no images, headers or serverActions config)
public/
  sw.js                       Stripped service worker: install/activate only (no fetch, push or click)
  manifest.webmanifest        Name, icons (192, 512 maskable), start_url=/dashboard
  offline.html                Unused (no SW fetch handler)
src/
  app/                        Routes (see §4)
    actions/auth.ts           signOut, updatePassword (server actions)
    actions/profile.ts        submitMatricNumber, updateProfile, getProfile, upload/deleteProfilePicture
    api/cron/notifications    POST, Bearer CRON_SECRET → reminders + push dispatch
    api/push/subscriptions    GET/POST/DELETE (+ [id] DELETE) via service role
    auth/{callback,confirm}   PKCE code exchange, token_hash verifyOtp, safeNextPath
  components/
    ui/                       shadcn (Base UI) primitives
    shared/                   Shells, forms, tables, notifications UI, study planner UI, PWA
  config/site.ts              siteConfig (url "https://blueprint.local", used as metadataBase)
  features/
    announcements/            queries, actions, validation
    dashboard/queries.ts      getCourses
    notifications/            actions (prefs, read, delete), queries (+ admin stats)
    quests/                   queries, actions, validation, tests
    study-planner/            queries, actions, validation
    timetable/                queries, actions, validation, tests
    verification/             queries (admin queue), actions (approve/reject)
  lib/
    supabase/{client,server,admin,auth,role,config}.ts
    notifications/{delivery,push,targeting,time,validation}.ts
    dates.ts                  Canonical Africa/Lagos date utilities (well designed)
    verification.ts, password.ts, auth.ts (browser auth helpers), utils.ts
  types/index.ts              Hand-written DB row types (no generated Supabase types)
supabase/
  migrations/001–019, seed/, tests/ (manual SQL), schedule_notifications.sql, config.toml
```

### Supabase clients

| Client | File | Key | Used by |
|---|---|---|---|
| Browser | `lib/supabase/client.ts` | anon | Auth forms, notifications menu (realtime), reset-password |
| Server (RLS) | `lib/supabase/server.ts` | anon + user cookies | Pages, server actions |
| Middleware / callback | inline `createServerClient` | anon + cookies | `middleware.ts`, `auth/confirm/route.ts` |
| Admin | `lib/supabase/admin.ts` (`server-only`) | **service role** | Notification fan-out, push, device APIs, admin quest queries, notification stats |

### Data access pattern

Pages are async Server Components that call `features/*/queries.ts`. Mutations use `"use server"` modules in `features/*/actions.ts` and return `ActionResult`. Client components call actions through `useActionState` or `startTransition`. There are no generated Supabase types; row types are hand-maintained in `src/types/index.ts`, so drift is undetectable at compile time (for example, `LectureRow.courses` is typed as an array but PostgREST returns an object, which causes BP-012).

## 4. Route inventory

Legend: L = `loading.tsx`, E = `error.tsx`. Status: ✅ works as designed (statically) · ⚠️ partial or defective · ❌ broken or missing.

| Route | Purpose | Access (enforced) | Main components | Data sources | Actions / APIs | Validation | L / Empty / E | Tests | Status | Key concerns |
|---|---|---|---|---|---|---|---|---|---|---|
| `/` | Landing | Public | `page.tsx`, `public-navigation` | none | – | – | –/–/– | none | ✅ | Clearly states it is not official UNILAG software |
| `/login` | Email + Google login | Public | `login-form.tsx` | – | `lib/auth.ts` | client | –/–/– | none | ⚠️ | Logged-in redirect swallowed (BP-039); reflected `?error` (BP-040) |
| `/register` | Sign-up | Public | `register-form.tsx` | – | `signUpWithEmail` | client (min 8) | –/–/– | none | ⚠️ | Metadata trusted (BP-018); raw DB error on duplicate matric |
| `/reset-password` | Request reset | Public | `reset-password-form.tsx` | – | `resetPasswordForEmail` | client | –/–/– | none | ✅ (email delivery unverified) | – |
| `/reset-password/update` | Set new password | Recovery session | `update/page.tsx` | – | `updatePassword` | `validateNewPassword` | –/–/– | password.test | ✅ statically | Raw auth error passthrough |
| `/access-denied` | Denial page | Public | – | – | – | – | – | none | ⚠️ | Generic text; no suspended state |
| `/auth/callback`, `/auth/confirm` | OAuth/OTP handling | Public | `route.ts` | Supabase Auth | – | `safeNextPath` | – | phase43 (blocked) | ⚠️ | Open redirect (BP-020) |
| `/dashboard` | Student overview | Session | `DashboardShell`, `VerificationBanner`, `TodaySessionsList` | profiles, lectures, announcements, study sessions | `submitMatricNumber` | partial | L/✅/E | none | ⚠️ | No quests, XP or notifications on the dashboard (spec 5.2); `nickname` column requires 014; no verification gate |
| `/timetable` | Weekly or agenda view | Session | `timetable-grid` | `lecture_sessions` | – | week offset clamped ±520 | –/✅/– | dates tests | ✅ | No verification gate |
| `/study-planner` | Personal planner | Session | `study-planner-container` and dialogs | study + lecture sessions, courses | create, update, delete, toggle, reschedule | `features/study-planner/validation.ts` | L/✅/E | phase5 | ⚠️ | Fixed −14/+28 day window (BP-038) |
| `/announcements` | Published announcements | Session | page | `announcements` | – | – | –/✅/– | phase4 | ⚠️ | Scope ignored (BP-019) |
| `/notifications` | Inbox | Session | `notification-centre` | `notifications` | mark read, delete | zod uuid | L/✅/E | notifications | ✅ | – |
| `/settings` | Settings hub, PWA install | Session | `PwaInstallCard` | – | – | – | –/–/E | none | ✅ | – |
| `/settings/profile` | Profile, avatar, matric | Session | `profile-settings-client` | `getProfile` | profile actions | partial | –/–/E (parent) | none | ⚠️ | BP-021, BP-026, no history view |
| `/settings/notifications` | Preferences and devices | Session | prefs form, `push-device-settings` | prefs, devices (service role) | `updateNotificationPreferences`, push API | zod | –/–/E | notifications | ⚠️ | Throws when the prefs row is missing (BP-048); push non-functional (BP-011) |
| `/quests` | Quests and submission | Session | page and `Dialog` | quests, submissions, xp_ledger | `submitQuestAction` | `validateSubmitQuestInput` | –/✅/– | quests validation | ❌ | Requires 018 (tables missing); plain function passed as form action (BP-009); no feedback |
| `/leaderboard` | XP rankings | Session | page | `get_leaderboard` RPC ×4 | – | – | –/✅/– | none | ❌ | RPC broken (BP-004); no fallback; decorative period buttons |
| `/admin` | Admin overview | Admin | `AdminShell`, `StatCard` | counts; service-role stats | – | – | –/–/– | none | ⚠️ | `[object Object]` (BP-025); crashes without service key |
| `/admin/courses` | Catalogue | Admin | page | `courses` | **none** | – | –/✅/inline | none | ⚠️ | Read-only (BP-030) |
| `/admin/timetable` | Lecture CRUD | Admin | `admin-sessions-table`, `lecture-session-form` | `lecture_sessions` | create, update, cancel, restore, delete | `features/timetable/validation.ts` + conflict checks | –/✅/– | timetable tests | ✅ statically (BP-006 aside) | No recurrence; raw errors |
| `/admin/announcements` | Announcement CRUD | Admin | `admin-announcements-table`, `announcement-form` | `announcements` | create, update, publish, unpublish, delete | scope only | –/✅/– | phase4 | ⚠️ | No length limits (BP-050) |
| `/admin/quests` | Quest CRUD and review | Admin | page | service-role queries | create, update, review | partial | –/✅/– | quests validation | ❌ | BP-008, BP-009, BP-013, BP-028 |
| `/admin/verifications` | Matric review | Admin | page | `profiles` | approve, reject | reason ≥12 | –/✅/– | verification tests (logic only) | ⚠️ | No feedback, no suspend or restore, injection-prone search (BP-041/042) |
| `POST /api/cron/notifications` | Scheduler | Bearer secret | route | service role | – | – | – | none | ⚠️ | Lecture reminders never generated (BP-012); infrastructure not configured |
| `GET/POST/DELETE /api/push/subscriptions` | Device registration | Session + same origin | route | service role | – | zod | – | none | ✅ statically | SW cannot display pushes (BP-011) |
| `DELETE /api/push/subscriptions/[id]` | Remove device | Session + same origin | route | service role | – | zod body; **id not validated** | – | none | ⚠️ | BP-047 |

**No additional routes** were found beyond the spec list. There is **no root `error.tsx`, `global-error.tsx` or `not-found.tsx`.** Error boundaries exist only for dashboard, notifications, settings, settings/notifications and study-planner.

## 5. Notable architectural strengths

- `lib/dates.ts` and `lib/notifications/time.ts` handle Africa/Lagos time explicitly (UTC calendar arithmetic plus `Intl` with a timeZone). Their 26 tests passed in this audit.
- The service-role client is isolated behind `server-only`.
- The notification pipeline has a sound design: dedupe keys, `for update skip locked` claiming, bounded batches, expiry, quiet hours, and stale-subscription cleanup on 404/410.
- Timetable admin actions perform conflict detection (duplicate, course overlap, venue overlap with an override).
- Atomic review RPCs use row locks.

## 6. Architectural weaknesses

- **Schema and code drift.** The code targets migrations that cannot be applied (DB audit §5).
- Authorization helpers are duplicated (`requireAdminSession` ×4) and built on a defective role resolver.
- There are no generated DB types, so relation-shape bugs (BP-012) are invisible to `tsc`.
- Some server components pass non-action closures to forms (BP-009), and actions swallow errors into `console.error`.
- Validation is inconsistent: zod in a few places, ad-hoc checks elsewhere, none for some inputs.
