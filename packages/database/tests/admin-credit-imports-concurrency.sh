#!/usr/bin/env bash
set -euo pipefail

DB_HOST=127.0.0.1
DB_PORT=${T84_TEST_DB_PORT:-55322}
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=${T84_TEST_DB_PASSWORD:-postgres}
ADMIN_ID=56368400-0000-4000-8000-000000000021
VOICE_FIRSTNAME=AtomicRace
VOICE_LASTNAME=Person
SAME_REQUEST_ID=56368400-0000-4000-8000-000000000101
ROLE_REQUEST_A=56368400-0000-4000-8000-000000000102
ROLE_REQUEST_B=56368400-0000-4000-8000-000000000103
export PGPASSWORD="$DB_PASSWORD"

psql_local() {
  psql -X -q -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" \
    -U "$DB_USER" -d "$DB_NAME" "$@"
}

tmpdir=$(mktemp -d /tmp/dubbingbase-admin-credit-imports.XXXXXX)
fixtures_created=0

cleanup() {
  if [[ "$fixtures_created" == "1" ]]; then
    psql_local >/dev/null <<SQL
BEGIN;
ALTER TABLE public.audit_logs DISABLE TRIGGER USER;
DELETE FROM private.admin_credit_import_requests WHERE admin_id = '$ADMIN_ID';
DELETE FROM private.metadata_write_requests WHERE actor_id = '$ADMIN_ID';
DELETE FROM public.audit_logs WHERE user_id = '$ADMIN_ID';
DELETE FROM public.work
WHERE dubbing_project_id IN (
  SELECT id FROM public.dubbing_projects
  WHERE content_id IN (563684201, 563684202) AND content_type = 'movie' AND language = 'en-US'
);
DELETE FROM public.dubbing_projects
WHERE content_id IN (563684201, 563684202) AND content_type = 'movie' AND language = 'en-US';
DELETE FROM public.voice_actors
WHERE firstname = '$VOICE_FIRSTNAME' AND lastname = '$VOICE_LASTNAME';
DELETE FROM auth.users WHERE id = '$ADMIN_ID';
ALTER TABLE public.audit_logs ENABLE TRIGGER USER;
COMMIT;
SQL
  fi
  rm -rf "$tmpdir"
}
trap cleanup EXIT

psql_local >/dev/null <<SQL
DO \$\$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = '$ADMIN_ID')
     OR EXISTS (
       SELECT 1 FROM public.dubbing_projects
       WHERE content_id IN (563684201, 563684202)
     )
     OR EXISTS (
       SELECT 1 FROM public.voice_actors
       WHERE firstname = '$VOICE_FIRSTNAME' AND lastname = '$VOICE_LASTNAME'
     ) THEN
    RAISE EXCEPTION 'T84 concurrency fixture IDs are already in use';
  END IF;
END;
\$\$;
SQL
fixtures_created=1
psql_local >/dev/null <<SQL
INSERT INTO auth.users (id, raw_app_meta_data)
VALUES ('$ADMIN_ID', '{"role":"admin"}'::JSONB);
SQL

write_import_sql() {
  local path=$1 request_id=$2 content_id=$3 role_name=$4
  cat >"$path" <<SQL
SET ROLE service_role;
SELECT pg_sleep(0.2);
SELECT work_id || '|' || project_id || '|' || voice_actor_id || '|' || audit_log_id || '|' || replayed
FROM public.save_admin_credit_import(
  '$ADMIN_ID', '$request_id', $content_id, 'movie', 'en-US',
  NULL, '$VOICE_FIRSTNAME', '$VOICE_LASTNAME', NULL, NULL, '$role_name'
);
SQL
}

write_import_sql "$tmpdir/replay-a.sql" "$SAME_REQUEST_ID" 563684201 'Retry Role'
write_import_sql "$tmpdir/replay-b.sql" "$SAME_REQUEST_ID" 563684201 'Retry Role'
psql_local -t -A -f "$tmpdir/replay-a.sql" >"$tmpdir/replay-a.out" 2>&1 &
replay_a=$!
psql_local -t -A -f "$tmpdir/replay-b.sql" >"$tmpdir/replay-b.out" 2>&1 &
replay_b=$!
wait "$replay_a"
wait "$replay_b"
replay_a_result=$(tail -n 1 "$tmpdir/replay-a.out")
replay_b_result=$(tail -n 1 "$tmpdir/replay-b.out")
if [[ -z "$replay_a_result" || -z "$replay_b_result" ]] \
  || [[ "${replay_a_result%|*}" != "${replay_b_result%|*}" ]]; then
  printf 'Concurrent request replay returned different results:\n%s\n%s\n' \
    "$replay_a_result" "$replay_b_result" >&2
  exit 1
fi

write_import_sql "$tmpdir/role-a.sql" "$ROLE_REQUEST_A" 563684202 'Concurrent Alpha'
write_import_sql "$tmpdir/role-b.sql" "$ROLE_REQUEST_B" 563684202 'Concurrent Beta'
psql_local -t -A -f "$tmpdir/role-a.sql" >"$tmpdir/role-a.out" 2>&1 &
role_a=$!
psql_local -t -A -f "$tmpdir/role-b.sql" >"$tmpdir/role-b.out" 2>&1 &
role_b=$!
wait "$role_a"
wait "$role_b"

counts=$(psql_local -t -A -c "
  SELECT
    (SELECT count(*) FROM public.voice_actors
     WHERE lower(firstname) = lower('$VOICE_FIRSTNAME')
       AND lower(lastname) = lower('$VOICE_LASTNAME')) || ':' ||
    (SELECT count(*) FROM public.work AS work
     JOIN public.dubbing_projects AS project ON project.id = work.dubbing_project_id
     JOIN public.voice_actors AS actor ON actor.id = work.voice_actor_id
     WHERE project.content_id = 563684202
       AND project.content_type = 'movie'
       AND project.language = 'en-US'
       AND lower(actor.firstname) = lower('$VOICE_FIRSTNAME')
       AND lower(actor.lastname) = lower('$VOICE_LASTNAME')) || ':' ||
    (SELECT count(*) FROM private.admin_credit_import_requests
     WHERE admin_id = '$ADMIN_ID');
")
if [[ "$counts" != "1:2:3" ]]; then
  printf 'Concurrent imports produced unexpected voice_actor:distinct_work:requests counts %s\n' "$counts" >&2
  exit 1
fi

audit_count=$(psql_local -t -A -c "
  SELECT count(*) FROM public.audit_logs
  WHERE user_id = '$ADMIN_ID'
    AND entity_type = 'work'
    AND metadata ->> 'import_source' = 'process_credits';
")
if [[ "$audit_count" != "3" ]]; then
  printf 'Expected three controlled work audit rows, got %s\n' "$audit_count" >&2
  exit 1
fi

printf 'PASS: identical concurrent retries return one result; distinct concurrent roles reuse one actor and create two audited work rows.\n'
