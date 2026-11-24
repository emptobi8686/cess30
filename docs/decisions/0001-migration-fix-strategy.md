# 0001 — Migration fix strategy

**Status:** PROVISIONAL (confirm against `docs/ops/MIGRATION_LEDGER.md`)

MIGRATION_FIX_STRATEGY: edit-in-place

## Rationale

Migrations 014, 018 and 019 cannot parse under PostgreSQL 15–17, so they cannot have been
applied to the remote project in their committed form. Editing them in place therefore
does not diverge from any applied history, and it keeps the numbered sequence readable.

## Required confirmation

Before any `supabase db push`, an operator runs `supabase migration list`.

- If none of 014–019 appear under **Remote**, this decision becomes **ACCEPTED**.
- If any of them appear (meaning someone applied a hand-edited version), change this to
  `forward-only`, revert the in-place edits, and follow P1 Task 1's forward-only path
  (`supabase migration repair` plus a new repair migration).
