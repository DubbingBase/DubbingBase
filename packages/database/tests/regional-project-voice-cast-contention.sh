#!/usr/bin/env bash
set -euo pipefail

# Run only against a fresh, seed-disabled local Supabase database. Audit rows
# are intentionally immutable, so this test leaves synthetic rows for the
# caller to remove with a local database reset after verification.
db_host="${DB_HOST:-127.0.0.1}"
db_port="${DB_PORT:-55322}"
db_user="${DB_USER:-postgres}"
db_name="${DB_NAME:-postgres}"
export PGPASSWORD="${PGPASSWORD:-postgres}"

if [[ "$db_host" != "127.0.0.1" && "$db_host" != "localhost" ]] \
  || [[ ! "$db_port" =~ ^[0-9]{1,5}$ ]] \
  || (( db_port < 1024 || db_port > 65535 )) \
  || [[ "$db_name" != "postgres" ]]; then
  printf '%s\n' 'Use a loopback PostgreSQL database named postgres.' >&2
  exit 2
fi

psql_local() {
  psql -X -qAt -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -v ON_ERROR_STOP=1 "$@"
}

if ! pg_isready -h "$db_host" -p "$db_port" -U "$db_user" >/dev/null 2>&1; then
  printf '%s\n' 'Start the isolated local Supabase database before running this test.' >&2
  exit 1
fi

nonempty_state="$(psql_local -c "SELECT
  (SELECT count(*) FROM public.dubbing_projects)
  + (SELECT count(*) FROM public.work)
  + (SELECT count(*) FROM public.audit_logs)
  + (SELECT count(*) FROM public.voice_actors);")"
if [[ "$nonempty_state" != "0" ]]; then
  printf '%s\n' 'This contention regression requires a fresh, seed-disabled database with no business or audit rows.' >&2
  exit 2
fi

run_suffix="$(psql_local -c "SELECT replace(gen_random_uuid()::TEXT, '-', '')")"
run_suffix="${run_suffix:0:12}"
admin_id="$(psql_local -c 'SELECT gen_random_uuid()')"
request_id="$(psql_local -c 'SELECT gen_random_uuid()')"
stale_first_request="$(psql_local -c 'SELECT gen_random_uuid()')"
stale_second_request="$(psql_local -c 'SELECT gen_random_uuid()')"
content_id="$((980000000 + $$))"
actor_new="$((720000000 + $$))"
actor_stale="$((730000000 + $$))"
project_id=""
work_id=""
first_pid=""
second_pid=""
delay_function="regional_assignment_race_delay_${run_suffix}"
delay_trigger="regional_assignment_race_${run_suffix}"
first_log="/tmp/regional-assignment-race-${run_suffix}-first.log"
second_log="/tmp/regional-assignment-race-${run_suffix}-second.log"

cleanup() {
  for pid in "$first_pid" "$second_pid"; do
    if [[ -n "$pid" ]]; then wait "$pid" 2>/dev/null || true; fi
  done
  psql_local -v delay_function="$delay_function" -v delay_trigger="$delay_trigger" \
    >/dev/null 2>&1 <<'SQL' || true
DROP TRIGGER IF EXISTS :"delay_trigger" ON public.audit_logs;
DROP FUNCTION IF EXISTS public.:"delay_function"();
SQL
  rm -f "$first_log" "$second_log"
}
trap cleanup EXIT

psql_local -v admin_id="$admin_id" <<'SQL' >/dev/null
INSERT INTO auth.users (id, raw_app_meta_data)
VALUES (:'admin_id'::UUID, '{"role":"admin"}'::JSONB);
INSERT INTO public.voice_actors (firstname, lastname)
VALUES ('RegionalRace-' || :'admin_id', 'One'),
       ('RegionalRace-' || :'admin_id', 'Two'),
       ('RegionalRace-' || :'admin_id', 'Three');
SQL

va_one="$(psql_local -v admin_id="$admin_id" -c "SELECT id FROM public.voice_actors WHERE firstname = 'RegionalRace-${admin_id}' AND lastname = 'One'")"
va_two="$(psql_local -v admin_id="$admin_id" -c "SELECT id FROM public.voice_actors WHERE firstname = 'RegionalRace-${admin_id}' AND lastname = 'Two'")"
va_three="$(psql_local -v admin_id="$admin_id" -c "SELECT id FROM public.voice_actors WHERE firstname = 'RegionalRace-${admin_id}' AND lastname = 'Three'")"

