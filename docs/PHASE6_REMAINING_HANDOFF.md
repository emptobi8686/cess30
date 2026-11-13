# Phase 6 Notifications/PWA — Remaining Work Handoff

Updated: 2026-11-12

This handoff records the local implementation state and the remaining work. The repository root is `C:\Users\EMMYBASH\cess30\cess30`. Continue from the existing files; do not re-implement completed pieces or overwrite unrelated working-tree changes.

## Current status

Phase 6 is implemented locally but is **not ready to deploy**. Migration 013 has not been applied to Supabase, and live database, browser push, cron, and PWA behavior have not been verified.

### Validation completed

- `npm test`: **125 passed, 0 failed** (re-confirmed after the web-push fix below).
- `npx tsx --test src/lib/__tests__/notifications.test.ts`: **7 passed, 0 failed**.
- ESLint on changed Phase 6 source files: passed.
- `npm run typecheck`: fails only on two **pre-existing** import errors, no Phase 6 type errors introduced:
  - `src/app/actions/profile.ts`: imports `revalidatePath` from `next/navigation`.
  - `src/features/study-planner/actions.ts`: imports `revalidatePath` from `next/navigation`.
- `npm run build`: **Turbopack compiles successfully**, then fails the Next.js type-check step solely on the two pre-existing `revalidatePath` errors above (not Phase 6). Build is blocked until those are fixed or the task is extended to fix them.

### Build fix applied (this session)

- `src/lib/notifications/push.ts:3`: changed `import webPush from "web-push"` to `import * as webPush from "web-push"`. web-push v4 is ESM with named exports only and has no default export, which was the sole Turbopack compile error (`./src/lib/notifications/push.ts:3:1 — Export default doesn't exist in target module`).

### Code and SQL review findings (migration 013, delivery, claim/retry, preferences, push cleanup)

- Migration 013 schema, grants, RLS policies, triggers, and `claim_pending_notification_pushes` are internally consistent and match `supabase/tests/rls_scenarios.sql`. Authenticated role has no INSERT grant on `notifications`, update is column-limited to `is_read`/`read_at`, and `push_subscriptions` is not exposed to authenticated clients — matching the scenarios' expected rejections.
- `dedupe_key` is globally unique; reminder keys embed the user id (`lecture:<id>:<user>:<minutes>`, `study:<id>:<user>:<minutes>`), so no cross-user dedupe collisions.
- `push_attempt_count` check is `between 0 and 4`; the claim RPC filters `push_attempt_count < 4`, giving a maximum of 4 delivery attempts per notification.
- Quiet hours are evaluated in `Africa/Lagos`; `push_expires_at` equals lecture start for reminders and `null` for announcements (no expiry).
- `claim_pending_notification_pushes` is `security definer`, executable only by `service_role`, and uses `for update skip locked`.
- Push delivery: HTTP 404/410 removes the subscription; transient failures increment `failed` and retain the subscription; `disabled` is terminal (not retried). `last_used_at` is updated on each successful send.
- Preference writes go through the service-role admin client (no authenticated insert/update grant on `notification_preferences`).
- Notification read/delete use the server client scoped by `user_id = auth.uid()`.
- `getAnnouncementRecipients` hardcodes department `"Civil Engineering"` and level `"200"` for the department/level scopes — a documented pilot cohort assumption, not general enrollment-based targeting. Latent limitation if announcements for other departments/levels are added.

The last reported dependency installation had 13 npm audit findings (2 low, 11 moderate). No audit remediation was attempted.

## Implemented locally

- Migration `supabase/migrations/013_notifications.sql`: notification inbox, per-user preferences, server-only push subscriptions, RLS/grants, delivery state, deduplication, and a service-role claim RPC.
- `supabase/tests/rls_scenarios.sql`: manual ownership and privilege checks for the notification tables. These scenarios have not been executed against a live database.
- Notification actions, queries, reminder generation, cohort targeting, push dispatch, cron route, subscription APIs, notification menu/centre, preferences and device-management UI.
- PWA manifest, offline fallback, service worker, logo icons, service-worker registration, install prompt, and install/settings UI.
- Announcement notification controls and admin delivery statistics.
- `docs/NOTIFICATIONS_SETUP.md`: environment, VAPID, Supabase Vault/Cron, and manual verification steps.
- `AI_HANDOFF.md` was updated with the current migration and Phase 6 status.

