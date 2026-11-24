# Secrets Rotation Log

**Never write secret values in this file.** Record only what was rotated, where, when and by whom.

| Secret | Locations | Rotated on | By | Status |
|---|---|---|---|---|
| `CRON_SECRET` | Vercel `cess30` (Production + Preview); Supabase Vault `notifications_cron_secret` | 2026-11-24 | Claude session, at the owner's request | **ROTATED** (new 40-byte random value; old value no longer valid). Takes effect in Vercel on the next deploy. |
| `VAPID_PRIVATE_KEY` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Host environment | – | – | OPEN, rotate if any doubt (rotating invalidates existing push subscriptions) |
| `SUPABASE_SERVICE_ROLE_KEY` | Host environment (server-only) | – | – | OPEN, confirm never exposed |
| Google OAuth client secret | Supabase Auth provider settings | – | – | OPEN, confirm never exposed |

## Procedure: `CRON_SECRET`

1. Generate a new value of at least 32 random bytes: `openssl rand -base64 48`.
2. Update the host environment variable `CRON_SECRET` and redeploy.
3. Update the Supabase Vault secret `notifications_cron_secret` to the same value.
4. Check that the next scheduled run returns 200: `select status_code from net._http_response order by created desc limit 1;`
5. Fill in the table above.
