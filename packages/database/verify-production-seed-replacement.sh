#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

manifest=".local/production-data-manifest.json"
if [ ! -s "$manifest" ]; then
  echo "Production snapshot manifest is missing." >&2
  exit 1
fi

db_port="$(python3 -c 'import tomllib; print(tomllib.load(open("supabase/config.toml", "rb"))["db"]["port"])')"
run_psql() {
  PGPASSWORD=postgres psql \
    -X -v ON_ERROR_STOP=1 \
    -h 127.0.0.1 -p "$db_port" -U postgres -d postgres "$@"
}

test_dir="$(mktemp -d)"
prepared_snapshot=".local/production-data-prepared.sql"
cleanup() {
  if [ -f "$test_dir/production-data-prepared.sql" ]; then
    mv "$test_dir/production-data-prepared.sql" "$prepared_snapshot"
  fi
  rm -rf "$test_dir"
}
trap cleanup EXIT

project_id="$(run_psql -Atq -c 'SELECT id FROM public.dubbing_projects ORDER BY id LIMIT 1')"
if [ -z "$project_id" ]; then
  echo "Production snapshot has no dubbing project to use for the replacement check." >&2
  exit 1
fi

expected_created_at="$(run_psql -Atq \
  -c "SELECT COALESCE(created_at::text, '') FROM public.dubbing_projects WHERE id = $project_id")"
regional_code="$(run_psql -Atq -c 'SELECT code FROM public.dubbing_languages ORDER BY code LIMIT 1')"
if [ -z "$regional_code" ]; then
  echo "Production snapshot has no dubbing language to use for the replacement check." >&2
  exit 1
fi

run_psql -Atq -c 'SELECT code FROM public.dubbing_languages ORDER BY code' > "$test_dir/languages.before"
python3 - "$manifest" > "$test_dir/languages.expected" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as manifest_file:
    manifest = json.load(manifest_file)
codes = manifest.get("reference_sets", {}).get("public.dubbing_languages.code")
if not isinstance(codes, list) or not all(isinstance(code, str) for code in codes):
    raise SystemExit("Snapshot manifest is missing the production dubbing-language code set")
print("\n".join(codes), end="\n" if codes else "")
PY
if ! cmp -s "$test_dir/languages.expected" "$test_dir/languages.before"; then
  echo "The local dubbing-language code set does not match the production snapshot." >&2
  exit 1
fi

marker="$(run_psql -Atq <<'SQL'
SELECT candidate.code
FROM (VALUES ('zz-ZZ'), ('zx-ZZ'), ('zy-ZZ'), ('zq-ZZ'), ('zw-ZZ')) AS candidate(code)
WHERE NOT EXISTS (
  SELECT 1 FROM public.dubbing_languages AS existing WHERE existing.code = candidate.code
)
ORDER BY candidate.code
LIMIT 1;
SQL
)"
if [ -z "$marker" ]; then
  echo "Could not find an unused regional-format code for the replacement check." >&2
  exit 1
fi
local_only_content_id="$(( -900000000000000000 + $$ ))"
run_psql -v marker="$marker" -v content_id="$local_only_content_id" \
  -v project_id="$project_id" -v regional_code="$regional_code" <<'SQL'
BEGIN;
INSERT INTO public.dubbing_languages(code) VALUES (:'marker');
INSERT INTO public.dubbing_projects(content_id, content_type, language, status)
VALUES (:'content_id'::bigint, 'movie', :'regional_code', 'local-only-test');
UPDATE public.dubbing_projects
SET created_at = COALESCE(created_at, TIMESTAMP '2000-01-01') + INTERVAL '100 years'
WHERE id = :'project_id'::bigint;
COMMIT;
SQL

mutated_created_at="$(run_psql -Atq \
  -c "SELECT COALESCE(created_at::text, '') FROM public.dubbing_projects WHERE id = $project_id")"

mv "$prepared_snapshot" "$test_dir/production-data-prepared.sql"
printf 'SELECT 1 / 0;\n' > "$prepared_snapshot"
if ./restore-production-seed.sh > "$test_dir/failed-restore.log" 2>&1; then
  echo "A deliberately invalid snapshot unexpectedly restored successfully." >&2
  exit 1
fi
mv "$test_dir/production-data-prepared.sql" "$prepared_snapshot"

if ! grep -q 'division by zero' "$test_dir/failed-restore.log"; then
  echo "The restore did not fail at the deliberately invalid snapshot statement." >&2
  exit 1
fi

after_failed_restore_created_at="$(run_psql -Atq \
  -c "SELECT COALESCE(created_at::text, '') FROM public.dubbing_projects WHERE id = $project_id")"
