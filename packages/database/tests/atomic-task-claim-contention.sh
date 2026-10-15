#!/usr/bin/env bash
set -euo pipefail

# Two independent PostgreSQL sessions compete while many unrelated task
# claims are already active. Run only against an isolated local Supabase DB.
db_host="${DB_HOST:-127.0.0.1}"
db_port="${DB_PORT:-55322}"
db_user="${DB_USER:-postgres}"
db_name="${DB_NAME:-postgres}"
export PGPASSWORD="${PGPASSWORD:-postgres}"
race_runs="${CLAIM_RACE_RUNS:-30}"

if [[ "$db_host" != "127.0.0.1" && "$db_host" != "localhost" ]] \
  || [[ ! "$db_port" =~ ^[0-9]{1,5}$ ]] \
  || (( db_port < 1024 || db_port > 65535 )) \
  || [[ "$db_name" != "postgres" ]] \
  || [[ ! "$race_runs" =~ ^[0-9]{1,3}$ ]] \
  || (( race_runs < 1 || race_runs > 250 )); then
  printf '%s\n' 'Use a loopback PostgreSQL database named postgres and set CLAIM_RACE_RUNS from 1 to 250.' >&2
  exit 2
fi

psql_local() {
  psql -X -qAt -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -v ON_ERROR_STOP=1 "$@"
}

if ! pg_isready -h "$db_host" -p "$db_port" -U "$db_user" >/dev/null 2>&1; then
  printf '%s\n' 'Start the isolated local Supabase database before running this test.' >&2
  exit 1
fi

existing_claim_count="$(psql_local -c 'SELECT count(*) FROM public.gamification_task_locks')"
incomplete_task_count="$(psql_local <<'SQL'
SELECT
  (SELECT count(*) FROM public.voice_actors
    WHERE profile_picture IS NULL OR nationality IS NULL OR date_of_birth IS NULL OR bio IS NULL)
  + (SELECT count(*) FROM public.studios
    WHERE logo_url IS NULL OR country IS NULL OR city IS NULL OR website_url IS NULL);
SQL
)"
if [[ "$existing_claim_count" != "0" || "$incomplete_task_count" != "0" ]]; then
  printf '%s\n' 'This regression requires a fresh, seed-disabled database with no task rows or claims.' >&2
  exit 2
fi

fixture_dir="$(mktemp -d)"
run_id="$(psql_local -c "SELECT replace(gen_random_uuid()::TEXT, '-', '')")"
run_suffix="${run_id:0:10}"
fixture_root="AtomicClaimRace-${run_suffix}-"
active_owner="$(psql_local -c 'SELECT gen_random_uuid()')"
first_user="$(psql_local -c 'SELECT gen_random_uuid()')"
second_user="$(psql_local -c 'SELECT gen_random_uuid()')"
delay_function="atomic_claim_race_delay_${run_suffix}"
delay_trigger="atomic_claim_race_${run_suffix}"
first_pid=""
second_pid=""

cleanup() {
  for pid in "$first_pid" "$second_pid"; do
    if [[ -n "$pid" ]]; then wait "$pid" 2>/dev/null || true; fi
  done
  psql_local -v fixture_root="$fixture_root" -v active_owner="$active_owner" \
    -v first_user="$first_user" -v second_user="$second_user" \
    -v delay_function="$delay_function" -v delay_trigger="$delay_trigger" \
    >/dev/null 2>&1 <<'SQL' || true
DROP TRIGGER IF EXISTS :"delay_trigger" ON public.gamification_task_locks;
DROP FUNCTION IF EXISTS public.:"delay_function"();
DELETE FROM public.gamification_task_locks
WHERE category = 'enrich_voice_actor'
  AND entity_id IN (
    SELECT actor.id::TEXT FROM public.voice_actors AS actor
    WHERE actor.firstname LIKE :'fixture_root' || '%'
  );
DELETE FROM public.voice_actors
WHERE firstname LIKE :'fixture_root' || '%';
DELETE FROM auth.users
WHERE id IN (:'active_owner'::UUID, :'first_user'::UUID, :'second_user'::UUID);
SQL
  rm -rf "$fixture_dir"
}
trap cleanup EXIT

psql_local -v active_owner="$active_owner" -v first_user="$first_user" \
  -v second_user="$second_user" <<'SQL' >/dev/null
INSERT INTO auth.users (id)
VALUES (:'active_owner'::UUID), (:'first_user'::UUID), (:'second_user'::UUID);
SQL

psql_local -v delay_function="$delay_function" -v delay_trigger="$delay_trigger" <<'SQL' >/dev/null
CREATE FUNCTION public.:"delay_function"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $test$
BEGIN
  IF current_setting('application_name', TRUE) LIKE 'atomic_claim_race_%'
    AND NEW.category = 'enrich_voice_actor'
    AND EXISTS (
      SELECT 1 FROM public.voice_actors AS actor
      WHERE actor.id::TEXT = NEW.entity_id
        AND actor.firstname LIKE 'AtomicClaimRace-%-free'
    ) THEN
    PERFORM pg_sleep(0.5);
  END IF;
  RETURN NEW;
