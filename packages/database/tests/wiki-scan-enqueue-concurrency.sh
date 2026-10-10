#!/usr/bin/env bash
set -euo pipefail

# Local-only two-session proof that concurrent wiki_scan enqueue requests share
# the same advisory identity lock and produce one active message.
db_host="${DB_HOST:-127.0.0.1}"
db_port="${DB_PORT:-55322}"
db_user="${DB_USER:-postgres}"
db_name="${DB_NAME:-postgres}"
export PGPASSWORD="${PGPASSWORD:-postgres}"

if [[ "$db_host" != "127.0.0.1" && "$db_host" != "localhost" ]] || [[ "$db_port" != "55322" ]] || [[ "$db_name" != "postgres" ]]; then
  printf '%s\n' 'This regression fixture only permits the local Supabase database at 127.0.0.1:55322/postgres.' >&2
  exit 2
fi

psql_local() {
  psql -X -q -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -v ON_ERROR_STOP=1 "$@"
}

fixture_dir="$(mktemp -d)"
first_pid=''
second_pid=''
cleanup() {
  if [[ -n "$first_pid" ]]; then wait "$first_pid" 2>/dev/null || true; fi
  if [[ -n "$second_pid" ]]; then wait "$second_pid" 2>/dev/null || true; fi
  psql_local >/dev/null <<'SQL' || true
DELETE FROM pgmq.q_wiki_scan WHERE message->>'tmdb_id'='-980505';
DELETE FROM pgmq.a_wiki_scan WHERE message->>'tmdb_id'='-980505';
SQL
  rm -rf "$fixture_dir"
}
trap cleanup EXIT

if [[ "$(psql_local -Atc "SELECT count(*) FROM pgmq.q_wiki_scan WHERE message->>'tmdb_id'='-980505'")" != 0 ]]; then
  printf '%s\n' 'wiki_scan concurrency fixture ID is already in use.' >&2
  exit 1
fi

psql_local >"$fixture_dir/first.log" 2>&1 <<'SQL' &
BEGIN;
SELECT public.enqueue_media_fetch(-980505,'movie',p_wikipedia_language=>'fr',p_wiki_id=>'Q980505',p_title=>'Fixture',p_page_title=>'Fixture');
SELECT 'FIRST_ENQUEUE_COMMITTED_LATER' AS fixture_marker;
SELECT pg_sleep(2);
COMMIT;
SQL
first_pid=$!

for _ in $(seq 1 100); do
  if grep -q 'FIRST_ENQUEUE_COMMITTED_LATER' "$fixture_dir/first.log"; then break; fi
  if ! kill -0 "$first_pid" 2>/dev/null; then cat "$fixture_dir/first.log" >&2; exit 1; fi
  sleep 0.05
done
if ! grep -q 'FIRST_ENQUEUE_COMMITTED_LATER' "$fixture_dir/first.log"; then
  cat "$fixture_dir/first.log" >&2
  printf '%s\n' 'Timed out waiting for the first wiki_scan enqueue.' >&2
  exit 1
fi

psql_local >"$fixture_dir/second.log" 2>&1 <<'SQL' &
SELECT public.enqueue_media_fetch(-980505,'movie',p_wikipedia_language=>'fr',p_wiki_id=>'Q980505',p_title=>'Fixture',p_page_title=>'Fixture');
SQL
second_pid=$!
sleep 0.1
if ! kill -0 "$second_pid" 2>/dev/null; then
  cat "$fixture_dir/second.log" >&2
  printf '%s\n' 'The competing wiki_scan enqueue did not wait on the identity lock.' >&2
  exit 1
fi

wait "$first_pid"
first_pid=''
if wait "$second_pid"; then
  second_pid=''
  printf '%s\n' 'Concurrent wiki_scan enqueue unexpectedly succeeded.' >&2
  exit 1
else
  second_pid=''
fi
if ! grep -q 'Item is already in the wiki_scan queue' "$fixture_dir/second.log"; then
  cat "$fixture_dir/second.log" >&2
  printf '%s\n' 'The competing request failed for an unexpected reason.' >&2
  exit 1
fi
psql_local -Atc "SELECT count(*) FROM pgmq.q_wiki_scan WHERE message->>'tmdb_id'='-980505'" | grep -qx '1'
printf '%s\n' 'Concurrent wiki_scan enqueues serialized and produced one active message.'
