# BLUEPRINT — Performance and Maintainability

**Audit date:** 2026-11-23 · **Method:** static. No build could be produced (dependencies absent), so **bundle size, render timings and Lighthouse metrics are UNVERIFIED.** Pilot scale is small (one cohort, roughly 100–200 users), so the observations below are about correctness and future cost rather than measured bottlenecks.

## 1. Query patterns

| Location | Pattern | Impact at pilot scale | Recommendation |
|---|---|---|---|
| `leaderboard/page.tsx:44-51` | 4 calls to `get_leaderboard` (all-time fetched twice) plus a separate XP summary query | Low | Fetch one period from `searchParams` |
| `features/timetable/queries.ts:15-21` | `get_lagos_date` RPC round trip per query function. The dashboard calls two such functions, so two RPCs. | Low | Compute the Lagos date once in the app (`lib/dates.ts` already does this correctly) |
| `lib/notifications/delivery.ts:76-111` | The cron route loads **all profiles and all preferences** every minute, then filters in memory | Fine for 200 users. Grows O(users × lectures). | Move targeting into SQL (join plus filter) when scaling |
| `lib/notifications/push.ts:189-206` | Sequential `await` per notification and per subscription | Fine for small batches. A single throw aborts the batch. | Use `Promise.allSettled` with concurrency limits and per-item error isolation |
| `admin/page.tsx` | About 10 queries, mostly parallel | Low | – |
| `admin/quests/page.tsx:85-98` | Separate profile lookup for names (no FK to profiles) | Low | Add an FK or a view |
| `features/verification/queries.ts:51-62` | Three count queries plus the list; no pagination | Low now | Add pagination before cohorts grow |
| `study-planner/page.tsx:18-25` | Fixed 6-week window (functional bug, BP-038) | – | Range-based fetching by view |

No N+1 loops issuing queries per row were found in the request path. Indexes match the main access paths (user/date for study sessions, date/cancelled for lectures, notification user/created).

## 2. Rendering and client boundaries

- Pages are Server Components with `force-dynamic` (appropriate for per-user data). No caching layer is used, which is acceptable at this scale.
- `DashboardShell` is a full client component (`"use client"`) wrapping every student page, and includes `NotificationsMenu` with a realtime subscription. This is acceptable, but every page ships the shell JavaScript plus the Supabase browser client.
- `study-planner-container.tsx` (722 lines) is a large client component with all views and dialogs. It would benefit from splitting by view.
- `next/image` with `priority` is used for small avatar and logo images on every page. `blueprint-logo.png` is **982 KB** in `public/images/`, so the optimiser handles it but the source should be compressed. `icon-512.png` is 379 KB.

## 3. Maintainability findings

| ID | Finding | Location | Impact |
|---|---|---|---|
| — | `requireAdminSession` duplicated in 4 modules, all built on the buggy `getCurrentUserRole` | features/*/actions.ts | A fix must be repeated; risk of drift |
| — | No generated Supabase types; hand-written `types/index.ts` | – | Relation-shape and column drift go unnoticed (caused BP-012). Run `supabase gen types`. |
| — | Validation is inconsistent (zod, ad-hoc or none) | actions | Gaps like BP-028 and BP-050 |
| BP-022 | Error handling is inconsistent: raw `error.message`, `console.error` only, or generic text | actions | UX and security |
| BP-055 | `shadcn` CLI (with transitive deps including `@modelcontextprotocol/server`, `execa` and `ts-morph`) is in **runtime** `dependencies` | package.json | Larger install and attack surface. Move it to devDependencies. |
| BP-055 | `cn@0.5.2` used as the class helper instead of clsx + tailwind-merge; conflicting Tailwind classes are not merged | `lib/utils.ts` | Styling surprises |
| BP-055 | Dead code: `PwaServiceWorkerRegistration` (unmounted; now *unregisters* SWs), `offline.html`, `record_profile_verification_decision()` | – | Confusion |
| — | Boilerplate assets (`next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg`) and the default `README.md` | public/, README | Documentation quality |
| — | `siteConfig.url = "https://blueprint.local"` used as `metadataBase` | `config/site.ts:8`, `layout.tsx:24` | Wrong absolute URLs in OG and metadata |
| — | Non-descriptive commits ("..", "...") | git log | No traceability of fixes |
| — | Inline comments claim protections that do not exist (e.g. 016 "revoked direct INSERT" on history, "Prevent self-review" above an unrelated check in 018:353) | migrations | Misleading future maintainers |

## 4. Logging and observability

- Server logs record only `error.name` or `code` (good for secrets, poor for diagnosis). There is no request or correlation id.
- No error monitoring (Sentry or similar), no structured logging, no metrics.
- Cron runs return counts in the JSON response, but nothing persists run history. A failing scheduler would go unnoticed.

## 5. Dependency health

The lockfile pins `next 16.4.6`, `react 19.3.0`, `@supabase/ssr 0.12.7` and `web-push 4.0.0`. `npm audit` could not be run without a network-enabled install. **Dependency vulnerability status is UNVERIFIED.**