END;
$test$;
CREATE TRIGGER :"delay_trigger"
BEFORE INSERT ON public.gamification_task_locks
FOR EACH ROW EXECUTE FUNCTION public.:"delay_function"();
SQL

for race_index in $(seq 1 "$race_runs"); do
  fixture_prefix="${fixture_root}${race_index}"
  psql_local -v fixture_prefix="$fixture_prefix" -v active_owner="$active_owner" <<'SQL' >/dev/null
WITH active_actors AS (
  INSERT INTO public.voice_actors (firstname, lastname)
  SELECT :'fixture_prefix' || '-active-' || actor_number::TEXT, 'Fixture'
  FROM generate_series(1, 16) AS actor_number
  RETURNING id
)
INSERT INTO public.gamification_task_locks
  (category, entity_id, locked_at, claim_id, user_id, expires_at)
SELECT 'enrich_voice_actor', actor.id::TEXT, clock_timestamp(), gen_random_uuid(),
  :'active_owner'::UUID, clock_timestamp() + INTERVAL '5 minutes'
FROM active_actors AS actor;

INSERT INTO public.voice_actors (firstname, lastname)
VALUES (:'fixture_prefix' || '-free', 'Fixture');
SQL

  free_actor_id="$(psql_local -v fixture_prefix="$fixture_prefix" <<'SQL'
SELECT id FROM public.voice_actors WHERE firstname = :'fixture_prefix' || '-free';
SQL
)"
  before_active_state="$(psql_local -v fixture_prefix="$fixture_prefix" <<'SQL'
SELECT md5(string_agg(actor.id::TEXT || ':' || claim.claim_id::TEXT || ':' || claim.user_id::TEXT,
  ',' ORDER BY actor.id))
FROM public.voice_actors AS actor
JOIN public.gamification_task_locks AS claim
  ON claim.category = 'enrich_voice_actor' AND claim.entity_id = actor.id::TEXT
WHERE actor.firstname LIKE :'fixture_prefix' || '-active-%';
SQL
)"

  first_app="atomic_claim_race_${run_suffix}_${race_index}_first"
  second_app="atomic_claim_race_${run_suffix}_${race_index}_second"
  first_log="$fixture_dir/claim-first-${race_index}.log"
  second_log="$fixture_dir/claim-second-${race_index}.log"

  PGAPPNAME="$first_app" psql_local -v claim_user="$first_user" -v seed="0.117" \
    >"$first_log" 2>&1 <<'SQL' &
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '10s';
SELECT setseed(:'seed'::DOUBLE PRECISION);
SELECT COALESCE(task->>'id', '') || '|' || COALESCE(claim_id::TEXT, '') || '|' || COALESCE(category, '')
FROM public.claim_gamification_task('enrich_voice_actor', :'claim_user'::UUID);
SELECT pg_sleep(2);
COMMIT;
SQL
  first_pid=$!

  first_acquiring=0
  for _ in $(seq 1 200); do
    acquiring_state="$(psql_local -c "SELECT count(*) FROM pg_stat_activity WHERE application_name = '$first_app' AND state = 'active' AND wait_event = 'PgSleep' AND query LIKE '%claim_gamification_task%'")"
    if [[ "$acquiring_state" == "1" ]]; then
      first_acquiring=1
      break
    fi
    if ! kill -0 "$first_pid" 2>/dev/null; then break; fi
    sleep 0.01
  done
  if [[ "$first_acquiring" != "1" ]]; then
    cat "$first_log" >&2
    printf 'Race %s did not observe the first session holding its per-task claim lock.\n' "$race_index" >&2
    exit 1
  fi

  PGAPPNAME="$second_app" psql_local -v claim_user="$second_user" -v seed="0.883" \
    >"$second_log" 2>&1 <<'SQL' &
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '10s';
SELECT setseed(:'seed'::DOUBLE PRECISION);
SELECT COALESCE(task->>'id', '') || '|' || COALESCE(claim_id::TEXT, '') || '|' || COALESCE(category, '')
FROM public.claim_gamification_task('enrich_voice_actor', :'claim_user'::UUID);
COMMIT;
SQL
  second_pid=$!

  second_status=0
  if wait "$second_pid"; then second_status=0; else second_status=$?; fi
  second_pid=""
  if ! kill -0 "$first_pid" 2>/dev/null; then
    cat "$first_log" "$second_log" >&2
    printf 'Race %s released the first claim lock before the competing session finished.\n' \
      "$race_index" >&2
    exit 1
  fi
  first_status=0
  if wait "$first_pid"; then first_status=0; else first_status=$?; fi
  first_pid=""
  if [[ "$first_status" != "0" || "$second_status" != "0" ]]; then
    cat "$first_log" "$second_log" >&2
    printf 'Race %s failed in PostgreSQL (session statuses %s, %s).\n' \
      "$race_index" "$first_status" "$second_status" >&2
    exit 1
  fi

  first_result="$(awk -F '|' 'NF == 3 { print; exit }' "$first_log")"
  second_result="$(awk -F '|' 'NF == 3 { print; exit }' "$second_log")"
  IFS='|' read -r first_task first_claim first_category <<<"$first_result"
  IFS='|' read -r second_task second_claim second_category <<<"$second_result"
  if [[ -n "$first_task" && -z "$second_task" ]]; then
    winner_task="$first_task"
    winner_user="$first_user"
    winner_claim="$first_claim"
    winner_category="$first_category"
    loser_user="$second_user"
  elif [[ -z "$first_task" && -n "$second_task" ]]; then
    winner_task="$second_task"
    winner_user="$second_user"
    winner_claim="$second_claim"
    winner_category="$second_category"
    loser_user="$first_user"
  else
    cat "$first_log" "$second_log" >&2
    printf 'Race %s did not return exactly one task claimant.\n' "$race_index" >&2
    exit 1
  fi
  if [[ "$winner_category" != "enrich_voice_actor" || "$winner_task" != "$free_actor_id" \
    || -z "$winner_claim" ]]; then
    cat "$first_log" "$second_log" >&2
    printf 'Race %s returned an unexpected task or claim.\n' "$race_index" >&2
    exit 1
  fi

  after_active_state="$(psql_local -v fixture_prefix="$fixture_prefix" \
    -v active_owner="$active_owner" -v winner_user="$winner_user" \
    -v loser_user="$loser_user" -v winner_claim="$winner_claim" <<'SQL'
