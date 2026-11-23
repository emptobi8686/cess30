# Remote Migration Ledger

**Status: OPEN — awaiting operator with production credentials.**

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
| _pending_ | _pending_ | _pending_ |

## Static evidence (recorded 2026-11-23)

Migrations `014`, `018` and `019` contain PostgreSQL syntax errors
(`CREATE POLICY IF NOT EXISTS`; an unescaped `\'` literal). A migration that fails to
parse cannot have been applied as written, so the remote ledger is expected to stop at `013`.
