#!/usr/bin/env bash
set -euo pipefail

export PGHOST=127.0.0.1
export PGPORT="${T02_TEST_DB_PORT:-55322}"
export PGDATABASE=postgres
export PGUSER=postgres
export PGPASSWORD="${T02_TEST_DB_PASSWORD:-postgres}"

admin_id=56369510-0000-4000-8000-000000000001
user_id=56369510-0000-4000-8000-000000000002
fixture_tag="$(date +%s%N)"
voice_actor_one_name="T02 Link ${fixture_tag}"
voice_actor_two_name="T02 Link ${fixture_tag} B"
voice_actor_three_name="T02 Link ${fixture_tag} C"
voice_actor_four_name="T02 Link ${fixture_tag} D"
scratch_dir="$(mktemp -d /tmp/dubbingbase-user-va-links.XXXXXX)"
fixtures_created=0

psql_local() {
  psql -X -q -v ON_ERROR_STOP=1 "$@"
}

cleanup() {
  if [[ "$fixtures_created" == "1" ]]; then
    psql_local >/dev/null <<SQL
BEGIN;
ALTER TABLE public.audit_logs DISABLE TRIGGER USER;
DELETE FROM public.audit_logs WHERE user_id = '$admin_id';
DELETE FROM public.user_voice_actor_link_requests WHERE actor_id = '$admin_id';
DELETE FROM public.user_voice_actor_links WHERE user_id = '$user_id';
DELETE FROM public.voice_actors
WHERE firstname IN ('$voice_actor_one_name', '$voice_actor_two_name', '$voice_actor_three_name', '$voice_actor_four_name');
DELETE FROM auth.users WHERE id IN ('$admin_id', '$user_id');
ALTER TABLE public.audit_logs ENABLE TRIGGER USER;
COMMIT;
SQL
  fi
  rm -rf "$scratch_dir"
}
trap cleanup EXIT

if psql_local -t -A -c "SELECT 1 FROM auth.users WHERE id IN ('$admin_id', '$user_id')" | rg -q 1; then
  echo "T02 fixture user IDs are already in use" >&2
  exit 1
fi
fixtures_created=1

psql_local >/dev/null <<SQL
INSERT INTO auth.users (id, raw_app_meta_data) VALUES
  ('$admin_id', '{"role":"admin"}'::JSONB),
  ('$user_id', '{"role":"user"}'::JSONB);
INSERT INTO public.voice_actors (firstname, lastname) VALUES
  ('$voice_actor_one_name', 'Concurrent'),
  ('$voice_actor_two_name', 'Concurrent'),
  ('$voice_actor_three_name', 'Concurrent'),
  ('$voice_actor_four_name', 'Concurrent');
SQL

voice_actor_one="$(psql_local -t -A -c "SELECT id FROM public.voice_actors WHERE firstname = '$voice_actor_one_name'")"
voice_actor_two="$(psql_local -t -A -c "SELECT id FROM public.voice_actors WHERE firstname = '$voice_actor_two_name'")"
voice_actor_three="$(psql_local -t -A -c "SELECT id FROM public.voice_actors WHERE firstname = '$voice_actor_three_name'")"
voice_actor_four="$(psql_local -t -A -c "SELECT id FROM public.voice_actors WHERE firstname = '$voice_actor_four_name'")"

write_call() {
  local path="$1" request_id="$2" voice_actor_id="$3" hold_transaction="$4" ready_file="$5"
  cat >"$path" <<SQL
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"$admin_id","role":"authenticated","app_metadata":{"role":"admin"}}',
  TRUE
);
SELECT pg_sleep(0.15);
SELECT link_id || '|' || created || '|' || COALESCE(audit_log_id::TEXT, '') || '|' || replayed
FROM public.admin_link_user_voice_actor_controlled('$admin_id', '$request_id', '$user_id', $voice_actor_id);
SQL
  if [[ "$hold_transaction" == "1" ]]; then
    cat >>"$path" <<SQL
\\! touch "$ready_file"
SELECT pg_sleep(1);
SQL
  fi
  cat >>"$path" <<'SQL'
COMMIT;
SQL
}

same_ready="$scratch_dir/same-ready"
same_request_id=56369510-0000-4000-8000-000000000001
write_call "$scratch_dir/same-a.sql" "$same_request_id" "$voice_actor_one" 1 "$same_ready"
write_call "$scratch_dir/same-b.sql" "$same_request_id" "$voice_actor_one" 0 ""
psql_local -t -A -f "$scratch_dir/same-a.sql" >"$scratch_dir/same-a.log" 2>&1 &
same_a=$!
for _ in {1..100}; do
  [[ -e "$same_ready" ]] && break
  sleep 0.05
done
if [[ ! -e "$same_ready" ]]; then
  wait "$same_a" || true
  cat "$scratch_dir/same-a.log" >&2
  echo "First duplicate-link session did not reach its held transaction" >&2
  exit 1
fi
psql_local -t -A -f "$scratch_dir/same-b.sql" >"$scratch_dir/same-b.log" 2>&1 &
same_b=$!
wait "$same_a"
wait "$same_b"

