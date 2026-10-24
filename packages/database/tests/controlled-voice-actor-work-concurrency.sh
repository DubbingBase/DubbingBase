#!/usr/bin/env bash
set -euo pipefail

# This test is intentionally pinned to loopback and a dedicated disposable
# Supabase port. It opens independent psql sessions for every racing request.
DB_HOST=127.0.0.1
DB_PORT=${T08_TEST_DB_PORT:-56322}
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=${T08_TEST_DB_PASSWORD:-postgres}
export PGPASSWORD="$DB_PASSWORD"

psql_local() {
  psql -X -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" \
    -U "$DB_USER" -d "$DB_NAME" "$@"
}

tmpdir=$(mktemp -d /tmp/dubbingbase-t08-race.XXXXXX)
owner_id=00000000-0000-0000-0000-000056368201
voice_actor_id=563682001
fixtures_created=0

cleanup() {
  if [[ "$fixtures_created" == "1" ]]; then
    psql_local >/dev/null <<'SQL' || true
# This session only cleans disposable fixtures; the setting ends when psql exits.
SET session_replication_role = replica;
DELETE FROM public.audit_logs
WHERE user_id = '00000000-0000-0000-0000-000056368201';
DELETE FROM public.work WHERE voice_actor_id = 563682001;
DELETE FROM public.dubbing_projects
WHERE content_type = 'movie' AND content_id BETWEEN 563682101 AND 563682103;
DELETE FROM public.user_voice_actor_links
WHERE user_id = '00000000-0000-0000-0000-000056368201';
DELETE FROM public.voice_actors WHERE id = 563682001;
DELETE FROM auth.users WHERE id = '00000000-0000-0000-0000-000056368201';
SQL
  fi
  rm -rf "$tmpdir"
}
trap cleanup EXIT

psql_local >/dev/null <<'SQL'
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = '00000000-0000-0000-0000-000056368201')
     OR EXISTS (SELECT 1 FROM public.voice_actors WHERE id = 563682001)
     OR EXISTS (SELECT 1 FROM public.dubbing_projects WHERE content_id BETWEEN 563682101 AND 563682103) THEN
    RAISE EXCEPTION 'T08 concurrency fixture ids are already in use';
  END IF;
END;
$$;
SQL
fixtures_created=1
psql_local >/dev/null <<'SQL'
INSERT INTO auth.users (id, raw_app_meta_data)
VALUES ('00000000-0000-0000-0000-000056368201', '{"role":"user"}'::JSONB);
INSERT INTO public.voice_actors (id, firstname, lastname)
VALUES (563682001, 'Concurrent', 'Voice Actor');
INSERT INTO public.user_voice_actor_links (user_id, voice_actor_id)
VALUES ('00000000-0000-0000-0000-000056368201', 563682001);
SQL

write_create_sql() {
  local path=$1 request_id=$2 content_id=$3 role_name=$4 performance=$5
  cat >"$path" <<SQL
SET ROLE service_role;
SELECT pg_sleep(0.25);
SELECT work_id, replayed
FROM public.create_voice_actor_work_link(
  '$owner_id', '$request_id', $voice_actor_id, $content_id,
  'movie', 'fr-FR', NULL, '$role_name', '$performance'
);
SQL
}

write_create_sql "$tmpdir/same-role-a.sql" 56368200-0000-4000-8000-000000000101 563682101 'Concurrent Role' dialogues
write_create_sql "$tmpdir/same-role-b.sql" 56368200-0000-4000-8000-000000000102 563682101 ' concurrent role ' chant
psql_local -q -t -A -f "$tmpdir/same-role-a.sql" >"$tmpdir/same-role-a.out" 2>&1 &
same_role_a=$!
psql_local -q -t -A -f "$tmpdir/same-role-b.sql" >"$tmpdir/same-role-b.out" 2>&1 &
same_role_b=$!
wait "$same_role_a"
wait "$same_role_b"

same_role_rows=$(psql_local -At -c "SELECT count(*) FROM public.work AS work JOIN public.dubbing_projects AS project ON project.id = work.dubbing_project_id WHERE project.content_id = 563682101 AND work.voice_actor_id = 563682001 AND public.work_role_identity_key(work.character_id, work.character_name) = 'name:concurrent role';")
if [[ "$same_role_rows" != "1" ]]; then
  printf 'same-role concurrency persisted %s rows, expected 1\n' "$same_role_rows" >&2
  exit 1
