#!/usr/bin/env bash
set -euo pipefail

# Local-only two-session regression fixture. The first session runs the legacy
# reprocessor and keeps its transaction lock open. The second performs the
# normal enqueue and must wait, then observe the active item and be rejected.
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
fixture_msg_id=''
reprocessor_pid=''
extractor_pid=''
enqueue_pid=''
extract_duplicate_pid=''

cleanup() {
  if [[ -n "$reprocessor_pid" ]]; then
    wait "$reprocessor_pid" 2>/dev/null || true
  fi
  if [[ -n "$extractor_pid" ]]; then
    wait "$extractor_pid" 2>/dev/null || true
  fi
  if [[ -n "$enqueue_pid" ]]; then
    wait "$enqueue_pid" 2>/dev/null || true
  fi
  if [[ -n "$extract_duplicate_pid" ]]; then
    wait "$extract_duplicate_pid" 2>/dev/null || true
  fi
  if [[ -n "$fixture_msg_id" ]]; then
    psql_local >/dev/null <<SQL || true
DELETE FROM pgmq.q_wiki_check WHERE message->>'tmdb_id' = '1492640';
DELETE FROM public.legacy_wiki_check_reprocesses WHERE archived_msg_id = ${fixture_msg_id};
DELETE FROM pgmq.a_wiki_check WHERE msg_id = ${fixture_msg_id};
DELETE FROM pgmq.q_wiki_extract WHERE message->>'tmdb_id' = '-1492640';
SQL
  fi
  rm -rf "$fixture_dir"
}
trap cleanup EXIT

fixture_msg_id="$(psql_local -At <<'SQL'
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pgmq.a_wiki_check WHERE message->>'review_needed' = 'true' AND message->>'tmdb_id' = '1492640')
    OR EXISTS (SELECT 1 FROM pgmq.q_wiki_check WHERE message->>'tmdb_id' = '1492640')
    OR EXISTS (SELECT 1 FROM pgmq.q_wiki_extract WHERE message->>'tmdb_id' = '-1492640')
    OR EXISTS (SELECT 1 FROM public.dubbing_projects WHERE content_id = -1492640) THEN
    RAISE EXCEPTION 'Legacy reprocessor concurrency fixture ID is already in use';
  END IF;
END;
$$;
SELECT public.enqueue_media_fetch(1492640, 'movie', p_wikipedia_language => 'en');
SQL
)"

psql_local >/dev/null <<SQL
SELECT public.archive_media_queue_message('wiki_check', ${fixture_msg_id});
UPDATE pgmq.a_wiki_check SET message = message || jsonb_build_object('review_needed', true)
WHERE msg_id = ${fixture_msg_id};
SQL

psql_local >"$fixture_dir/reprocessor.log" 2>&1 <<'SQL' &
BEGIN;
SELECT outcome FROM public.reprocess_legacy_wiki_check_reviews() WHERE tmdb_id = 1492640;
SELECT 'REPROCESS_LOCK_HELD' AS fixture_marker;
SELECT pg_sleep(2);
COMMIT;
SQL
reprocessor_pid=$!

for _ in $(seq 1 100); do
  if grep -q 'REPROCESS_LOCK_HELD' "$fixture_dir/reprocessor.log"; then
    break
  fi
  if ! kill -0 "$reprocessor_pid" 2>/dev/null; then
    cat "$fixture_dir/reprocessor.log" >&2
    printf '%s\n' 'Reprocessor session exited before acquiring the identity lock.' >&2
    exit 1
  fi
  sleep 0.05
done

if ! grep -q 'REPROCESS_LOCK_HELD' "$fixture_dir/reprocessor.log"; then
  cat "$fixture_dir/reprocessor.log" >&2
  printf '%s\n' 'Timed out waiting for the reprocessor lock marker.' >&2
  exit 1
fi

psql_local >"$fixture_dir/enqueue.log" 2>&1 <<'SQL' &
SELECT 'NORMAL_ENQUEUE_STARTED' AS fixture_marker;
SELECT public.enqueue_media_fetch(1492640, 'movie', p_wikipedia_language => 'en');
SQL
enqueue_pid=$!

for _ in $(seq 1 100); do
  if grep -q 'NORMAL_ENQUEUE_STARTED' "$fixture_dir/enqueue.log"; then
    break
  fi
  if ! kill -0 "$enqueue_pid" 2>/dev/null; then
    cat "$fixture_dir/enqueue.log" >&2
    printf '%s\n' 'Normal enqueue exited before its concurrency check.' >&2
    exit 1
  fi
  sleep 0.05
done

if ! grep -q 'NORMAL_ENQUEUE_STARTED' "$fixture_dir/enqueue.log"; then
  cat "$fixture_dir/enqueue.log" >&2
  printf '%s\n' 'Timed out waiting for the normal enqueue session.' >&2
  exit 1
fi
sleep 0.1
if ! kill -0 "$enqueue_pid" 2>/dev/null; then
  cat "$fixture_dir/enqueue.log" >&2
  printf '%s\n' 'Normal enqueue did not wait for the reprocessor lock.' >&2
  exit 1
