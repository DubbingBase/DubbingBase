#!/usr/bin/env bash
set -euo pipefail

if [[ "${ALLOW_DISPOSABLE_DB_TESTS:-}" != "1" ]]; then
  echo "Set ALLOW_DISPOSABLE_DB_TESTS=1 only for a disposable local database." >&2
  exit 2
fi

: "${PGHOST:=127.0.0.1}"
: "${PGPORT:?Set PGPORT to the disposable local PostgreSQL port}"
: "${PGDATABASE:=postgres}"
: "${PGUSER:=postgres}"
: "${PGPASSWORD:?Set PGPASSWORD for the disposable local database}"
export PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD

if [[ "$PGHOST" != "127.0.0.1" && "$PGHOST" != "localhost" && "$PGHOST" != "::1" ]]; then
  echo "Concurrency regressions are restricted to loopback PostgreSQL." >&2
  exit 2
fi

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"
test_root="$(mktemp -d "${TMPDIR:-/tmp}/project-save-concurrency.XXXXXX")"
trap 'rm -rf "$test_root"' EXIT

actor_id="$(mise exec -- node --input-type=module -e 'import { randomUUID } from "node:crypto"; process.stdout.write(randomUUID())')"
create_request_id="$(mise exec -- node --input-type=module -e 'import { randomUUID } from "node:crypto"; process.stdout.write(randomUUID())')"
idempotent_request_id="$(mise exec -- node --input-type=module -e 'import { randomUUID } from "node:crypto"; process.stdout.write(randomUUID())')"
winner_request_id="$(mise exec -- node --input-type=module -e 'import { randomUUID } from "node:crypto"; process.stdout.write(randomUUID())')"
loser_request_id="$(mise exec -- node --input-type=module -e 'import { randomUUID } from "node:crypto"; process.stdout.write(randomUUID())')"
content_id="$(date +%s)$$"

psql_local() {
  mise exec -- psql -X -qAt -F '|' -v ON_ERROR_STOP=1 "$@"
}

psql_local -c "
  INSERT INTO auth.users (id, raw_app_meta_data)
  VALUES ('$actor_id'::UUID, '{\"role\":\"admin\"}'::JSONB)
" >/dev/null
psql_local -c "
  INSERT INTO public.jobs (id, name) VALUES (1, 'Concurrency fixture job')
  ON CONFLICT (id) DO NOTHING
" >/dev/null

voice_actor_one="$(psql_local -c "
  INSERT INTO public.voice_actors (firstname, lastname)
  VALUES ('Concurrent Project Save', 'One $actor_id') RETURNING id
")"
voice_actor_two="$(psql_local -c "
  INSERT INTO public.voice_actors (firstname, lastname)
  VALUES ('Concurrent Project Save', 'Two $actor_id') RETURNING id
")"

cat > "$test_root/create-project.sql" <<'SQL'
SET ROLE service_role;
SELECT project_id, updated_at, audit_log_id
FROM public.save_dubbing_project_editor(
  :'actor_id'::UUID,
  :'request_id'::UUID,
  NULL,
  NULL,
  jsonb_build_object(
    'content_id', :content_id::BIGINT,
    'content_type', 'movie',
    'language', 'fr-FR',
    'studio_id', NULL,
    'status', 'draft'
  ),
  jsonb_build_array(jsonb_build_object('job_id', 1, 'person_id', :voice_actor_one::BIGINT)),
  jsonb_build_array(jsonb_build_object(
    'character_name', 'Concurrency fixture role',
    'voice_actor_id', :voice_actor_one::BIGINT,
    'performance', 'dialogues',
    'note', 'before concurrent writes'
  ))
);
SQL

created="$(psql_local -f "$test_root/create-project.sql" \
  -v actor_id="$actor_id" -v request_id="$create_request_id" \
  -v content_id="$content_id" -v voice_actor_one="$voice_actor_one")"
IFS='|' read -r project_id project_updated_at _create_audit_id <<< "$created"

work_info="$(psql_local -c "
  SELECT work.id, work.updated_at, jsonb_build_object(
    'actor_id', work.actor_id,
    'character_id', work.character_id,
    'character_name', work.character_name,
    'voice_actor_id', work.voice_actor_id,
    'performance', work.performance,
    'note', work.note,
    'highlight', work.highlight,
    'status', work.status
  )::TEXT
  FROM public.work AS work
  WHERE work.dubbing_project_id = $project_id::BIGINT
