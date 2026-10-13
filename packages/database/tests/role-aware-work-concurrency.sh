#!/usr/bin/env bash
set -euo pipefail

db_port="${LOCAL_SUPABASE_DB_PORT:-55322}"
db_password="${LOCAL_SUPABASE_DB_PASSWORD:-postgres}"
connection=( -h 127.0.0.1 -p "$db_port" -U postgres -d postgres -v ON_ERROR_STOP=1 )
content_id="$(date +%s)000"
project_id=""
first_pid=""

cleanup() {
  if [[ -n "$first_pid" ]]; then
    wait "$first_pid" 2>/dev/null || true
  fi
  if [[ -n "$project_id" ]]; then
    PGPASSWORD="$db_password" psql "${connection[@]}" \
      -c "DELETE FROM public.dubbing_projects WHERE id = ${project_id}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

project_id="$(PGPASSWORD="$db_password" psql -qAt "${connection[@]}" -c \
  "INSERT INTO public.dubbing_projects(content_id, content_type, language) VALUES (${content_id}, 'movie', 'fr-FR') RETURNING id")"

PGPASSWORD="$db_password" psql "${connection[@]}" -c \
  "BEGIN; INSERT INTO public.work(dubbing_project_id, actor_id, voice_actor_id, character_id, character_name) VALUES (${project_id}, NULL, NULL, NULL, 'Race Role'); SELECT pg_sleep(2); COMMIT;" \
  >/tmp/role-aware-work-first-writer.log 2>&1 &
first_pid=$!
sleep 0.2

set +e
PGPASSWORD="$db_password" psql "${connection[@]}" -c \
  "INSERT INTO public.work(dubbing_project_id, actor_id, voice_actor_id, character_id, character_name) VALUES (${project_id}, NULL, NULL, NULL, ' race role ');" \
  >/tmp/role-aware-work-second-writer.log 2>&1
second_status=$?
wait "$first_pid"
first_status=$?
first_pid=""
set -e

if [[ "$first_status" -ne 0 || "$second_status" -eq 0 ]]; then
  cat /tmp/role-aware-work-first-writer.log /tmp/role-aware-work-second-writer.log
  exit 1
fi
if ! rg -q 'duplicate work assignment already exists|work_unique_assignment_role_aware' \
  /tmp/role-aware-work-second-writer.log; then
  cat /tmp/role-aware-work-second-writer.log
  exit 1
fi

row_count="$(PGPASSWORD="$db_password" psql -qAt "${connection[@]}" -c \
  "SELECT count(*) FROM public.work WHERE dubbing_project_id = ${project_id} AND lower(btrim(character_name)) = 'race role'")"
if [[ "$row_count" != "1" ]]; then
  printf 'Expected one role row after the race; found %s\n' "$row_count"
  exit 1
fi

printf 'Concurrent inserts: one committed and one received a duplicate violation.\n'
