#!/usr/bin/env bash
set -euo pipefail

# Two-session proof for claim acquisition and duplicate contribution submission.
# Run only against the local Supabase database after applying all migrations.
db_host="${DB_HOST:-127.0.0.1}"
db_port="${DB_PORT:-55322}"
db_user="${DB_USER:-postgres}"
db_name="${DB_NAME:-postgres}"
export PGPASSWORD="${PGPASSWORD:-postgres}"

if [[ "$db_host" != "127.0.0.1" && "$db_host" != "localhost" ]] \
  || [[ ! "$db_port" =~ ^[0-9]+$ ]] \
  || (( db_port < 1024 || db_port > 65535 )) \
  || [[ "$db_name" != "postgres" ]]; then
  printf '%s\n' 'This regression fixture only permits a loopback PostgreSQL database named postgres.' >&2
  exit 2
fi

psql_local() {
  psql -X -qAt -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -v ON_ERROR_STOP=1 "$@"
}

if ! pg_isready -h "$db_host" -p "$db_port" -U "$db_user" >/dev/null 2>&1; then
  printf '%s\n' 'Start the local Supabase database before running this test.' >&2
  exit 1
fi

existing_claim_count="$(psql_local -c 'SELECT count(*) FROM public.gamification_task_locks')"
if [[ "$existing_claim_count" != "0" ]]; then
  printf '%s\n' 'This concurrency regression requires an empty task-lock table; use a disposable local database.' >&2
  exit 2
fi

fixture_dir="$(mktemp -d)"
first_user="$(psql_local -c 'SELECT gen_random_uuid()')"
second_user="$(psql_local -c 'SELECT gen_random_uuid()')"
submission_claim="$(psql_local -c 'SELECT gen_random_uuid()')"
run_suffix="${first_user//-/}"
run_suffix="${run_suffix:0:12}"
delay_function="atomic_task_delay_fn_${run_suffix}"
delay_trigger="atomic_task_delay_${run_suffix}"
claim_first_app="atomic_claim_first_${run_suffix}"
claim_second_app="atomic_claim_second_${run_suffix}"
submit_first_app="atomic_submit_first_${run_suffix}"
submit_second_app="atomic_submit_second_${run_suffix}"
claim_first_pid=""
claim_second_pid=""
submit_first_pid=""
submit_second_pid=""

cleanup() {
  for pid in "$claim_first_pid" "$claim_second_pid" "$submit_first_pid" "$submit_second_pid"; do
    if [[ -n "$pid" ]]; then wait "$pid" 2>/dev/null || true; fi
  done
  if [[ -n "$first_user" && -n "$second_user" ]]; then
    if [[ -n "$delay_trigger" ]]; then
      psql_local -v delay_trigger="$delay_trigger" -v delay_function="$delay_function" >/dev/null 2>&1 <<'SQL' || true
DROP TRIGGER IF EXISTS :"delay_trigger" ON public.audit_logs;
DROP FUNCTION IF EXISTS public.:"delay_function"();
SQL
    fi
    psql_local -v first_user="$first_user" -v second_user="$second_user" \
      >/dev/null 2>&1 <<'SQL' || true
DELETE FROM public.gamification_task_locks
WHERE user_id IN (:'first_user'::UUID, :'second_user'::UUID);
DELETE FROM public.audit_logs
WHERE user_id IN (:'first_user'::UUID, :'second_user'::UUID);
DELETE FROM public.voice_actors
WHERE firstname IN ('AtomicClaim-' || :'first_user', 'AtomicClaim-' || :'second_user', 'AtomicSubmit-' || :'first_user');
DELETE FROM auth.users
WHERE id IN (:'first_user'::UUID, :'second_user'::UUID);
SQL
  fi
  rm -rf "$fixture_dir"
}
trap cleanup EXIT

psql_local -v first_user="$first_user" -v second_user="$second_user" <<'SQL' >/dev/null
INSERT INTO auth.users (id) VALUES (:'first_user'::UUID), (:'second_user'::UUID);
INSERT INTO public.voice_actors (firstname, lastname)
VALUES
  ('AtomicClaim-' || :'first_user', 'Fixture'),
  ('AtomicClaim-' || :'second_user', 'Fixture');
SQL

PGAPPNAME="$claim_first_app" psql_local -v first_user="$first_user" \
  >"$fixture_dir/claim-first.log" 2>&1 <<'SQL' &
BEGIN;
SELECT setseed(0.4137);
SELECT COALESCE(task->>'id', '<none>') || '|' || COALESCE(claim_id::TEXT, '')
FROM public.claim_gamification_task('enrich_voice_actor', :'first_user'::UUID);
SELECT pg_sleep(2);
COMMIT;
SQL
claim_first_pid=$!