same_a_result="$(rg '^[0-9a-f-]+\|(true|false)\|[0-9a-f-]+\|(true|false)$' "$scratch_dir/same-a.log" | tail -n 1)"
same_b_result="$(rg '^[0-9a-f-]+\|(true|false)\|[0-9a-f-]+\|(true|false)$' "$scratch_dir/same-b.log" | tail -n 1)"
IFS='|' read -r same_a_link same_a_created same_a_audit same_a_replayed <<<"$same_a_result"
IFS='|' read -r same_b_link same_b_created same_b_audit same_b_replayed <<<"$same_b_result"
if [[ -z "$same_a_result" || -z "$same_b_result" \
  || "$same_a_link" != "$same_b_link" || "$same_a_audit" != "$same_b_audit" \
  || "$same_a_created" != "true" || "$same_b_created" != "true" \
  || "$same_a_replayed" == "$same_b_replayed" ]]; then
  printf 'Concurrent retry of one request returned inconsistent results:\n%s\n%s\n' \
    "$same_a_result" "$same_b_result" >&2
  exit 1
fi

role_ready="$scratch_dir/role-ready"
write_call "$scratch_dir/role-a.sql" "56369510-0000-4000-8000-000000000002" "$voice_actor_two" 1 "$role_ready"
write_call "$scratch_dir/role-b.sql" "56369510-0000-4000-8000-000000000004" "$voice_actor_two" 0 ""
psql_local -t -A -f "$scratch_dir/role-a.sql" >"$scratch_dir/role-a.log" 2>&1 &
role_a=$!
for _ in {1..100}; do
  [[ -e "$role_ready" ]] && break
  sleep 0.05
done
if [[ ! -e "$role_ready" ]]; then
  wait "$role_a" || true
  cat "$scratch_dir/role-a.log" >&2
  echo "First same-role session did not reach its held transaction" >&2
  exit 1
fi
psql_local -t -A -f "$scratch_dir/role-b.sql" >"$scratch_dir/role-b.log" 2>&1 &
role_b=$!
wait "$role_a"
wait "$role_b"

role_a_result="$(rg '^[0-9a-f-]+\|(true|false)\|[0-9a-f-]+\|(true|false)$' "$scratch_dir/role-a.log" | tail -n 1)"
role_b_result="$(rg '^[0-9a-f-]+\|(true|false)\|[0-9a-f-]+\|(true|false)$' "$scratch_dir/role-b.log" | tail -n 1)"
IFS='|' read -r role_a_link role_a_created role_a_audit role_a_replayed <<<"$role_a_result"
IFS='|' read -r role_b_link role_b_created role_b_audit role_b_replayed <<<"$role_b_result"
if [[ -z "$role_a_result" || -z "$role_b_result" \
  || "$role_a_link" != "$role_b_link" || "$role_a_audit" != "$role_b_audit" \
  || "$role_a_created" == "$role_b_created" \
  || "$role_a_replayed" != "false" || "$role_b_replayed" != "false" ]]; then
  printf 'Concurrent requests for one role did not produce one audited relationship:\n%s\n%s\n' \
    "$role_a_result" "$role_b_result" >&2
  exit 1
fi

write_call "$scratch_dir/distinct-a.sql" "56369510-0000-4000-8000-000000000005" "$voice_actor_three" 0 ""
write_call "$scratch_dir/distinct-b.sql" "56369510-0000-4000-8000-000000000006" "$voice_actor_four" 0 ""
psql_local -t -A -f "$scratch_dir/distinct-a.sql" >"$scratch_dir/distinct-a.log" 2>&1 &
distinct_a=$!
psql_local -t -A -f "$scratch_dir/distinct-b.sql" >"$scratch_dir/distinct-b.log" 2>&1 &
distinct_b=$!
wait "$distinct_a"
wait "$distinct_b"

distinct_created="$(rg -o '\|true\|' "$scratch_dir/distinct-a.log" "$scratch_dir/distinct-b.log" | wc -l | tr -d ' ')"
persisted="$(psql_local -t -A -c "
  SELECT
    (SELECT count(*) FROM public.user_voice_actor_links WHERE user_id = '$user_id') || '|' ||
    (SELECT count(*) FROM public.audit_logs
     WHERE user_id = '$admin_id' AND entity_type = 'user_voice_actor_link'
       AND action = 'create') || '|' ||
    (SELECT count(*) FROM public.user_voice_actor_link_requests
     WHERE actor_id = '$admin_id' AND completed_at IS NOT NULL);
")"
if [[ "$distinct_created" != "2" || "$persisted" != "4|4|5" ]]; then
  printf 'Distinct-link race produced unexpected created/persisted counts: %s / %s (voice actors %s, %s)\n' \
    "$distinct_created" "$persisted" "$voice_actor_two" "$voice_actor_three" >&2
  cat "$scratch_dir/distinct-a.log" "$scratch_dir/distinct-b.log" >&2
  exit 1
fi

printf 'PASS: same-key retries, different-key duplicate roles, and distinct-role races preserved one audited result per relationship.\n'
