#!/usr/bin/env bash
set -euo pipefail

export PGHOST=127.0.0.1
export PGPORT="${DB_PORT:-60322}"
export PGDATABASE=postgres
export PGUSER=postgres
export PGPASSWORD=postgres

actor_id=00000000-0000-0000-0000-000000563658
request_id=8f43b9a3-659f-4a97-9dc4-dd45166e5e68
stale_request_id=8f43b9a3-659f-4a97-9dc4-dd45166e5f69
scratch_dir="$(mktemp -d)"
voice_actor_id=""
expected_updated_at=""

cleanup() {
  psql -X -q -v ON_ERROR_STOP=1 <<SQL
DELETE FROM private.voice_actor_write_requests WHERE actor_id = '$actor_id';
DELETE FROM public.audit_logs
WHERE user_id = '$actor_id' AND entity_type = 'voice_actor'
  AND entity_id IN (SELECT id::TEXT FROM public.voice_actors WHERE firstname = 'Concurrent' AND lastname = 'Voice Actor');
DELETE FROM public.user_voice_actor_links WHERE user_id = '$actor_id';
DELETE FROM public.voice_actors WHERE firstname = 'Concurrent' AND lastname = 'Voice Actor';
DELETE FROM auth.users WHERE id = '$actor_id';
SQL
  rm -rf "$scratch_dir"
}
trap cleanup EXIT

psql -X -q -v ON_ERROR_STOP=1 -c "DELETE FROM private.voice_actor_write_requests WHERE actor_id = '$actor_id' AND request_id = '$request_id'; DELETE FROM public.audit_logs WHERE user_id = '$actor_id' AND entity_type = 'voice_actor' AND entity_id IN (SELECT id::TEXT FROM public.voice_actors WHERE firstname = 'Concurrent' AND lastname = 'Voice Actor'); DELETE FROM public.user_voice_actor_links WHERE user_id = '$actor_id'; DELETE FROM public.voice_actors WHERE firstname = 'Concurrent' AND lastname = 'Voice Actor'; DELETE FROM auth.users WHERE id = '$actor_id'; INSERT INTO auth.users (id, raw_app_meta_data) VALUES ('$actor_id', '{}'::JSONB);"
voice_actor_id="$(psql -X -qAt -v ON_ERROR_STOP=1 -c "INSERT INTO public.voice_actors (firstname, lastname, bio) VALUES ('Concurrent', 'Voice Actor', 'Before') RETURNING id;")"
psql -X -q -v ON_ERROR_STOP=1 -c "INSERT INTO public.user_voice_actor_links (user_id, voice_actor_id) VALUES ('$actor_id', '$voice_actor_id');"
expected_updated_at="$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT updated_at::TEXT FROM public.voice_actors WHERE id = '$voice_actor_id'")"

ready_file="$scratch_dir/first-write-ready"
psql -X -qAt -v ON_ERROR_STOP=1 <<SQL >"$scratch_dir/first-write.log" 2>&1 &
SET ROLE service_role;
BEGIN;
SELECT public.controlled_update_voice_actor(
  '$actor_id', '$voice_actor_id', '{"bio":"After"}'::JSONB, '$expected_updated_at', '$request_id'
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
  echo "The first voice actor update did not reach its lock hold" >&2
  exit 1
fi

replay_result="$(psql -X -qAt -v ON_ERROR_STOP=1 <<SQL
SET ROLE service_role;
SELECT public.controlled_update_voice_actor(
  '$actor_id', '$voice_actor_id', '{"bio":"After"}'::JSONB, '$expected_updated_at', '$request_id'
) ->> 'replayed';
SQL
)"
wait "$first_pid"
if [[ "$replay_result" != "true" ]]; then
  echo "The concurrent voice actor update did not replay its original result: $replay_result" >&2
  exit 1
fi

if stale_result="$(psql -X -qAt -v ON_ERROR_STOP=1 <<SQL
SET ROLE service_role;
DO \$x\$
BEGIN
  PERFORM public.controlled_update_voice_actor(
    '$actor_id', '$voice_actor_id', '{"bio":"Stale competing edit"}'::JSONB,
    '$expected_updated_at', '$stale_request_id'
  );
  RAISE EXCEPTION 'stale competing update unexpectedly succeeded';
EXCEPTION WHEN SQLSTATE '40001' THEN
  NULL;
END;
\$x\$;
SQL
)"; then
  :
else
  echo "Stale competing voice actor update failed unexpectedly: $stale_result" >&2
  exit 1
fi

persisted="$(psql -X -qAt -v ON_ERROR_STOP=1 <<SQL
SELECT
  (SELECT count(*) FROM public.voice_actors WHERE id = '$voice_actor_id' AND bio = 'After') || '|' ||
  (SELECT count(*) FROM public.audit_logs
   WHERE user_id = '$actor_id' AND entity_type = 'voice_actor'
     AND entity_id = '$voice_actor_id' AND action = 'update'
     AND new_value ->> 'bio' = 'After') || '|' ||
  (SELECT count(*) FROM private.voice_actor_write_requests
   WHERE actor_id = '$actor_id' AND request_id = '$request_id') || '|' ||
  (SELECT count(*) FROM private.voice_actor_write_requests
   WHERE actor_id = '$actor_id' AND request_id = '$stale_request_id');
SQL
)"
if [[ "$persisted" != "1|1|1|0" ]]; then
  echo "Concurrent voice actor update persisted unexpected state: $persisted" >&2
  exit 1
fi

echo "Concurrent voice actor retry persisted one profile update, one audit, and one request record"