claim_first_sleeping=0
for _ in $(seq 1 100); do
  wait_state="$(psql_local -c "SELECT COALESCE(wait_event_type, '') || '|' || COALESCE(wait_event, '') FROM pg_stat_activity WHERE application_name = '$claim_first_app'")"
  if [[ "$wait_state" == "Timeout|PgSleep" ]]; then claim_first_sleeping=1; break; fi
  if ! kill -0 "$claim_first_pid" 2>/dev/null; then cat "$fixture_dir/claim-first.log" >&2; exit 1; fi
  sleep 0.05
done
if [[ "$claim_first_sleeping" != "1" ]]; then
  cat "$fixture_dir/claim-first.log" >&2
  printf '%s\n' 'Timed out waiting for the first task claim.' >&2
  exit 1
fi

PGAPPNAME="$claim_second_app" psql_local -v second_user="$second_user" \
  >"$fixture_dir/claim-second.log" 2>&1 <<'SQL' &
SELECT setseed(0.4137);
SELECT COALESCE(task->>'id', '<none>') || '|' || COALESCE(claim_id::TEXT, '')
FROM public.claim_gamification_task('enrich_voice_actor', :'second_user'::UUID);
SQL
claim_second_pid=$!

claim_second_status=0
if wait "$claim_second_pid"; then claim_second_status=0; else claim_second_status=$?; fi
claim_second_pid=""
if [[ "$claim_second_status" != "0" ]]; then
  cat "$fixture_dir/claim-first.log" "$fixture_dir/claim-second.log" >&2
  printf 'The competing task claimant failed with status %s.\n' "$claim_second_status" >&2
  exit 1
fi
if ! kill -0 "$claim_first_pid" 2>/dev/null; then
  cat "$fixture_dir/claim-first.log" "$fixture_dir/claim-second.log" >&2
  printf '%s\n' 'The competing claimant did not finish while the first transaction held its task lock.' >&2
  exit 1
fi
claim_first_status=0
if wait "$claim_first_pid"; then claim_first_status=0; else claim_first_status=$?; fi
claim_first_pid=""
if [[ "$claim_first_status" != "0" ]]; then
  cat "$fixture_dir/claim-first.log" "$fixture_dir/claim-second.log" >&2
  printf 'The first task claimant failed with status %s.\n' "$claim_first_status" >&2
  exit 1
fi
claim_first_result="$(awk -F '|' 'NF == 2 && $1 != "" { print; exit }' "$fixture_dir/claim-first.log")"
claim_second_result="$(awk -F '|' 'NF == 2 && $1 != "" { print; exit }' "$fixture_dir/claim-second.log")"
claim_first_task="${claim_first_result%%|*}"
claim_second_task="${claim_second_result%%|*}"
if [[ -z "$claim_first_result" || -z "$claim_second_result" || "$claim_first_task" == "<none>" \
  || "$claim_second_task" == "<none>" || "$claim_first_task" == "$claim_second_task" ]]; then
  cat "$fixture_dir/claim-first.log" "$fixture_dir/claim-second.log" >&2
  printf '%s\n' 'Concurrent claimants did not receive distinct tasks.' >&2
  exit 1
fi

claim_owner_counts="$(
  psql_local -v first_user="$first_user" -v second_user="$second_user" <<'SQL'
SELECT count(*)::TEXT || ':' || count(DISTINCT entity_id)::TEXT
FROM public.gamification_task_locks
WHERE user_id IN (:'first_user'::UUID, :'second_user'::UUID)
  AND category = 'enrich_voice_actor';
SQL
)"
if [[ "$claim_owner_counts" != "2:2" ]]; then
  printf 'Expected two separately owned claims, got %s.\n' "$claim_owner_counts" >&2
  exit 1
fi

submission_actor="$(
  psql_local -v first_user="$first_user" <<'SQL'
INSERT INTO public.voice_actors (firstname, lastname)
VALUES ('AtomicSubmit-' || :'first_user', 'Fixture')
RETURNING id;
SQL
)"
psql_local -v first_user="$first_user" -v submission_claim="$submission_claim" \
  -v submission_actor="$submission_actor" <<'SQL' >/dev/null
INSERT INTO public.gamification_task_locks
  (category, entity_id, locked_at, claim_id, user_id, expires_at)
VALUES
  ('enrich_voice_actor', :'submission_actor', clock_timestamp(), :'submission_claim'::UUID, :'first_user'::UUID, clock_timestamp() + INTERVAL '5 minutes');
SQL

psql_local -v delay_function="$delay_function" -v delay_trigger="$delay_trigger" <<'SQL' >/dev/null
CREATE FUNCTION public.:"delay_function"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.user_id::TEXT = current_setting('app.atomic_task_test_user', TRUE) THEN
    PERFORM pg_sleep(2);
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER :"delay_trigger"
BEFORE INSERT ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.:"delay_function"();
SQL

PGAPPNAME="$submit_first_app" psql_local -v first_user="$first_user" \
  -v submission_claim="$submission_claim" -v submission_actor="$submission_actor" \
  >"$fixture_dir/submit-first.log" 2>&1 <<'SQL' &