fi

write_create_sql "$tmpdir/distinct-a.sql" 56368200-0000-4000-8000-000000000103 563682102 'Distinct Alpha' dialogues
write_create_sql "$tmpdir/distinct-b.sql" 56368200-0000-4000-8000-000000000104 563682102 'Distinct Beta' chant
psql_local -q -t -A -f "$tmpdir/distinct-a.sql" >"$tmpdir/distinct-a.out" 2>&1 &
distinct_a=$!
psql_local -q -t -A -f "$tmpdir/distinct-b.sql" >"$tmpdir/distinct-b.out" 2>&1 &
distinct_b=$!
wait "$distinct_a"
wait "$distinct_b"

distinct_rows=$(psql_local -At -c "SELECT count(*) FROM public.work AS work JOIN public.dubbing_projects AS project ON project.id = work.dubbing_project_id WHERE project.content_id = 563682102 AND work.voice_actor_id = 563682001;")
if [[ "$distinct_rows" != "2" ]]; then
  printf 'distinct-role concurrency persisted %s rows, expected 2\n' "$distinct_rows" >&2
  exit 1
fi

write_create_sql "$tmpdir/replay-a.sql" 56368200-0000-4000-8000-000000000105 563682103 'Replay Role' dialogues
write_create_sql "$tmpdir/replay-b.sql" 56368200-0000-4000-8000-000000000105 563682103 'Replay Role' dialogues
psql_local -q -t -A -f "$tmpdir/replay-a.sql" >"$tmpdir/replay-a.out" 2>&1 &
replay_a=$!
psql_local -q -t -A -f "$tmpdir/replay-b.sql" >"$tmpdir/replay-b.out" 2>&1 &
replay_b=$!
wait "$replay_a"
wait "$replay_b"
replay_a_work=$(cut -d '|' -f1 "$tmpdir/replay-a.out")
replay_b_work=$(cut -d '|' -f1 "$tmpdir/replay-b.out")
if [[ -z "$replay_a_work" || "$replay_a_work" != "$replay_b_work" ]]; then
  printf 'same-request replay returned different work ids\n' >&2
  cat "$tmpdir/replay-a.out" "$tmpdir/replay-b.out" >&2
  exit 1
fi
replay_audit_count=$(psql_local -At -c "SELECT count(*) FROM public.audit_logs WHERE user_id = '$owner_id' AND request_id = '56368200-0000-4000-8000-000000000105';")
if [[ "$replay_audit_count" != "1" ]]; then
  printf 'same-request race persisted %s audit rows, expected 1\n' "$replay_audit_count" >&2
  exit 1
fi

psql_local >"$tmpdir/update-a.out" 2>&1 <<'SQL' &
SET ROLE service_role;
DO $$
DECLARE
  v_work public.work%ROWTYPE;
BEGIN
  SELECT work.* INTO v_work FROM public.work AS work
  JOIN public.dubbing_projects AS project ON project.id = work.dubbing_project_id
  WHERE project.content_id = 563682101 AND work.character_name ILIKE '%concurrent role%'
  LIMIT 1;
  PERFORM pg_sleep(0.25);
  BEGIN
    PERFORM * FROM public.update_voice_actor_work_performance(
      '00000000-0000-0000-0000-000056368201',
      '56368200-0000-4000-8000-000000000111', v_work.id, v_work.updated_at, 'voice'
    );
    RAISE NOTICE 'RESULT=updated';
  EXCEPTION WHEN serialization_failure THEN
    RAISE NOTICE 'RESULT=stale';
  END;
END;
$$;
SQL
update_a=$!
psql_local >"$tmpdir/update-b.out" 2>&1 <<'SQL' &
SET ROLE service_role;
DO $$
DECLARE
  v_work public.work%ROWTYPE;
