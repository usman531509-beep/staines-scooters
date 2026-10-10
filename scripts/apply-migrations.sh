#!/usr/bin/env bash
# Applies pending migrations to a Supabase database, oldest first: supabase/migrations,
# then drizzle/migrations. Each file runs in its own transaction and is recorded in the
# tables the Supabase CLI (supabase_migrations.schema_migrations) and drizzle-kit
# (drizzle.__drizzle_migrations) use, so re-running only applies new files.
#
# Usage: scripts/apply-migrations.sh "postgresql://postgres.<ref>:<password>@<pooler-host>:5432/postgres"
set -euo pipefail

DB_URL="${1:?Pass the database connection string (use the Supabase session pooler URI)}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PGOPTIONS="-c client_min_messages=warning"
PSQL=(psql "$DB_URL" -X -q -At -v ON_ERROR_STOP=1)

"${PSQL[@]}" <<'SQL'
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (version text PRIMARY KEY, statements text[], name text);
CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint);
SQL

applied=0
for f in "$ROOT"/supabase/migrations/*.sql; do
  base="$(basename "$f" .sql)"
  version="${base%%_*}"
  done_already="$("${PSQL[@]}" -c "SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '$version'")"
  [[ -n "$done_already" ]] && continue
  echo "applying $base"
  { cat "$f"; printf '\nINSERT INTO supabase_migrations.schema_migrations (version, name) VALUES (%s, %s);\n' \
      "'$version'" "'${base#*_}'"; } | "${PSQL[@]}" --single-transaction -f - >/dev/null
  applied=$((applied + 1))
done

journal="$ROOT/drizzle/migrations/meta/_journal.json"
while IFS=$'\t' read -r tag when; do
  f="$ROOT/drizzle/migrations/$tag.sql"
  hash="$(shasum -a 256 "$f" | cut -d' ' -f1)"
  done_already="$("${PSQL[@]}" -c "SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = '$hash'")"
  [[ -n "$done_already" ]] && continue
  echo "applying drizzle/$tag"
  { cat "$f"; printf '\nINSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (%s, %s);\n' "'$hash'" "$when"; } \
    | "${PSQL[@]}" --single-transaction -f - >/dev/null
  applied=$((applied + 1))
done < <(python3 -c "import json,sys; [print(e['tag'], e['when'], sep='\t') for e in json.load(open(sys.argv[1]))['entries']]" "$journal")

echo "Applied $applied migration(s)."
