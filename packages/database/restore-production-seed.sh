#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

snapshot=".local/production-data-prepared.sql"
manifest=".local/production-data-manifest.json"

if [ ! -s "$snapshot" ] || [ ! -s "$manifest" ]; then
  echo "Prepared production snapshot is missing; run fetch-seed and prepare-seed first." >&2
  exit 1
fi

db_port="$(python3 -c 'import tomllib; print(tomllib.load(open("supabase/config.toml", "rb"))["db"]["port"])')"
run_psql() {
  PGPASSWORD=postgres psql \
    -X -q -v ON_ERROR_STOP=1 \
    -h 127.0.0.1 -p "$db_port" -U postgres -d postgres "$@"
}

{
  cat <<'SQL'
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.dubbing_projects'::regclass
      AND tgname = 'dubbing_project_regional_language_guard'
      AND tgenabled = 'O'
  ) THEN
    RAISE EXCEPTION 'Expected the enabled regional-language guard at the production checkpoint';
  END IF;
END;
$$;

ALTER TABLE public.dubbing_projects
  DISABLE TRIGGER dubbing_project_regional_language_guard;
SQL

  python3 - "$manifest" <<'PY'
import json
import sys


def quote(identifier):
    return '"' + identifier.replace('"', '""') + '"'


with open(sys.argv[1], encoding="utf-8") as manifest_file:
    manifest = json.load(manifest_file)

if manifest.get("format") != 1:
    raise SystemExit("Unsupported production snapshot manifest format")

tables = manifest.get("tables")
if not isinstance(tables, list) or not tables:
    raise SystemExit("Production snapshot manifest has no tables")

relations = sorted(
    {
        f"{quote(table['schema'])}.{quote(table['name'])}"
        for table in tables
        if isinstance(table, dict)
        and isinstance(table.get("schema"), str)
        and isinstance(table.get("name"), str)
    }
)
if len(relations) != len(tables):
    raise SystemExit("Production snapshot manifest contains invalid or duplicate tables")

print("TRUNCATE TABLE " + ", ".join(relations) + " CASCADE;")
PY

  cat "$snapshot"

  cat <<'SQL'
ALTER TABLE public.dubbing_projects
  ENABLE TRIGGER dubbing_project_regional_language_guard;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.dubbing_projects'::regclass
      AND tgname = 'dubbing_project_regional_language_guard'
      AND tgenabled = 'O'
  ) THEN
    RAISE EXCEPTION 'Regional-language guard was not restored after snapshot import';
  END IF;
END;
$$;
COMMIT;
SQL
} | run_psql >/dev/null

echo "Production database rows replaced from the snapshot in one transaction."