")"
IFS='|' read -r work_id work_updated_at expected_work <<< "$work_info"

cat > "$test_root/save.sql" <<'SQL'
SET ROLE service_role;
SELECT project_id, updated_at, audit_log_id, replayed
FROM public.save_dubbing_project_editor(
  :'actor_id'::UUID,
  :'request_id'::UUID,
  :project_id::BIGINT,
  :'expected_project_updated_at'::TIMESTAMP WITHOUT TIME ZONE,
  jsonb_build_object(
    'content_id', :content_id::BIGINT,
    'content_type', 'movie',
    'language', :'language',
    'studio_id', NULL,
    'status', 'draft'
  ),
  jsonb_build_array(jsonb_build_object('job_id', 1, 'person_id', :crew_person_id::BIGINT)),
  jsonb_build_array(jsonb_build_object(
    'id', :work_id::BIGINT,
    'expected_updated_at', :'expected_work_updated_at'::TIMESTAMPTZ,
    'expected', :'expected_work'::JSONB,
    'character_name', :'cast_name',
    'note', :'cast_note'
  ))
);
SQL

run_save() {
  local output_file="$1"
  local request_id="$2"
  local expected_project_at="$3"
  local expected_work_at="$4"
  local expected_work_json="$5"
  local language="$6"
  local crew_person_id="$7"
  local cast_name="$8"
  local cast_note="$9"

  psql_local -f "$test_root/save.sql" \
    -v actor_id="$actor_id" -v request_id="$request_id" \
    -v project_id="$project_id" -v expected_project_updated_at="$expected_project_at" \
    -v content_id="$content_id" -v crew_person_id="$crew_person_id" \
    -v work_id="$work_id" -v expected_work_updated_at="$expected_work_at" \
    -v expected_work="$expected_work_json" -v language="$language" \
    -v cast_name="$cast_name" -v cast_note="$cast_note" > "$output_file" 2>&1
}

cat > "$test_root/idempotent-first.sql" <<'SQL'
BEGIN;
SELECT pg_sleep(0.4);
SQL
cat "$test_root/save.sql" >> "$test_root/idempotent-first.sql"
cat >> "$test_root/idempotent-first.sql" <<'SQL'
SELECT pg_sleep(2);
COMMIT;
SQL

psql_local -f "$test_root/idempotent-first.sql" \
  -v actor_id="$actor_id" -v request_id="$idempotent_request_id" \
  -v project_id="$project_id" -v expected_project_updated_at="$project_updated_at" \
  -v content_id="$content_id" -v crew_person_id="$voice_actor_two" \
  -v work_id="$work_id" -v expected_work_updated_at="$work_updated_at" \
  -v expected_work="$expected_work" -v language="fr-CA" \
  -v cast_name="Idempotent winner" -v cast_note="same request" \
  > "$test_root/idempotent-first.out" 2>&1 &
first_pid=$!
sleep 0.9
run_save "$test_root/idempotent-retry.out" "$idempotent_request_id" \
  "$project_updated_at" "$work_updated_at" "$expected_work" \
  "fr-CA" "$voice_actor_two" "Idempotent winner" "same request"
wait "$first_pid"

first_row="$(awk -F '|' 'NF == 4 && $1 ~ /^[0-9]+$/ { print; exit }' "$test_root/idempotent-first.out")"
retry_row="$(awk -F '|' 'NF == 4 && $1 ~ /^[0-9]+$/ { print; exit }' "$test_root/idempotent-retry.out")"
[[ -n "$first_row" && -n "$retry_row" ]] || { cat "$test_root/idempotent-first.out" "$test_root/idempotent-retry.out" >&2; exit 1; }
IFS='|' read -r project_id project_updated_at first_audit_id first_replayed <<< "$first_row"
IFS='|' read -r retry_project_id retry_updated_at retry_audit_id retry_replayed <<< "$retry_row"
[[ "$first_replayed" == "f" && "$retry_replayed" == "t" ]] || { echo "identical retry did not replay" >&2; exit 1; }
[[ "$project_id" == "$retry_project_id" && "$project_updated_at" == "$retry_updated_at" && "$first_audit_id" == "$retry_audit_id" ]] || {
  echo "identical retry returned a different project version or audit event" >&2
  exit 1
}