BEGIN;
SELECT set_config('app.atomic_task_test_user', :'first_user', TRUE);
SELECT status || '|' || points_awarded::TEXT
FROM public.submit_gamification_task_contribution(
  :'submission_claim'::UUID, :'first_user'::UUID,
  '{"bio":"First concurrent contribution"}'::JSONB, FALSE
);
COMMIT;
SQL
submit_first_pid=$!

submit_first_sleeping=0
for _ in $(seq 1 100); do
  wait_state="$(psql_local -c "SELECT COALESCE(wait_event_type, '') || '|' || COALESCE(wait_event, '') FROM pg_stat_activity WHERE application_name = '$submit_first_app'")"
  if [[ "$wait_state" == "Timeout|PgSleep" ]]; then submit_first_sleeping=1; break; fi
  if ! kill -0 "$submit_first_pid" 2>/dev/null; then cat "$fixture_dir/submit-first.log" >&2; exit 1; fi
  sleep 0.05
done
if [[ "$submit_first_sleeping" != "1" ]]; then
  cat "$fixture_dir/submit-first.log" >&2
  printf '%s\n' 'Timed out waiting for the first submission to reach its audit write.' >&2
  exit 1
fi

PGAPPNAME="$submit_second_app" psql_local -v first_user="$first_user" \
  -v submission_claim="$submission_claim" -v submission_actor="$submission_actor" \
  >"$fixture_dir/submit-second.log" 2>&1 <<'SQL' &
BEGIN;
SELECT set_config('app.atomic_task_test_user', :'first_user', TRUE);
SELECT status || '|' || points_awarded::TEXT
FROM public.submit_gamification_task_contribution(
  :'submission_claim'::UUID, :'first_user'::UUID,
  '{"bio":"Duplicate concurrent contribution"}'::JSONB, FALSE
);
COMMIT;
SQL
submit_second_pid=$!

submit_second_waited_for_lock=0
for _ in $(seq 1 100); do
  wait_state="$(psql_local -c "SELECT COALESCE(wait_event_type, '') FROM pg_stat_activity WHERE application_name = '$submit_second_app'")"
  if [[ "$wait_state" == "Lock" ]]; then submit_second_waited_for_lock=1; break; fi
  if ! kill -0 "$submit_second_pid" 2>/dev/null; then break; fi
  sleep 0.05
done
if [[ "$submit_second_waited_for_lock" != "1" ]]; then
  cat "$fixture_dir/submit-second.log" >&2
  printf '%s\n' 'The duplicate submission did not wait on the claim row lock.' >&2
  exit 1
fi

wait "$submit_first_pid"
submit_first_pid=""
wait "$submit_second_pid"
submit_second_pid=""
first_submission_result="$(grep -oE '^(submitted|invalid_claim)\|[0-9]+' "$fixture_dir/submit-first.log" || true)"
second_submission_result="$(grep -oE '^(submitted|invalid_claim)\|[0-9]+' "$fixture_dir/submit-second.log" || true)"
if [[ "$first_submission_result" != "submitted|10" || "$second_submission_result" != "invalid_claim|0" ]]; then
  cat "$fixture_dir/submit-first.log" "$fixture_dir/submit-second.log" >&2
  printf '%s\n' 'Concurrent submissions did not produce exactly one successful write.' >&2
  exit 1
fi

submission_state="$(
  psql_local -v first_user="$first_user" -v submission_actor="$submission_actor" -v submission_claim="$submission_claim" <<'SQL'
SELECT
  (SELECT count(*) FROM public.audit_logs
    WHERE user_id = :'first_user'::UUID AND entity_type = 'voice_actor' AND entity_id = :'submission_actor')::TEXT
  || ':' || (SELECT COALESCE(sum(points_awarded), 0) FROM public.audit_logs
    WHERE user_id = :'first_user'::UUID AND entity_type = 'voice_actor' AND entity_id = :'submission_actor')::TEXT
  || ':' || (SELECT count(*) FROM public.voice_actors
    WHERE id = :'submission_actor'::BIGINT AND bio = 'First concurrent contribution' AND updated_by = :'first_user'::UUID)::TEXT
  || ':' || (SELECT count(*) FROM public.gamification_task_locks
    WHERE claim_id = :'submission_claim'::UUID AND user_id = :'first_user'::UUID
      AND category = 'enrich_voice_actor' AND entity_id = :'submission_actor')::TEXT
  || ':' || (SELECT count(*) FROM public.gamification_task_locks
    WHERE claim_id = :'submission_claim'::UUID AND user_id = :'first_user'::UUID
      AND consumed_at IS NOT NULL AND expires_at <= clock_timestamp())::TEXT;
SQL
)"
if [[ "$submission_state" != "1:10:1:1:1" ]]; then
  printf 'Expected one accurate audit, ten points, one attributed update, and one consumed claim; got %s.\n' "$submission_state" >&2
  exit 1
fi

printf '%s\n' 'Concurrent task claims and duplicate contribution submissions passed.'
