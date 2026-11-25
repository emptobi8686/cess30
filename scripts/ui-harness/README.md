# UI harness: responsive and visual checks without a database

Renders every student and admin page against a stand-in for the Supabase API, with sample data,
and checks each one at 320, 375, 430, 768, 1024, 1280, 1440 and 1920 px wide.

It checks layout only. The stand-in enforces no permissions and returns the same sample rows
for every query, so it says nothing about security or data correctness: the database tests
(`scripts/db-test-local.sh`) and the gated Playwright suite cover those.

```bash
node scripts/ui-harness/mock-supabase.mjs &            # stand-in API on :54321
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=mock \
  SUPABASE_SERVICE_ROLE_KEY=mock NEXT_PUBLIC_SITE_URL=http://localhost:3100 \
  npx next dev -p 3100 &
node scripts/ui-harness/check-viewports.mjs http://localhost:3100 ui-harness-out --shots
```

The report lists, per page and width: horizontal overflow (with the elements causing it),
console errors, failed responses and redirects. `--shots` saves full-page screenshots at
375, 768 and 1440 px; `--only=/path` limits the run to one route.

Personas (chosen by the session cookie the checker sets): a verified Level 200 student,
a pending student, and a department administrator.

If a stylesheet change does not show up, stop the dev server, delete `.next/dev` and start
it again: the development cache can keep serving the old global CSS.
