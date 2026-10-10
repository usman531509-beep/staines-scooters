#!/usr/bin/env bash
# Builds the local development database on an existing PostgreSQL server:
# creates the database, applies the Supabase compatibility shim, then runs the
# Supabase migrations followed by the drizzle migrations in order.
#
# Usage: scripts/local-db/setup.sh [--reset]
#   DB_NAME (default stainess_scooter) and the usual PGHOST/PGPORT/PGUSER apply.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DB_NAME="${DB_NAME:-stainess_scooter}"

if [[ "${1:-}" == "--reset" ]]; then
  dropdb --if-exists "$DB_NAME"
fi

if psql -d postgres -Atc "select 1 from pg_database where datname = '$DB_NAME'" | grep -q 1; then
  echo "Database $DB_NAME already exists; pass --reset to rebuild it." >&2
  exit 1
fi

createdb "$DB_NAME"
psql -d postgres -qc "ALTER DATABASE \"$DB_NAME\" SET search_path = public, extensions"

run() {
  # pg_cron and pg_net are not available locally; the shim stubs their functions.
  sed -E '/CREATE EXTENSION IF NOT EXISTS pg_(cron|net)/d' "$1" \
    | psql -d "$DB_NAME" -q -v ON_ERROR_STOP=1 --single-transaction -f - >/dev/null \
    || { echo "FAILED: $1" >&2; exit 1; }
}

run "$ROOT/scripts/local-db/supabase-shim.sql"

count=0
for f in "$ROOT"/supabase/migrations/*.sql "$ROOT"/drizzle/migrations/*.sql; do
  run "$f"
  count=$((count + 1))
done

echo "Applied $count migrations to $DB_NAME."
