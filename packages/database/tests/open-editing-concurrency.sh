#!/usr/bin/env bash
set -euo pipefail

stack_port=$(node "$(dirname "$0")/../../../scripts/local-supabase.mjs" db-port)

# Uses the local disposable Supabase instance and independent PostgreSQL sessions to prove the
# open-editing writes serialize correctly:
#   1. a community edit and a trusted validation of the same credit cannot both win;
#   2. two simultaneous identical credit creations leave exactly one credit;
#   3. two simultaneous first picture uploads leave exactly one winner and one audit row.
DB_HOST=127.0.0.1
DB_PORT=${T10_TEST_DB_PORT:-$stack_port}
DB_NAME=${PGDATABASE:-postgres}
DB_USER=postgres
export PGPASSWORD=${T10_TEST_DB_PASSWORD:-postgres}

psql_local() {
  psql -X -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" "$@"
}

tmpdir=$(mktemp -d /tmp/dubbingbase-open-editing-race.XXXXXX)
community_a=00000000-0000-0000-0000-000056370001
community_b=00000000-0000-0000-0000-000056370002
trusted_id=00000000-0000-0000-0000-000056370003
voice_actor_id=563700001
picture_actor_id=563700002
content_id=563700101
fixtures_created=0

cleanup() {
  if [[ "$fixtures_created" == "1" ]]; then
    psql_local >/dev/null <<SQL
SET session_replication_role = replica;
DELETE FROM public.audit_logs WHERE user_id IN ('$community_a', '$community_b', '$trusted_id');
DELETE FROM public.work WHERE voice_actor_id = $voice_actor_id;
DELETE FROM public.dubbing_projects WHERE media_id IN (SELECT id FROM public.media WHERE kind = 'movie' AND content_id = $content_id);
DELETE FROM public.media WHERE kind = 'movie' AND content_id = $content_id;
DELETE FROM public.voice_actors WHERE id IN ($voice_actor_id, $picture_actor_id);
DELETE FROM auth.users WHERE id IN ('$community_a', '$community_b', '$trusted_id');
SQL
  fi
  rm -rf "$tmpdir"
}
trap cleanup EXIT

psql_local >/dev/null <<SQL
DO \$\$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id IN ('$community_a', '$community_b', '$trusted_id'))
     OR EXISTS (SELECT 1 FROM public.voice_actors WHERE id IN ($voice_actor_id, $picture_actor_id))
     OR EXISTS (SELECT 1 FROM public.dubbing_projects WHERE media_id IN (SELECT id FROM public.media WHERE kind = 'movie' AND content_id = $content_id)) THEN
    RAISE EXCEPTION 'open editing concurrency fixture ids are already in use';
  END IF;
END;
\$\$;
SQL
fixtures_created=1
psql_local >/dev/null <<SQL
INSERT INTO auth.users (id, raw_app_meta_data, email_confirmed_at) VALUES
  ('$community_a', '{}'::JSONB, now()),
  ('$community_b', '{}'::JSONB, now()),
  ('$trusted_id', '{"trusted":true}'::JSONB, now());
INSERT INTO public.voice_actors (id, firstname, lastname) VALUES
  ($voice_actor_id, 'Open Race', 'Voice Actor'),
  ($picture_actor_id, 'Picture Race', 'Voice Actor');
SQL

run_pair() {
  # run_pair <name> <sql-a> <sql-b>: run both statements in separate sessions at the same time.
  local name=$1 sql_a=$2 sql_b=$3
  printf 'SET ROLE service_role;\nSELECT pg_sleep(0.25);\n%s\n' "$sql_a" >"$tmpdir/$name-a.sql"
  printf 'SET ROLE service_role;\nSELECT pg_sleep(0.25);\n%s\n' "$sql_b" >"$tmpdir/$name-b.sql"
  psql_local -q -t -A -f "$tmpdir/$name-a.sql" >"$tmpdir/$name-a.out" 2>&1 &
  local pid_a=$!
  psql_local -q -t -A -f "$tmpdir/$name-b.sql" >"$tmpdir/$name-b.out" 2>&1 &
  local pid_b=$!
  set +e
  wait "$pid_a"; status_a=$?
  wait "$pid_b"; status_b=$?
  set -e
}