SELECT
  (SELECT count(*) FROM public.voice_actors AS actor
    JOIN public.gamification_task_locks AS claim
      ON claim.category = 'enrich_voice_actor' AND claim.entity_id = actor.id::TEXT
    WHERE actor.firstname LIKE :'fixture_prefix' || '-active-%'
      AND claim.user_id = :'active_owner'::UUID
      AND claim.expires_at > clock_timestamp())::TEXT
  || ':' || (SELECT count(*) FROM public.voice_actors AS actor
    JOIN public.gamification_task_locks AS claim
      ON claim.category = 'enrich_voice_actor' AND claim.entity_id = actor.id::TEXT
    WHERE actor.firstname LIKE :'fixture_prefix' || '%'
      AND claim.expires_at > clock_timestamp())::TEXT
  || ':' || (SELECT count(DISTINCT claim.entity_id) FROM public.voice_actors AS actor
    JOIN public.gamification_task_locks AS claim
      ON claim.category = 'enrich_voice_actor' AND claim.entity_id = actor.id::TEXT
    WHERE actor.firstname LIKE :'fixture_prefix' || '%'
      AND claim.expires_at > clock_timestamp())::TEXT
  || ':' || (SELECT count(*) FROM public.voice_actors AS actor
    JOIN public.gamification_task_locks AS claim
      ON claim.category = 'enrich_voice_actor' AND claim.entity_id = actor.id::TEXT
    WHERE actor.firstname = :'fixture_prefix' || '-free'
      AND claim.user_id = :'winner_user'::UUID
      AND claim.claim_id = :'winner_claim'::UUID
      AND claim.expires_at > clock_timestamp())::TEXT
  || ':' || (SELECT count(*) FROM public.voice_actors AS actor
    JOIN public.gamification_task_locks AS claim
      ON claim.category = 'enrich_voice_actor' AND claim.entity_id = actor.id::TEXT
    WHERE actor.firstname = :'fixture_prefix' || '-free'
      AND claim.user_id = :'loser_user'::UUID
      AND claim.expires_at > clock_timestamp())::TEXT;
SQL
)"
after_active_digest="$(psql_local -v fixture_prefix="$fixture_prefix" <<'SQL'
SELECT md5(string_agg(actor.id::TEXT || ':' || claim.claim_id::TEXT || ':' || claim.user_id::TEXT,
  ',' ORDER BY actor.id))
FROM public.voice_actors AS actor
JOIN public.gamification_task_locks AS claim
  ON claim.category = 'enrich_voice_actor' AND claim.entity_id = actor.id::TEXT
WHERE actor.firstname LIKE :'fixture_prefix' || '-active-%';
SQL
)"
  if [[ "$before_active_state" == "" || "$after_active_digest" != "$before_active_state" \
    || "$after_active_state" != "16:17:17:1:0" ]]; then
    printf 'Race %s changed an existing claim or persisted an invalid active claim set (%s).\n' \
      "$race_index" "$after_active_state" >&2
    exit 1
  fi

  psql_local -v fixture_prefix="$fixture_prefix" <<'SQL' >/dev/null
DELETE FROM public.gamification_task_locks
WHERE category = 'enrich_voice_actor'
  AND entity_id IN (
    SELECT actor.id::TEXT FROM public.voice_actors AS actor
    WHERE actor.firstname LIKE :'fixture_prefix' || '%'
  );
DELETE FROM public.voice_actors
WHERE firstname LIKE :'fixture_prefix' || '%';
SQL
done

printf '%s two-session randomized claim races passed; each had 16 unchanged active claims, one available task, one winner, and zero PostgreSQL errors.\n' "$race_runs"