psql_local -v delay_function="$delay_function" -v delay_trigger="$delay_trigger" <<'SQL' >/dev/null
CREATE FUNCTION public.:"delay_function"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $test$
BEGIN
  IF current_setting('application_name', TRUE) LIKE 'regional_assignment_race_%' THEN
    PERFORM pg_sleep(0.75);
  END IF;
  RETURN NEW;
END;
$test$;
CREATE TRIGGER :"delay_trigger"
BEFORE INSERT ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.:"delay_function"();
SQL

first_app="regional_assignment_race_${run_suffix}_duplicate_first"
second_app="regional_assignment_race_${run_suffix}_duplicate_second"
PGAPPNAME="$first_app" psql_local \
  -v admin_id="$admin_id" -v content_id="$content_id" -v actor_id="$actor_new" \
  -v va_id="$va_one" -v request_id="$request_id" >"$first_log" 2>&1 <<'SQL' &
  SET ROLE service_role;
  SELECT public.save_regional_project_actor_assignments(
    :'content_id'::BIGINT, 'movie', 'fr-FR',
    jsonb_build_array(jsonb_build_object(
      'actor_id', :'actor_id'::BIGINT,
      'work_id', NULL,
      'expected_voice_actor_id', NULL,
      'voice_actor_id', :'va_id'::BIGINT
    )),
    :'admin_id'::UUID,
    :'request_id'::UUID
  );
  RESET ROLE;
SQL
first_pid=$!

first_in_audit="0"
for _ in $(seq 1 250); do
  first_in_audit="$(psql_local -c "SELECT count(*) FROM pg_stat_activity WHERE application_name = '${first_app}' AND state = 'active' AND wait_event = 'PgSleep'")"
  if [[ "$first_in_audit" == "1" ]]; then break; fi
  if ! kill -0 "$first_pid" 2>/dev/null; then break; fi
  sleep 0.01
done
if [[ "$first_in_audit" != "1" ]]; then
  cat "$first_log" >&2
  printf '%s\n' 'First duplicate request did not reach the audit barrier.' >&2
  exit 1
fi

PGAPPNAME="$second_app" psql_local \
  -v admin_id="$admin_id" -v content_id="$content_id" -v actor_id="$actor_new" \
  -v va_id="$va_one" -v request_id="$request_id" >"$second_log" 2>&1 <<'SQL' &
  SET ROLE service_role;
  SELECT public.save_regional_project_actor_assignments(
    :'content_id'::BIGINT, 'movie', 'fr-FR',
    jsonb_build_array(jsonb_build_object(
      'actor_id', :'actor_id'::BIGINT,
      'work_id', NULL,
      'expected_voice_actor_id', NULL,
      'voice_actor_id', :'va_id'::BIGINT
    )),
    :'admin_id'::UUID,
    :'request_id'::UUID
  );
  RESET ROLE;
SQL
second_pid=$!

second_status=0
if wait "$second_pid"; then second_status=0; else second_status=$?; fi
second_pid=""
first_status=0
if wait "$first_pid"; then first_status=0; else first_status=$?; fi
first_pid=""
if [[ "$first_status" != "0" || "$second_status" != "0" ]]; then
  cat "$first_log" "$second_log" >&2
  printf '%s\n' 'Duplicate request race failed in PostgreSQL.' >&2
  exit 1
fi

project_id="$(psql_local -c "SELECT id FROM public.dubbing_projects WHERE content_id = ${content_id} AND content_type = 'movie' AND language = 'fr-FR'")"
work_id="$(psql_local -c "SELECT id FROM public.work WHERE dubbing_project_id = ${project_id} AND actor_id = ${actor_new}")"
duplicate_state="$(psql_local -c "SELECT
  (SELECT count(*) FROM public.work WHERE id = ${work_id})::TEXT
  || ':' || (SELECT count(*) FROM public.audit_logs WHERE user_id = '${admin_id}'::UUID AND entity_id IN ('${project_id}', '${work_id}'))::TEXT
  || ':' || (SELECT count(*) FROM private.regional_assignment_request_audits WHERE actor_id = '${admin_id}'::UUID AND request_id = '${request_id}'::UUID)::TEXT")"
if [[ "$duplicate_state" != "1:2:2" ]]; then
  printf 'Unexpected duplicate retry state: %s (expected 1 work, 2 audit events, 2 request links).\n' "$duplicate_state" >&2
  exit 1
fi

psql_local -v project_id="$project_id" -v actor_id="$actor_stale" \
  -v va_one="$va_one" -v admin_id="$admin_id" <<'SQL' >/dev/null
