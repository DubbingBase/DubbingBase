#!/usr/bin/env bash
set -euo pipefail

export PGHOST=127.0.0.1
export PGPORT="${DB_PORT:-58322}"
export PGDATABASE=postgres
export PGUSER=postgres
export PGPASSWORD=postgres

actor_id=00000000-0000-0000-0000-000000563653
create_request_id=9124cfc8-0faf-4332-a955-13ebd5a3019e
retry_request_id=55eaa74d-13b7-4b6f-b3d8-e2672f5775da
winner_request_id=d7548c15-dacb-4db1-99ee-bb73c7d2fb65
loser_request_id=fb18eede-71e1-469b-a017-57c9cc10a1d7
scratch_dir="$(mktemp -d)"

cleanup() {
  if [[ -n "${studio_id:-}" ]]; then
    psql -X -q -v ON_ERROR_STOP=1 -v studio_id="$studio_id" <<SQL
DELETE FROM public.audit_logs WHERE user_id = '$actor_id';
DELETE FROM public.studios WHERE id = :studio_id;
DELETE FROM auth.users WHERE id = '$actor_id';
SQL
  else
    psql -X -q -v ON_ERROR_STOP=1 <<SQL
DELETE FROM public.audit_logs WHERE user_id = '$actor_id';
DELETE FROM public.studios WHERE name = 'Concurrent studio fixture';
DELETE FROM auth.users WHERE id = '$actor_id';
SQL
  fi
  rm -rf "$scratch_dir"
}
trap cleanup EXIT

psql -X -q -v ON_ERROR_STOP=1 <<SQL
DELETE FROM public.audit_logs WHERE user_id = '$actor_id';
DELETE FROM public.studios WHERE name = 'Concurrent studio fixture';
DELETE FROM auth.users WHERE id = '$actor_id';
INSERT INTO auth.users (id, raw_app_meta_data)
VALUES ('$actor_id', '{}'::JSONB);
SQL

studio_id="$(psql -X -qAt -v ON_ERROR_STOP=1 <<SQL
SET ROLE service_role;
SELECT studio_id
FROM public.controlled_save_studio(
  '$actor_id', NULL, NULL, '$create_request_id', '{"name":"Concurrent studio fixture"}'::JSONB
);
SQL
)"
expected="$(psql -X -qAt -v ON_ERROR_STOP=1 -v studio_id="$studio_id" <<'SQL'
SELECT updated_at::TEXT FROM public.studios WHERE id = :studio_id;
SQL
)"

ready_file="$scratch_dir/idempotent-ready"
psql -X -q -v ON_ERROR_STOP=1 -v studio_id="$studio_id" -v expected="$expected" <<SQL >"$scratch_dir/idempotent-winner.log" 2>&1 &
SET ROLE service_role;
BEGIN;
SELECT * FROM public.controlled_save_studio(
  '$actor_id', :studio_id, :'expected'::TIMESTAMP, '$retry_request_id', '{"city":"Retry-safe"}'::JSONB
);
\! touch "$ready_file"
SELECT pg_sleep(2);
COMMIT;
SQL
winner_pid=$!

for _ in {1..100}; do
  [[ -e "$ready_file" ]] && break
  sleep 0.05
done
if [[ ! -e "$ready_file" ]]; then
  wait "$winner_pid" || true
  cat "$scratch_dir/idempotent-winner.log"
  echo "The first idempotent write did not reach its lock hold" >&2
  exit 1
fi

retry_result="$(psql -X -qAt -v ON_ERROR_STOP=1 -v studio_id="$studio_id" -v expected="$expected" <<SQL
SET ROLE service_role;
SELECT studio_id || '|' || audit_log_id || '|' || replayed
FROM public.controlled_save_studio(
  '$actor_id', :studio_id, :'expected'::TIMESTAMP, '$retry_request_id', '{"city":"Retry-safe"}'::JSONB
);
SQL
)"
wait "$winner_pid"
if [[ "$retry_result" != *"|true" ]]; then
  echo "Concurrent identical retry did not return the original audit result: $retry_result" >&2
  exit 1
fi

expected="$(psql -X -qAt -v ON_ERROR_STOP=1 -v studio_id="$studio_id" <<'SQL'
SELECT updated_at::TEXT FROM public.studios WHERE id = :studio_id;
SQL
)"
ready_file="$scratch_dir/stale-ready"
psql -X -q -v ON_ERROR_STOP=1 -v studio_id="$studio_id" -v expected="$expected" <<SQL >"$scratch_dir/stale-winner.log" 2>&1 &
SET ROLE service_role;
BEGIN;
SELECT * FROM public.controlled_save_studio(
  '$actor_id', :studio_id, :'expected'::TIMESTAMP, '$winner_request_id', '{"city":"Winner"}'::JSONB
);
\! touch "$ready_file"
SELECT pg_sleep(2);
COMMIT;
SQL
winner_pid=$!

for _ in {1..100}; do
  [[ -e "$ready_file" ]] && break
  sleep 0.05
done
if [[ ! -e "$ready_file" ]]; then
  wait "$winner_pid" || true
  cat "$scratch_dir/stale-winner.log"
  echo "The competing write did not reach its lock hold" >&2
  exit 1
fi

set +e
psql -X -q -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -v studio_id="$studio_id" \
  -v expected="$expected" <<SQL >"$scratch_dir/stale-loser.log" 2>&1
SET ROLE service_role;
SELECT * FROM public.controlled_save_studio(
  '$actor_id', :studio_id, :'expected'::TIMESTAMP, '$loser_request_id', '{"city":"Loser"}'::JSONB
);
SQL
loser_status=$?
set -e
wait "$winner_pid"
if [[ "$loser_status" -eq 0 ]] || ! rg -q '40001' "$scratch_dir/stale-loser.log"; then
  cat "$scratch_dir/stale-loser.log"
  echo "A stale concurrent studio write was not rejected with SQLSTATE 40001" >&2
  exit 1
fi

verification="$(psql -X -qAt -v ON_ERROR_STOP=1 -v studio_id="$studio_id" <<SQL
SELECT COALESCE((SELECT city FROM public.studios WHERE id = :studio_id), '<missing>') || '|' ||
       (SELECT count(*) FROM public.audit_logs WHERE request_id = '$retry_request_id') || '|' ||
       (SELECT count(*) FROM public.audit_logs WHERE request_id = '$winner_request_id') || '|' ||
       (SELECT count(*) FROM public.audit_logs WHERE request_id = '$loser_request_id');
SQL
)"
if [[ "$verification" != "Winner|1|1|0" ]]; then
  echo "Persisted concurrency state is incorrect: $verification" >&2
  exit 1
fi

echo "Concurrent retry replay and stale-write rejection passed for studio $studio_id"