fi

wait "$reprocessor_pid"
reprocessor_pid=''

if wait "$enqueue_pid"; then
  enqueue_pid=''
  printf '%s\n' 'Concurrent normal enqueue unexpectedly succeeded.' >&2
  exit 1
else
  enqueue_pid=''
fi

if ! grep -q 'Item is already in the check queue' "$fixture_dir/enqueue.log"; then
  cat "$fixture_dir/enqueue.log" >&2
  printf '%s\n' 'Concurrent normal enqueue failed for an unexpected reason.' >&2
  exit 1
fi

psql_local -At <<SQL | grep -qx 't'
SELECT (SELECT count(*) FROM pgmq.q_wiki_check WHERE message->>'tmdb_id' = '1492640') = 1
  AND EXISTS (SELECT 1 FROM public.legacy_wiki_check_reprocesses WHERE archived_msg_id = ${fixture_msg_id})
  AND EXISTS (SELECT 1 FROM pgmq.a_wiki_check WHERE msg_id = ${fixture_msg_id} AND message->>'review_needed' = 'true');
SQL

printf '%s\n' 'Concurrent normal enqueue waited for the reprocessor and was rejected as a duplicate; archive history was preserved.'

psql_local >"$fixture_dir/extractor.log" 2>&1 <<'SQL' &
BEGIN;
SELECT public.enqueue_media_extract(
  p_tmdb_id => -1492640,
  p_media_type => 'movie',
  p_language => 'fr',
  p_page_id => 987654,
  p_section_indexes => '[3]'::jsonb,
  p_wikipedia_language => 'fr',
  p_dubbing_language => 'fr-FR'
);
SELECT 'EXTRACT_LOCK_HELD' AS fixture_marker;
SELECT pg_sleep(2);
COMMIT;
SQL
extractor_pid=$!

for _ in $(seq 1 100); do
  if grep -q 'EXTRACT_LOCK_HELD' "$fixture_dir/extractor.log"; then
    break
  fi
  if ! kill -0 "$extractor_pid" 2>/dev/null; then
    cat "$fixture_dir/extractor.log" >&2
    printf '%s\n' 'Extract enqueue session exited before acquiring the identity lock.' >&2
    exit 1
  fi
  sleep 0.05
done

if ! grep -q 'EXTRACT_LOCK_HELD' "$fixture_dir/extractor.log"; then
  cat "$fixture_dir/extractor.log" >&2
  printf '%s\n' 'Timed out waiting for the extract enqueue lock marker.' >&2
  exit 1
fi

psql_local >"$fixture_dir/extract-duplicate.log" 2>&1 <<'SQL' &
SELECT 'EXTRACT_DUPLICATE_STARTED' AS fixture_marker;
SELECT public.enqueue_media_extract(
  p_tmdb_id => -1492640,
  p_media_type => 'movie',
  p_language => 'fr',
  p_page_id => 987654,
  p_section_indexes => '[3]'::jsonb,
  p_wikipedia_language => 'fr',
  p_dubbing_language => 'fr-FR'
);
SQL
extract_duplicate_pid=$!

for _ in $(seq 1 100); do
  if grep -q 'EXTRACT_DUPLICATE_STARTED' "$fixture_dir/extract-duplicate.log"; then
    break
  fi
  if ! kill -0 "$extract_duplicate_pid" 2>/dev/null; then
    cat "$fixture_dir/extract-duplicate.log" >&2
    printf '%s\n' 'Concurrent extraction exited before its lock check.' >&2
    exit 1
  fi
  sleep 0.05
done

if ! grep -q 'EXTRACT_DUPLICATE_STARTED' "$fixture_dir/extract-duplicate.log"; then
  cat "$fixture_dir/extract-duplicate.log" >&2
  printf '%s\n' 'Timed out waiting for the concurrent extraction session.' >&2
  exit 1
fi
sleep 0.1
if ! kill -0 "$extract_duplicate_pid" 2>/dev/null; then
  cat "$fixture_dir/extract-duplicate.log" >&2
  printf '%s\n' 'Concurrent extraction did not wait for the identity lock.' >&2
  exit 1
fi

wait "$extractor_pid"
extractor_pid=''

if wait "$extract_duplicate_pid"; then
  extract_duplicate_pid=''
  printf '%s\n' 'Concurrent extraction enqueue unexpectedly succeeded.' >&2
  exit 1
else
  extract_duplicate_pid=''
fi

if ! grep -q 'Item is already in the extract queue' "$fixture_dir/extract-duplicate.log"; then
  cat "$fixture_dir/extract-duplicate.log" >&2
  printf '%s\n' 'Concurrent extraction enqueue failed for an unexpected reason.' >&2
  exit 1
fi

psql_local -At <<'SQL' | grep -qx '1'
SELECT count(*) FROM pgmq.q_wiki_extract WHERE message->>'tmdb_id' = '-1492640';
SQL

printf '%s\n' 'Concurrent extraction enqueue waited for the shared identity lock and was rejected as a duplicate.'