fail() {
  printf '%s\n' "$1" >&2
  cat "$tmpdir"/*.out >&2 2>/dev/null || true
  exit 1
}

# --- 2. simultaneous identical creations leave exactly one credit
create_sql() {
  printf "SELECT work_id FROM public.create_voice_actor_work_link('%s', '%s', %s, %s, 'movie', 'fr-FR', NULL, NULL, 'Race role', 'dialogues');" "$1" "$2" "$voice_actor_id" "$content_id"
}
run_pair create "$(create_sql "$community_a" 56370000-0000-4000-8000-000000000001)" \
                "$(create_sql "$community_b" 56370000-0000-4000-8000-000000000002)"
[[ "$status_a" == "0" && "$status_b" == "0" ]] || fail "both identical creations should succeed (one creates, one links); got $status_a and $status_b"
credit_count=$(psql_local -At -c "SELECT count(*) FROM public.work WHERE voice_actor_id = $voice_actor_id;")
[[ "$credit_count" == "1" ]] || fail "simultaneous identical creations left $credit_count credits, expected 1"

work_id=$(psql_local -At -c "SELECT id FROM public.work WHERE voice_actor_id = $voice_actor_id;")
expected_updated_at=$(psql_local -At -c "SELECT updated_at FROM public.work WHERE id = $work_id;")
[[ "$(psql_local -At -c "SELECT reviewed_status FROM public.work WHERE id = $work_id;")" == "waiting" ]] \
  || fail "a community-created credit must start unverified"

# --- 1. community edit vs trusted validation of the same credit
run_pair review \
  "SELECT work_id FROM public.update_voice_actor_work_performance('$community_a', '56370000-0000-4000-8000-000000000011', $work_id, '$expected_updated_at'::TIMESTAMPTZ, 'voice');" \
  "SELECT work_id FROM public.update_work_review_status_controlled('$trusted_id', '56370000-0000-4000-8000-000000000012', $work_id, '$expected_updated_at'::TIMESTAMPTZ, 'accepted');"
if { [[ "$status_a" == "0" ]] && [[ "$status_b" == "0" ]]; } || \
   { [[ "$status_a" != "0" ]] && [[ "$status_b" != "0" ]]; }; then
  fail "expected exactly one of the edit and the validation to win; got exit statuses $status_a and $status_b"
fi
loser="$tmpdir/review-a.out"; [[ "$status_a" == "0" ]] && loser="$tmpdir/review-b.out"
grep -q 'Work changed since it was loaded' "$loser" || fail "losing writer failed for an unexpected reason"
final_status=$(psql_local -At -c "SELECT reviewed_status FROM public.work WHERE id = $work_id;")
final_performance=$(psql_local -At -c "SELECT performance FROM public.work WHERE id = $work_id;")
if [[ "$status_a" == "0" ]]; then
  [[ "$final_status" == "waiting" && "$final_performance" == "voice" ]] || fail "edit won but state is $final_status/$final_performance"
else
  [[ "$final_status" == "accepted" && "$final_performance" == "dialogues" ]] || fail "validation won but state is $final_status/$final_performance"
fi

# --- 3. simultaneous first picture uploads: one winner, one audit row
pic_sql() {
  printf "SELECT audit_log_id FROM public.controlled_set_voice_actor_picture('%s', %s, '%s/%s.png', NULL);" "$1" "$picture_actor_id" "$picture_actor_id" "$2"
}
run_pair picture "$(pic_sql "$community_a" 56370000-0000-4000-8000-0000000000a1)" \
                 "$(pic_sql "$community_b" 56370000-0000-4000-8000-0000000000a2)"
if { [[ "$status_a" == "0" ]] && [[ "$status_b" == "0" ]]; } || \
   { [[ "$status_a" != "0" ]] && [[ "$status_b" != "0" ]]; }; then
  fail "expected exactly one first picture upload to win; got exit statuses $status_a and $status_b"
fi
loser="$tmpdir/picture-a.out"; [[ "$status_a" == "0" ]] && loser="$tmpdir/picture-b.out"
grep -q 'Profile picture changed during upload' "$loser" || fail "losing picture upload failed for an unexpected reason"
picture_audits=$(psql_local -At -c "SELECT count(*) FROM public.audit_logs WHERE entity_type = 'voice_actor' AND entity_id = '$picture_actor_id' AND user_id IN ('$community_a', '$community_b');")
[[ "$picture_audits" == "1" ]] || fail "simultaneous picture uploads persisted $picture_audits audit rows, expected 1"

printf 'PASS: open-editing writes serialize correctly (one credit, one winning edit/validation, one winning first picture)\n'
