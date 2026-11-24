# BLUEPRINT — Deployment Readiness

**Audit date:** 2026-11-23 · **Hosting provider:** not selected (per brief). Nothing was assumed to be configured. Vercel was **not queried**. The Supabase MCP returned **no projects**, so the remote database state is unknown.

## 1. Environment variables

From `.env.example` and their uses in source (values were not read or printed).

| Variable | Scope | Used in | Required for | Notes |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | all clients, middleware | everything | – |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | all clients | everything | Middleware redirects to `/access-denied` if missing |
| `NEXT_PUBLIC_SITE_URL` | public | `lib/auth.ts` redirect URLs | OAuth, email links | Must match the Supabase Auth redirect allow-list |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only** | `lib/supabase/admin.ts` | notifications, push, device APIs, **admin overview, admin quests** | Not set locally (per handoff), so `/admin` and `/admin/quests` throw |
| `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | server-only | `lib/notifications/push.ts` | push dispatch | – |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | public | push subscribe UI and server | push | – |
| `CRON_SECRET` | server-only | cron route | scheduler | **Treat as compromised (historical exposure). Rotate before any deployment**, both in the host environment and in Supabase Vault `notifications_cron_secret`. |
| Google OAuth client id/secret | Supabase dashboard | – | Google sign-in | Not in the app env (correct) |

No secret values were found in tracked files or git history (Security doc BP-057).

## 2. Readiness checklist

| Item | Status | Evidence / gap |
|---|---|---|
| Complete Git repository | ⚠️ | Code present. Reported Phase 3 work absent. Commit hygiene poor. |
| Valid production build | **UNVERIFIED** | Not buildable here (no deps). BP-009 is a runtime, not build-time, failure. |
| Database migrations apply cleanly | ❌ | 014, 018 and 019 fail to parse (BP-002/003) |
| Remote schema matches code | ❌ / UNVERIFIED | Code expects 014–019 objects |
| Hosting configuration | ❌ | None |
| Production env configuration | ❌ / UNVERIFIED | – |
| OAuth redirect configuration | UNVERIFIED | `docs/GOOGLE_AUTH_SETUP.md` exists. `config.toml` is local only (`site_url` 127.0.0.1). |
| Scheduled job | ❌ | `schedule_notifications.sql` not run. Vault secrets, `pg_cron` and `pg_net` pending (per handoff; unverified). |
| HTTPS | Provider-dependent | `push_subscriptions.endpoint` requires https; secure cookies in production |
| Security headers / CSP | ❌ | None configured |
| Logging | ⚠️ | `console.*` only |
| Error monitoring | ❌ | None |
| Backups / PITR | UNVERIFIED | Depends on the Supabase plan. No documented strategy. |
| Recovery runbook | ❌ | None |
| PWA | ❌ | Manifest OK. SW stripped (no offline, no push). |
| Email delivery (password reset, confirmations) | UNVERIFIED | Supabase default SMTP is rate-limited (`email_sent = 2`/hour locally); a pilot needs custom SMTP |
| Rate limiting / abuse controls | ⚠️ | Supabase Auth defaults only. No app-level limits on server actions. Open sign-up. |
| Privacy / data-handling notice | ❌ | Matric numbers, names and avatars are personal data. No privacy page. |
| CI pipeline | ❌ | None |

## 3. Pre-deployment sequence (requires human approval at each step)

1. Fix migration syntax and the critical RLS issue (Remediation Phase 0–1).
2. Rotate `CRON_SECRET`. Generate new VAPID keys if the old ones may have leaked.
3. Create a **staging** Supabase project or branch. Apply 001→020. Run the security advisor and the RLS test suite.
4. Choose a host. Configure env vars, `NEXT_PUBLIC_SITE_URL`, Supabase Auth redirect URLs, and Google OAuth authorised redirect URIs.
5. Configure Vault, `pg_cron` and `pg_net`, then run `schedule_notifications.sql` against **staging** first.
6. Add CI (typecheck, lint, test, build) and an E2E smoke suite.
7. Add security headers, error monitoring and a privacy notice.
8. Run a controlled pilot with a small set of real students and both administrators.

## 4. Verdict for deployment

**Not deployable.** The migration chain cannot be applied, core flows (quests, leaderboard, sign-out, verification recovery, push) are broken, and the verification audit table lacks RLS.
