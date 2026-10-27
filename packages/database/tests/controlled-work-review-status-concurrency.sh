#!/usr/bin/env bash
set -euo pipefail

# Uses the local disposable Supabase instance and two independent PostgreSQL
# sessions to prove stale review-status writers serialize on the work row.
DB_HOST=127.0.0.1
DB_PORT=${T10_TEST_DB_PORT:-55322}
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=${T10_TEST_DB_PASSWORD:-postgres}
export PGPASSWORD="$DB_PASSWORD"

psql_local() {
  psql -X -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" \
    -U "$DB_USER" -d "$DB_NAME" "$@"
}

tmpdir=$(mktemp -d /tmp/dubbingbase-t10-review-race.XXXXXX)
admin_id=00000000-0000-0000-0000-000056369201
owner_id=00000000-0000-0000-0000-000056369202
voice_actor_id=563692001
content_id=563692101
create_request=56369200-0000-4000-8000-000000000101
request_a=56369200-0000-4000-8000-000000000102
request_b=56369200-0000-4000-8000-000000000103
fixtures_created=0

cleanup() {
  if [[ "$fixtures_created" == "1" ]]; then
    psql_local >/dev/null <<SQL
SET session_replication_role = replica;
DELETE FROM public.audit_logs WHERE user_id IN ('$admin_id', '$owner_id');
DELETE FROM public.work WHERE voice_actor_id = $voice_actor_id;
DELETE FROM public.dubbing_projects WHERE content_id = $content_id AND content_type = 'movie';
DELETE FROM public.user_voice_actor_links WHERE user_id = '$owner_id' AND voice_actor_id = $voice_actor_id;
DELETE FROM public.voice_actors WHERE id = $voice_actor_id;
DELETE FROM auth.users WHERE id IN ('$admin_id', '$owner_id');
SQL
  fi
  rm -rf "$tmpdir"
}
trap cleanup EXIT

psql_local >/dev/null <<SQL
DO \$\$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id IN ('$admin_id', '$owner_id'))
     OR EXISTS (SELECT 1 FROM public.voice_actors WHERE id = $voice_actor_id)
     OR EXISTS (SELECT 1 FROM public.dubbing_projects WHERE content_id = $content_id AND content_type = 'movie') THEN
    RAISE EXCEPTION 'T10 review concurrency fixture ids are already in use';
  END IF;
END;
\$\$;
SQL
fixtures_created=1
psql_local >/dev/null <<SQL
INSERT INTO auth.users (id, raw_app_meta_data) VALUES
  ('$admin_id', '{"role":"admin"}'::JSONB),
  ('$owner_id', '{"role":"user"}'::JSONB);
INSERT INTO public.voice_actors (id, firstname, lastname)
VALUES ($voice_actor_id, 'Review Race', 'Voice Actor');
INSERT INTO public.user_voice_actor_links (user_id, voice_actor_id)
VALUES ('$owner_id', $voice_actor_id);
SQL

work_id=$(psql_local -qAt -c "SET ROLE service_role; SELECT work_id FROM public.create_voice_actor_work_link('$owner_id', '$create_request', $voice_actor_id, $content_id, 'movie', 'fr-FR', NULL, 'Review race role', 'dialogues');")
if [[ ! "$work_id" =~ ^[1-9][0-9]*$ ]]; then
  printf 'failed to create the isolated review-status work fixture\n' >&2
  exit 1
fi
expected_updated_at=$(psql_local -At -c "SELECT updated_at FROM public.work WHERE id = $work_id;")

write_update() {
  local path=$1 request_id=$2 status=$3
  cat >"$path" <<SQL
SET ROLE service_role;
SELECT pg_sleep(0.25);
SELECT work_id, audit_log_id, replayed
FROM public.update_work_review_status_controlled(
  '$admin_id', '$request_id', $work_id,
  '$expected_updated_at'::TIMESTAMPTZ, '$status'
);
SQL
}

write_update "$tmpdir/update-a.sql" "$request_a" accepted
write_update "$tmpdir/update-b.sql" "$request_b" rejected
psql_local -q -t -A -f "$tmpdir/update-a.sql" >"$tmpdir/update-a.out" 2>&1 &
update_a=$!
psql_local -q -t -A -f "$tmpdir/update-b.sql" >"$tmpdir/update-b.out" 2>&1 &
update_b=$!
set +e
wait "$update_a"
status_a=$?
wait "$update_b"
status_b=$?
set -e

if { [[ "$status_a" == "0" ]] && [[ "$status_b" == "0" ]]; } || \
   { [[ "$status_a" != "0" ]] && [[ "$status_b" != "0" ]]; }; then
  printf 'expected exactly one accepted and one stale concurrent update; got exit statuses %s and %s\n' "$status_a" "$status_b" >&2
  cat "$tmpdir/update-a.out" "$tmpdir/update-b.out" >&2
  exit 1
fi

loser_output="$tmpdir/update-a.out"
if [[ "$status_a" == "0" ]]; then loser_output="$tmpdir/update-b.out"; fi
if ! grep -q 'Work changed since it was loaded' "$loser_output"; then
  printf 'losing update failed for an unexpected reason\n' >&2
  cat "$loser_output" >&2
  exit 1
fi

audit_count=$(psql_local -At -c "SELECT count(*) FROM public.audit_logs WHERE user_id = '$admin_id' AND request_id IN ('$request_a', '$request_b') AND action = 'update_review_status';")
if [[ "$audit_count" != "1" ]]; then
  printf 'concurrent update persisted %s review audit rows, expected one\n' "$audit_count" >&2
  exit 1
fi
persisted_status=$(psql_local -At -c "SELECT reviewed_status FROM public.work WHERE id = $work_id;")
if [[ "$persisted_status" != "accepted" && "$persisted_status" != "rejected" ]]; then
  printf 'concurrent update persisted unexpected status %s\n' "$persisted_status" >&2
  exit 1
fi

printf 'PASS: two independent PostgreSQL sessions serialized conflicting review-status changes; one persisted with one audit and one stale request was rejected\n'
