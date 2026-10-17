#!/usr/bin/env bash
set -euo pipefail

export PGHOST=127.0.0.1
export PGPORT="${DB_PORT:-59322}"
export PGDATABASE=postgres
export PGUSER=postgres
export PGPASSWORD=postgres

actor_id=00000000-0000-0000-0000-000000563654
request_id=8f43b9a3-659f-4a97-9dc4-dd45166e5e06
job_name="Concurrent metadata job fixture"
scratch_dir="$(mktemp -d)"

cleanup() {
  psql -X -q -v ON_ERROR_STOP=1 <<SQL
DELETE FROM private.metadata_write_requests
WHERE actor_id = '$actor_id' AND request_id = '$request_id';
DELETE FROM public.audit_logs
WHERE user_id = '$actor_id' AND entity_type = 'job'
  AND entity_id IN (SELECT id::TEXT FROM public.jobs WHERE name = '$job_name');
DELETE FROM public.jobs WHERE name = '$job_name';
DELETE FROM auth.users WHERE id = '$actor_id';
SQL
  rm -rf "$scratch_dir"
}
trap cleanup EXIT

psql -X -q -v ON_ERROR_STOP=1 <<SQL
DELETE FROM private.metadata_write_requests
WHERE actor_id = '$actor_id' AND request_id = '$request_id';
DELETE FROM public.audit_logs
WHERE user_id = '$actor_id' AND entity_type = 'job'
  AND entity_id IN (SELECT id::TEXT FROM public.jobs WHERE name = '$job_name');
DELETE FROM public.jobs WHERE name = '$job_name';
DELETE FROM auth.users WHERE id = '$actor_id';
INSERT INTO auth.users (id, raw_app_meta_data)
VALUES ('$actor_id', '{"role":"admin"}'::JSONB);
SQL

ready_file="$scratch_dir/first-write-ready"
psql -X -qAt -v ON_ERROR_STOP=1 <<SQL >"$scratch_dir/first-write.log" 2>&1 &
SET ROLE service_role;
BEGIN;
SELECT public.controlled_save_metadata(
  '$actor_id', 'job', '{"name":"$job_name"}'::JSONB, '$request_id'
) ->> 'replayed';
\\! touch "$ready_file"
SELECT pg_sleep(2);
COMMIT;
SQL
first_pid=$!

for _ in {1..100}; do
  [[ -e "$ready_file" ]] && break
  sleep 0.05
done
if [[ ! -e "$ready_file" ]]; then
  wait "$first_pid" || true
  cat "$scratch_dir/first-write.log"
  echo "The first metadata write did not reach its lock hold" >&2
  exit 1
fi

replay_result="$(psql -X -qAt -v ON_ERROR_STOP=1 <<SQL
SET ROLE service_role;
SELECT public.controlled_save_metadata(
  '$actor_id', 'job', '{"name":"$job_name"}'::JSONB, '$request_id'
) ->> 'replayed';
SQL
)"
wait "$first_pid"
if [[ "$replay_result" != "true" ]]; then
  echo "The concurrent identical request did not replay its original result: $replay_result" >&2
  exit 1
fi

persisted="$(psql -X -qAt -v ON_ERROR_STOP=1 <<SQL
SELECT
  (SELECT count(*) FROM public.jobs WHERE name = '$job_name') || '|' ||
  (SELECT count(*) FROM public.audit_logs AS audit
   JOIN public.jobs AS job ON job.id::TEXT = audit.entity_id
   WHERE audit.user_id = '$actor_id' AND audit.entity_type = 'job'
     AND audit.action = 'create' AND job.name = '$job_name'
     AND audit.new_value ->> 'name' = '$job_name') || '|' ||
  (SELECT count(*) FROM private.metadata_write_requests
   WHERE actor_id = '$actor_id' AND request_id = '$request_id');
SQL
)"
if [[ "$persisted" != "1|1|1" ]]; then
  echo "Concurrent metadata write persisted unexpected state: $persisted" >&2
  exit 1
fi

echo "Concurrent metadata retry persisted one job, one immutable audit, and one request record"