work_info="$(psql_local -c "
  SELECT work.id, work.updated_at, jsonb_build_object(
    'actor_id', work.actor_id, 'character_id', work.character_id,
    'character_name', work.character_name, 'voice_actor_id', work.voice_actor_id,
    'performance', work.performance, 'note', work.note,
    'highlight', work.highlight, 'status', work.status
  )::TEXT
  FROM public.work AS work WHERE work.dubbing_project_id = $project_id::BIGINT
")"
IFS='|' read -r work_id work_updated_at expected_work <<< "$work_info"

cat > "$test_root/stale-first.sql" <<'SQL'
BEGIN;
SELECT pg_sleep(0.4);
SQL
cat "$test_root/save.sql" >> "$test_root/stale-first.sql"
cat >> "$test_root/stale-first.sql" <<'SQL'
SELECT pg_sleep(2);
COMMIT;
SQL

psql_local -f "$test_root/stale-first.sql" \
  -v actor_id="$actor_id" -v request_id="$winner_request_id" \
  -v project_id="$project_id" -v expected_project_updated_at="$project_updated_at" \
  -v content_id="$content_id" -v crew_person_id="$voice_actor_one" \
  -v work_id="$work_id" -v expected_work_updated_at="$work_updated_at" \
  -v expected_work="$expected_work" -v language="fr-FR" \
  -v cast_name="Concurrent winner" -v cast_note="winner" \
  > "$test_root/stale-first.out" 2>&1 &
stale_first_pid=$!
sleep 0.9
if psql_local -v VERBOSITY=verbose -f "$test_root/save.sql" \
  -v actor_id="$actor_id" -v request_id="$loser_request_id" \
  -v project_id="$project_id" -v expected_project_updated_at="$project_updated_at" \
  -v content_id="$content_id" -v crew_person_id="$voice_actor_two" \
  -v work_id="$work_id" -v expected_work_updated_at="$work_updated_at" \
  -v expected_work="$expected_work" -v language="fr-CA" \
  -v cast_name="Concurrent loser" -v cast_note="loser" \
  > "$test_root/stale-loser.out" 2>&1; then
  echo "concurrent stale modification unexpectedly succeeded" >&2
  exit 1
fi
wait "$stale_first_pid"
rg -q "55000.*project changed since it was loaded|project changed since it was loaded" "$test_root/stale-loser.out" || {
  cat "$test_root/stale-loser.out" >&2
  echo "stale concurrent modification did not return the expected conflict" >&2
  exit 1
}

persisted="$(psql_local -c "
  SELECT project.language, crew.person_id, work.character_name, work.note,
    (SELECT count(*) FROM public.audit_logs WHERE request_id = '$idempotent_request_id'::UUID),
    (SELECT count(*) FROM public.audit_logs WHERE request_id = '$winner_request_id'::UUID),
    (SELECT count(*) FROM public.audit_logs WHERE request_id = '$loser_request_id'::UUID)
  FROM public.dubbing_projects AS project
  JOIN public.dubbing_project_crew AS crew ON crew.dubbing_project_id = project.id AND crew.job_id = 1
  JOIN public.work AS work ON work.dubbing_project_id = project.id
  WHERE project.id = $project_id::BIGINT
")"
IFS='|' read -r final_language final_crew final_cast final_note retry_audits winner_audits loser_audits <<< "$persisted"
[[ "$final_language" == "fr-FR" && "$final_crew" == "$voice_actor_one" \
  && "$final_cast" == "Concurrent winner" && "$final_note" == "winner" \
  && "$retry_audits" == "1" && "$winner_audits" == "1" && "$loser_audits" == "0" ]] || {
  echo "concurrent save persisted unexpected project, crew, cast, or audit state: $persisted" >&2
  exit 1
}

echo "PASS: duplicate concurrent retry produced one audited mutation; stale overlapping project, crew, and cast update conflicted; persisted winner state verified."
echo "Disposable fixtures remain in database $PGDATABASE; discard this database after the test."
