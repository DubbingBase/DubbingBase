#!/usr/bin/env bash
set -euo pipefail

readonly db_host="127.0.0.1"
readonly db_port="55322"
readonly content_id="991234568"
readonly actor_id="999999997"
readonly firstname="ConcurrentBulk"
readonly lastname="Fixture"
readonly credit_json="[{\"firstname\":\"${firstname}\",\"lastname\":\"${lastname}\",\"actor_id\":${actor_id},\"performance\":\"voice\"}]"

if ! pg_isready -h "${db_host}" -p "${db_port}" -U postgres >/dev/null 2>&1; then
  echo "Start the local Supabase database before running this test." >&2
  exit 1
fi

cleanup() {
  PGPASSWORD=postgres psql -v ON_ERROR_STOP=1 -h "${db_host}" -p "${db_port}" -U postgres -d postgres \
    -c "DELETE FROM public.dubbing_projects WHERE content_id = ${content_id} AND content_type = 'movie' AND language = 'fr-FR'; DELETE FROM public.voice_actors WHERE firstname = '${firstname}' AND lastname = '${lastname}';" \
    >/dev/null
}
trap cleanup EXIT
cleanup

query="SELECT public.apply_extracted_credits(${content_id}, 'movie', 'fr-FR', '${credit_json}'::jsonb)"
PGPASSWORD=postgres psql -v ON_ERROR_STOP=1 -h "${db_host}" -p "${db_port}" -U postgres -d postgres -c "${query}" >/dev/null &
first_pid=$!
PGPASSWORD=postgres psql -v ON_ERROR_STOP=1 -h "${db_host}" -p "${db_port}" -U postgres -d postgres -c "${query}" >/dev/null &
second_pid=$!
wait "${first_pid}"
wait "${second_pid}"

counts=$(PGPASSWORD=postgres psql -v ON_ERROR_STOP=1 -h "${db_host}" -p "${db_port}" -U postgres -d postgres -Atqc \
  "SELECT (SELECT count(*) FROM public.dubbing_projects WHERE content_id = ${content_id} AND content_type = 'movie' AND language = 'fr-FR') || ':' || (SELECT count(*) FROM public.voice_actors WHERE firstname = '${firstname}' AND lastname = '${lastname}') || ':' || (SELECT count(*) FROM public.work AS work JOIN public.dubbing_projects AS project ON project.id = work.dubbing_project_id WHERE project.content_id = ${content_id} AND project.content_type = 'movie' AND project.language = 'fr-FR')")

if [[ "${counts}" != "1:1:1" ]]; then
  echo "Concurrent bulk persistence produced unexpected project:voice_actor:work counts ${counts}." >&2
  exit 1
fi

echo "Concurrent bulk persistence passed: one project, one voice actor, one work row."
