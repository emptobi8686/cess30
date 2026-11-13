# Notifications and PWA setup

Phase 6 adds an authenticated in-app notification centre, user notification preferences, Web Push device management, scheduled lecture/study reminders, announcement notifications, and an installable PWA.

## Important behavior and assumptions

- Notification dates, times, and quiet hours use `Africa/Lagos`.
- Course-scoped announcements target profiles whose department and level match the course. This is a cohort approximation, not enrollment-based targeting; the app currently has no enrollment table.
- Push payloads are generic and do not include timetable or study-session details.
- The service worker caches only the manifest, icons, and offline page. It does not cache authenticated pages, API responses, or Supabase data.
- Browser push requires HTTPS in production (localhost is allowed for development) and a browser that supports Push API and service workers.

## Environment configuration

Configure these values in the deployment environment and locally in `.env.local` as needed:

| Variable | Use |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key |
| `NEXT_PUBLIC_SITE_URL` | Canonical app URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only access for notification delivery; never expose or prefix with `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Public VAPID key used by the browser to subscribe |
| `VAPID_PRIVATE_KEY` | Server-only VAPID private key |
| `VAPID_SUBJECT` | VAPID contact URI, for example `mailto:admin@example.com` |
| `CRON_SECRET` | Long random bearer secret used to authorize the scheduled route |

Generate a VAPID key pair with `npx web-push generate-vapid-keys`. Put the public key in `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and the private key in `VAPID_PRIVATE_KEY`. Do not commit generated keys or include the private key in client code.

## Database migration and scheduler

Migration `013_notifications.sql` must be applied before using notification pages or APIs. It has not been applied to the live Supabase project. Review it and get explicit approval before applying it to production. After approval, use the project's normal migration workflow (for example, `npx supabase db push`) and confirm the remote migration list.

Scheduled reminders use Supabase Cron to call `/api/cron/notifications` once per minute. Configure the production application URL and the exact same `CRON_SECRET` in Supabase Vault:

1. In the Supabase Dashboard, open **Integrations → Vault** and add two secrets:
   - Name: `notifications_app_url`; value: `https://<production-host>/api/cron/notifications`
   - Name: `notifications_cron_secret`; value: the deployment's `CRON_SECRET`
2. Review and run `supabase/schedule_notifications.sql` once in the Supabase SQL Editor. It enables `pg_cron` and `pg_net`, then schedules the authenticated HTTP call.
3. Confirm the `blueprint-notification-dispatch` job is enabled and inspect its run history and the deployment logs.

The job runs every minute in UTC. The endpoint converts academic schedule times and quiet hours to `Africa/Lagos`. Do not place the cron secret in a URL, source file, or browser-visible setting. The endpoint processes a bounded batch and is safe to invoke repeatedly.

## User and admin verification

After migration and environment setup:

1. Sign in as a student, open **Settings → Notifications**, and save preferences.
2. Subscribe a supported browser/device, then verify it appears in the device list. Remove it and confirm the browser subscription is unsubscribed as well.
3. Create a future lecture or study session with a reminder and verify the inbox notification and optional push at the configured lead time. Test quiet hours separately.
4. Publish an announcement with notifications enabled. For a course announcement, verify only the matching department/level cohort is targeted.
5. Sign in as an admin and check notification delivery statistics in the admin overview.
6. Run `supabase/tests/rls_scenarios.sql` and the notification ownership scenarios using separate student identities. Do not treat service-role access as evidence that user-facing RLS is correct.
7. Test PWA installation and offline fallback over HTTPS. Confirm authenticated pages and API responses are not served from the service-worker cache.

Push delivery and scheduled jobs require live credentials and browser/device testing; local unit tests alone do not verify those integrations.