BEGIN
  SELECT work.* INTO v_work FROM public.work AS work
  JOIN public.dubbing_projects AS project ON project.id = work.dubbing_project_id
  WHERE project.content_id = 563682101 AND work.character_name ILIKE '%concurrent role%'
  LIMIT 1;
  PERFORM pg_sleep(0.25);
  BEGIN
    PERFORM * FROM public.update_voice_actor_work_performance(
      '00000000-0000-0000-0000-000056368201',
      '56368200-0000-4000-8000-000000000112', v_work.id, v_work.updated_at, 'ambiances'
    );
    RAISE NOTICE 'RESULT=updated';
  EXCEPTION WHEN serialization_failure THEN
    RAISE NOTICE 'RESULT=stale';
  END;
END;
$$;
SQL
update_b=$!
wait "$update_a"
wait "$update_b"
updates_won=0
updates_stale=0
for output in "$tmpdir/update-a.out" "$tmpdir/update-b.out"; do
  if grep -q 'RESULT=updated' "$output"; then updates_won=$((updates_won + 1)); fi
  if grep -q 'RESULT=stale' "$output"; then updates_stale=$((updates_stale + 1)); fi
done
if [[ "$updates_won" != "1" || "$updates_stale" != "1" ]]; then
  printf 'expected one accepted and one stale overlapping update; got %s and %s\n' "$updates_won" "$updates_stale" >&2
  cat "$tmpdir/update-a.out" "$tmpdir/update-b.out" >&2
  exit 1
fi

psql_local >"$tmpdir/owner-update.out" 2>&1 <<'SQL' &
BEGIN;
SET ROLE service_role;
DO $$
DECLARE
  v_work public.work%ROWTYPE;
BEGIN
  SELECT work.* INTO v_work FROM public.work AS work
  JOIN public.dubbing_projects AS project ON project.id = work.dubbing_project_id
  WHERE project.content_id = 563682102 AND work.character_name = 'Distinct Alpha';
  PERFORM * FROM public.update_voice_actor_work_performance(
    '00000000-0000-0000-0000-000056368201',
    '56368200-0000-4000-8000-000000000121', v_work.id, v_work.updated_at, 'chant'
  );
  RAISE NOTICE 'RESULT=owner-update';
END;
$$;
SELECT pg_sleep(1.5);
COMMIT;
SQL
owner_update=$!
for attempt in {1..50}; do
  if grep -q 'RESULT=owner-update' "$tmpdir/owner-update.out"; then break; fi
  sleep 0.05
done
if ! grep -q 'RESULT=owner-update' "$tmpdir/owner-update.out"; then
  printf 'authorized owner update did not reach the in-transaction hold\n' >&2
  exit 1
fi
revoke_started=$(date +%s%N)
psql_local -c "DELETE FROM public.user_voice_actor_links WHERE user_id = '$owner_id' AND voice_actor_id = $voice_actor_id;" >"$tmpdir/revoke.out" 2>&1 &
revoke=$!
wait "$owner_update"
wait "$revoke"
revoke_finished=$(date +%s%N)
revoke_duration_ms=$(((revoke_finished - revoke_started) / 1000000))
if (( revoke_duration_ms < 800 )); then
  printf 'ownership revocation did not wait for the in-flight authorized update (%sms)\n' "$revoke_duration_ms" >&2
  exit 1
fi

post_revoke=$(psql_local -At -c "SELECT count(*) FROM public.user_voice_actor_links WHERE user_id = '$owner_id' AND voice_actor_id = $voice_actor_id;")
if [[ "$post_revoke" != "0" ]]; then
  printf 'ownership revocation did not persist\n' >&2
  exit 1
fi
psql_local >/dev/null <<'SQL'
SET ROLE service_role;
DO $$
DECLARE
  v_work public.work%ROWTYPE;
BEGIN
  SELECT work.* INTO v_work FROM public.work AS work
  JOIN public.dubbing_projects AS project ON project.id = work.dubbing_project_id
  WHERE project.content_id = 563682102 AND work.character_name = 'Distinct Alpha';
  BEGIN
    PERFORM * FROM public.update_voice_actor_work_performance(
      '00000000-0000-0000-0000-000056368201',
      '56368200-0000-4000-8000-000000000122', v_work.id, v_work.updated_at, 'voice'
    );
    RAISE EXCEPTION 'owner unexpectedly updated after ownership revocation';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;
SQL

printf 'PASS: same-role and distinct-role creation, request replay, stale overlapping updates, and ownership revocation used independent PostgreSQL sessions (revocation waited %sms)\n' "$revoke_duration_ms"
