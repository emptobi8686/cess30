#!/usr/bin/env bash
# Local database test runner for environments without the Supabase Docker stack.
# Boots a throwaway PostgreSQL cluster, loads the Supabase shim, applies every
# migration in order (stopping at the first error), loads the seed, then runs
# pgTAP tests with pg_prove. CI uses `supabase test db` instead.
#
# Requirements: PostgreSQL 15+ server binaries, pgTAP extension, pg_prove.
# Usage: scripts/db-test-local.sh [test-file ...]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PORT="${DB_TEST_PORT:-54399}"
WORK="$(mktemp -d)"
RUN_AS=()
if [ "$(id -u)" = "0" ]; then
  RUN_AS=(runuser -u postgres --)
  chown postgres "$WORK"
fi

cleanup() {
  "${RUN_AS[@]}" "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

"${RUN_AS[@]}" "$PG_BIN/initdb" -D "$WORK/data" -U postgres --auth=trust >/dev/null
"${RUN_AS[@]}" "$PG_BIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses='' -c wal_level=logical" -l "$WORK/pg.log" -w start >/dev/null

export PGHOST="$WORK" PGPORT="$PORT" PGUSER=postgres PGDATABASE=postgres PGOPTIONS="-c client_min_messages=warning"
PSQL=(psql -X -q -v ON_ERROR_STOP=1)

"${PSQL[@]}" -f "$ROOT/supabase/tests/local/supabase_shim.sql"

for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "applying $(basename "$migration")"
  "${PSQL[@]}" -f "$migration"
done

for seed in "$ROOT"/supabase/seed/*.sql; do
  "${PSQL[@]}" -f "$seed"
done

cd "$ROOT/supabase/tests/database"
if [ "$#" -gt 0 ]; then
  pg_prove "$@"
else
  pg_prove ./*.test.sql
fi