INSERT INTO public.work (dubbing_project_id, actor_id, voice_actor_id, performance, status, created_by, updated_by)
VALUES (:'project_id'::BIGINT, :'actor_id'::BIGINT, :'va_one'::BIGINT,
  'voice', 'validated', :'admin_id'::UUID, :'admin_id'::UUID)
RETURNING id AS work_id \gset
SQL
stale_work_id="$(psql_local -c "SELECT id FROM public.work WHERE dubbing_project_id = ${project_id} AND actor_id = ${actor_stale}")"

stale_first_app="regional_assignment_race_${run_suffix}_stale_first"
stale_second_app="regional_assignment_race_${run_suffix}_stale_second"
PGAPPNAME="$stale_first_app" psql_local \
  -v admin_id="$admin_id" -v content_id="$content_id" -v actor_id="$actor_stale" \
  -v work_id="$stale_work_id" -v expected_va="$va_one" -v new_va="$va_two" \
  -v request_id="$stale_first_request" >"$first_log" 2>&1 <<'SQL' &
  SET ROLE service_role;
  SELECT public.save_regional_project_actor_assignments(
    :'content_id'::BIGINT, 'movie', 'fr-FR',
    jsonb_build_array(jsonb_build_object(
      'actor_id', :'actor_id'::BIGINT,
      'work_id', :'work_id'::BIGINT,
      'expected_voice_actor_id', :'expected_va'::BIGINT,
      'voice_actor_id', :'new_va'::BIGINT
    )),
    :'admin_id'::UUID,
    :'request_id'::UUID
  );
  RESET ROLE;
SQL
first_pid=$!

first_in_audit="0"
for _ in $(seq 1 250); do
  first_in_audit="$(psql_local -c "SELECT count(*) FROM pg_stat_activity WHERE application_name = '${stale_first_app}' AND state = 'active' AND wait_event = 'PgSleep'")"
  if [[ "$first_in_audit" == "1" ]]; then break; fi
  if ! kill -0 "$first_pid" 2>/dev/null; then break; fi
  sleep 0.01
done
if [[ "$first_in_audit" != "1" ]]; then
  cat "$first_log" >&2
  printf '%s\n' 'First stale update did not reach the audit barrier.' >&2
  exit 1
fi

PGAPPNAME="$stale_second_app" psql_local \
  -v admin_id="$admin_id" -v content_id="$content_id" -v actor_id="$actor_stale" \
  -v work_id="$stale_work_id" -v expected_va="$va_one" -v new_va="$va_three" \
  -v request_id="$stale_second_request" >"$second_log" 2>&1 <<'SQL' &
  SET ROLE service_role;
  SELECT public.save_regional_project_actor_assignments(
    :'content_id'::BIGINT, 'movie', 'fr-FR',
    jsonb_build_array(jsonb_build_object(
      'actor_id', :'actor_id'::BIGINT,
      'work_id', :'work_id'::BIGINT,
      'expected_voice_actor_id', :'expected_va'::BIGINT,
      'voice_actor_id', :'new_va'::BIGINT
    )),
    :'admin_id'::UUID,
    :'request_id'::UUID
  );
  RESET ROLE;
SQL
second_pid=$!

second_status=0
if wait "$second_pid"; then second_status=0; else second_status=$?; fi
second_pid=""
first_status=0
if wait "$first_pid"; then first_status=0; else first_status=$?; fi
first_pid=""
if [[ "$first_status" != "0" || "$second_status" == "0" ]] \
  || ! rg -q '40001|serialization failure|changed since it was loaded' "$second_log"; then
  cat "$first_log" "$second_log" >&2
  printf '%s\n' 'Stale update race did not produce one commit and one serialization rejection.' >&2
  exit 1
fi

stale_state="$(psql_local -c "SELECT
  ((SELECT voice_actor_id FROM public.work WHERE id = ${stale_work_id}) = ${va_two})::TEXT
  || ':' || (SELECT count(*) FROM public.audit_logs WHERE entity_type = 'work' AND entity_id = '${stale_work_id}' AND user_id = '${admin_id}'::UUID AND action = 'update')::TEXT
  || ':' || (SELECT count(*) FROM private.regional_assignment_requests WHERE actor_id = '${admin_id}'::UUID AND request_id = '${stale_first_request}'::UUID)::TEXT")"
if [[ "$stale_state" != "true:1:1" ]]; then
  printf 'Unexpected stale update state: %s (expected winning value, one audit, one accepted request).\n' "$stale_state" >&2
  exit 1
fi

printf '%s\n' 'PASS: duplicate request race produced one project/work write and one audit per entity.'
printf '%s\n' 'PASS: competing stale update produced one audited winner and one 40001 rejection.'