Course announcements intentionally target the department/level cohort matching the course, not true enrollment membership; no enrollment table exists. Reminder dates and quiet hours use `Africa/Lagos`. Push messages are generic and do not include schedule details. The service worker does not cache authenticated pages, API responses, or Supabase data.

## Next steps

1. **Production build** — Turbopack compiles successfully; the build is blocked only by the two pre-existing `revalidatePath` type-check errors in `src/app/actions/profile.ts` and `src/features/study-planner/actions.ts`. These are not Phase 6 errors. Do not mask them; fix them separately or extend the task to fix them. No Phase 6 build failures remain.
2. **Code and SQL review complete** — migration 013, the reminder/claim/retry flow, preference writes, and push-device cleanup reviewed; RLS test scenarios match the actual grants and constraints. See review findings above.
3. **Lint/tests/typecheck complete** — ESLint passed, `npm test` 125/125, notification tests 7/7, `tsc --noEmit` shows only the two known pre-existing imports (no new Phase 6 errors).
4. **Migration 013 applied to remote Supabase project `keshrmnrobarrdkhyqjt`** — confirmed via `supabase migration list` (all migrations `001`–`013` in sync, remote `013 | 013`). Approval was granted; normal `supabase db push` workflow used.
5. **Production environment + VAPID configured locally** — `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, and `CRON_SECRET` added to `.env.local`. `SUPABASE_SERVICE_ROLE_KEY` not set (obtain from Supabase Dashboard → Settings → API; never commit). Mirror `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `CRON_SECRET` to the production hosting environment.
   - **Dashboard-only (Vault)**: add `notifications_app_url` = `https://<production-host>/api/cron/notifications` and `notifications_cron_secret` = the same value as `CRON_SECRET` via Supabase Dashboard → Integrations → Vault. No CLI Vault subcommand exists.
   - **Dashboard-only (extensions + scheduler)**: enable `pg_cron` and `pg_net` extensions via Dashboard → Database → Extensions, then run `supabase/schedule_notifications.sql` once in the SQL Editor to schedule `blueprint-notification-dispatch`. The cron endpoint must use the same `CRON_SECRET` as the deployment.
6. With real student/admin test accounts, execute `supabase/tests/rls_scenarios.sql`; verify notification ownership, preference writes, announcement cohort targeting, device add/remove (including browser unsubscribe), reminder timing, quiet hours, push retry/expiration behavior, and admin stats.
7. Test install/offline behavior and service-worker cache boundaries in a browser over HTTPS. No browser page was shared during the prior validation.
8. Update this file and `AI_HANDOFF.md` with verified results and any deployment-only work still outstanding.

## Key files

- `supabase/migrations/013_notifications.sql`
- `supabase/tests/rls_scenarios.sql`
- `supabase/schedule_notifications.sql`
- `src/lib/notifications/delivery.ts`
- `src/lib/notifications/push.ts`
- `src/app/api/cron/notifications/route.ts`
- `src/app/api/push/subscriptions/route.ts`
- `src/app/api/push/subscriptions/[id]/route.ts`
- `src/features/notifications/actions.ts`
- `src/features/notifications/queries.ts`
- `src/components/shared/notifications/`
- `src/lib/__tests__/notifications.test.ts`
- `docs/NOTIFICATIONS_SETUP.md`

## Safety and deployment gates

- Keep `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, and `CRON_SECRET` server-only; never commit real values.
- Do not enable the cron job until the production endpoint and its bearer secret are configured.
- Do not claim successful live RLS, push, cron, or browser verification from local tests.
- Do not apply migration 013 to the linked production database without explicit approval.