if [ "$after_failed_restore_created_at" != "$mutated_created_at" ]; then
  echo "A failed restore did not roll back the modified production row." >&2
  exit 1
fi
if [ "$(run_psql -Atq \
  -c "SELECT count(*) FROM public.dubbing_languages WHERE code = '$marker'")" != "1" ] || \
  [ "$(run_psql -Atq \
  -c "SELECT count(*) FROM public.dubbing_projects WHERE content_id = $local_only_content_id")" != "1" ]; then
  echo "A failed restore left the dirty local rows partially truncated." >&2
  exit 1
fi
if [ "$(run_psql -Atq -c "SELECT count(*) FROM pg_trigger WHERE tgrelid = 'public.dubbing_projects'::regclass AND tgname = 'dubbing_project_regional_language_guard' AND tgenabled = 'O'")" != "1" ]; then
  echo "A failed restore did not roll back the temporary guard state." >&2
  exit 1
fi

./restore-production-seed.sh

actual_created_at="$(run_psql -Atq \
  -c "SELECT COALESCE(created_at::text, '') FROM public.dubbing_projects WHERE id = $project_id")"
if [ "$actual_created_at" != "$expected_created_at" ]; then
  echo "A modified production project row was not restored from the snapshot." >&2
  exit 1
fi

if [ "$(run_psql -Atq \
  -c "SELECT count(*) FROM public.dubbing_languages WHERE code = '$marker'")" != "0" ]; then
  echo "A local-only reference row survived production snapshot replacement." >&2
  exit 1
fi

if [ "$(run_psql -Atq \
  -c "SELECT count(*) FROM public.dubbing_projects WHERE content_id = $local_only_content_id")" != "0" ]; then
  echo "A local-only project survived production snapshot replacement." >&2
  exit 1
fi

run_psql -Atq -c 'SELECT code FROM public.dubbing_languages ORDER BY code' > "$test_dir/languages.after"
if ! cmp -s "$test_dir/languages.expected" "$test_dir/languages.after"; then
  echo "The dubbing-language reference set did not return to the production snapshot." >&2
  exit 1
fi

python3 - "$manifest" "$db_port" <<'PY'
import json
import os
import subprocess
import sys

manifest_path, db_port = sys.argv[1:]
with open(manifest_path, encoding="utf-8") as manifest_file:
    manifest = json.load(manifest_file)
tables = manifest.get("tables", [])
storage_tables = manifest.get("storage_tables_restored_separately", [])
required = {
    ("public", "dubbing_projects"),
    ("public", "work"),
    ("public", "dubbing_languages"),
}
if not required.issubset({(table.get("schema"), table.get("name")) for table in tables}):
    raise SystemExit("Snapshot manifest is missing required regional-migration tables")


def quote_identifier(value):
    return '"' + value.replace('"', '""') + '"'


def quote_literal(value):
    return "'" + value.replace("'", "''") + "'"


queries = []
expected = {}
for table in tables:
    schema = table["schema"]
    name = table["name"]
    expected[(schema, name)] = int(table["rows"])
    relation = f"{quote_identifier(schema)}.{quote_identifier(name)}"
    label = f"{quote_literal(schema)}, {quote_literal(name)}"
    queries.append(f"SELECT {label}, count(*)::bigint FROM {relation}")
for table in storage_tables:
    schema = table["schema"]
    name = table["name"]
    expected[(schema, name)] = int(table["rows"])
    relation = f"{quote_identifier(schema)}.{quote_identifier(name)}"
    label = f"{quote_literal(schema)}, {quote_literal(name)}"
    queries.append(f"SELECT {label}, count(*)::bigint FROM {relation}")

command = [
    "psql",
    "-X",
    "-At",
    "-F",
    "\t",
    "-v",
    "ON_ERROR_STOP=1",
    "-h",
    "127.0.0.1",
    "-p",
    db_port,
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-c",
    " UNION ALL ".join(queries),
]
environment = {**os.environ, "PGPASSWORD": "postgres"}
result = subprocess.run(
    command, check=True, capture_output=True, text=True, env=environment
)
actual = {}
for line in result.stdout.splitlines():
    schema, name, rows = line.split("\t")
    actual[(schema, name)] = int(rows)

if actual != expected:
    missing = sorted(set(expected) - set(actual))
    different = sorted(
        key for key in set(expected) & set(actual) if expected[key] != actual[key]
    )
    extra = sorted(set(actual) - set(expected))
    raise SystemExit(
        f"Snapshot row counts differ: missing={missing}, different={different}, extra={extra}"
    )

print(
    f"Verified exact row counts for {len(tables)} database tables and "
    f"{len(storage_tables)} Storage tables."
)
PY

echo "Dirty-local replacement check passed: local-only rows were removed and production rows restored."
