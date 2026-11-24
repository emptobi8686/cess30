# Remote Migration Ledger

**Status: CAPTURED 2026-11-23/24. Remote is at 039.**

The remote Supabase project was not reachable from the implementation session
(the Supabase connector listed no projects), so the ledger below has not been captured yet.

## Procedure (operator, read-only)

```bash
supabase link --project-ref <project-ref>
```

```bash
supabase migration list
```

Paste the full Local/Remote table below, with date and operator name.

## Captured ledger

| Date | Operator | Output |
|---|---|---|
| 2026-11-23 | Claude session (Supabase connector, owner-approved) | Before: remote at `013` (001–013 applied; 014/018/019 never applied, as predicted). Data: 1 profile, 7 courses, 1 role, no announcements/lectures/quests. |
| 2026-11-23 | same | Applied `014`–`038` in order, one transaction each, no errors. Versions renumbered from connector timestamps to `014`…`038` so `supabase migration list` matches the repo. |
| 2026-11-23 | same | Post-checks: every public table has RLS; no legacy admin-only policies left on courses/offerings/lectures/announcements/quests; all courses and profiles have `department_id`; backfill queued 1 review item (`profile_no_matric`). No academic session exists yet, so no placements were created. |
| 2026-11-24 | same | Scheduler set up (not a migration): `pg_cron` and `pg_net` enabled; Vault secrets `notifications_app_url` (https://cess30.vercel.app/api/cron/notifications) and `notifications_cron_secret`; job `blueprint-notification-dispatch` every minute. `040_tutorials` NOT applied (owner declined for now). |
| 2026-11-24 | same | `041_level_claims_count` (a requested level counts for level content) and `042_profile_backfill` (profiles for pre-030 accounts) written and tested locally; NOT yet applied. Both are independent of 040 and safe to apply before it. |
| 2026-11-24 | same | Applied `039_library` (version renumbered to `039`). Checks: `library` bucket private, 0 storage policies on it, all `library_*` tables have RLS, `search_library` runs. |

## Static evidence (recorded 2026-11-23)

Migrations `014`, `018` and `019` contain PostgreSQL syntax errors
(`CREATE POLICY IF NOT EXISTS`; an unescaped `\'` literal). A migration that fails to
parse cannot have been applied as written, so the remote ledger is expected to stop at `013`.

## Advisor notes after 038 (2026-11-23)

- `authenticated` can execute ~44 SECURITY DEFINER RPCs: intentional; each checks the caller inside (auth.uid(), is_admin, has_capability).
- `public.rls_auto_enable()` is executable by `anon`: not created by this repository (likely the dashboard's auto-RLS event trigger). Review in the dashboard; revoke EXECUTE from anon if not needed.
- Pre-existing: `push_subscriptions` has RLS with no policies (service-role only by design), `citext` extension in `public`, leaked-password protection disabled in Auth settings.
