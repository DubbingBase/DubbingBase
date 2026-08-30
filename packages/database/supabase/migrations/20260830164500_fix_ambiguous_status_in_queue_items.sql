-- Migration: 20260830164500_fix_ambiguous_status_in_queue_items.sql
-- Description: Fix column reference "status" ambiguous error in get_media_queue_items RPC by qualifying with table alias.

-- 1. Drop existing get_media_queue_items
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT p.oid::regprocedure::text AS func_signature
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_media_queue_items'
  ) LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
  END LOOP;
END $$;

-- 2. Fully qualified get_media_queue_items
CREATE OR REPLACE FUNCTION public.get_media_queue_items(
  p_queue_name text default null,
  p_status text default null,
  p_limit int default 50,
  p_offset int default 0
)
RETURNS TABLE (
  id bigint,
  queue_name text,
  tmdb_id bigint,
  media_type text,
  language text,
  season_number int,
  episode_number int,
  status text,
  error_message text,
  created_at timestamptz,
  read_ct int,
  is_manual boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  RETURN QUERY
  WITH all_items AS (
    -- Extract Queue (Active)
    SELECT
      q.msg_id AS id,
      'wiki_extract'::text AS queue_name,
      (q.message->>'tmdb_id')::bigint AS tmdb_id,
      q.message->>'media_type' AS media_type,
      q.message->>'language' AS language,
      (q.message->>'season_number')::int AS season_number,
      (q.message->>'episode_number')::int AS episode_number,
      CASE WHEN q.vt > now() THEN 'processing' ELSE 'pending' END AS status,
      q.message->>'error_message' AS error_message,
      q.enqueued_at AS created_at,
      q.read_ct,
      COALESCE((q.message->>'is_manual')::boolean, false) AS is_manual
    FROM pgmq.q_wiki_extract q
    WHERE (p_queue_name IS NULL OR p_queue_name = 'wiki_extract')
      AND (p_status IS NULL OR (p_status = 'pending' AND q.vt <= now()) OR (p_status = 'processing' AND q.vt > now()))

    UNION ALL

    -- Check Queue (Active)
    SELECT
      q.msg_id AS id,
      'wiki_check'::text AS queue_name,
      (q.message->>'tmdb_id')::bigint AS tmdb_id,
      q.message->>'media_type' AS media_type,
      q.message->>'language' AS language,
      (q.message->>'season_number')::int AS season_number,
      (q.message->>'episode_number')::int AS episode_number,
      CASE WHEN q.vt > now() THEN 'processing' ELSE 'pending' END AS status,
      q.message->>'error_message' AS error_message,
      q.enqueued_at AS created_at,
      q.read_ct,
      COALESCE((q.message->>'is_manual')::boolean, false) AS is_manual
    FROM pgmq.q_wiki_check q
    WHERE (p_queue_name IS NULL OR p_queue_name = 'wiki_check')
      AND (p_status IS NULL OR (p_status = 'pending' AND q.vt <= now()) OR (p_status = 'processing' AND q.vt > now()))

    UNION ALL

    -- Discovery Queue (Active)
    SELECT
      q.msg_id AS id,
      'wiki_discovery'::text AS queue_name,
      (q.message->>'tmdb_id')::bigint AS tmdb_id,
      q.message->>'media_type' AS media_type,
      q.message->>'language' AS language,
      (q.message->>'season_number')::int AS season_number,
      (q.message->>'episode_number')::int AS episode_number,
      CASE WHEN q.vt > now() THEN 'processing' ELSE 'pending' END AS status,
      q.message->>'error_message' AS error_message,
      q.enqueued_at AS created_at,
      q.read_ct,
      COALESCE((q.message->>'is_manual')::boolean, false) AS is_manual
    FROM pgmq.q_wiki_discovery q
    WHERE (p_queue_name IS NULL OR p_queue_name = 'wiki_discovery')
      AND (p_status IS NULL OR (p_status = 'pending' AND q.vt <= now()) OR (p_status = 'processing' AND q.vt > now()))

    UNION ALL

    -- Extract Archive
    SELECT
      a.msg_id AS id,
      'wiki_extract'::text AS queue_name,
      (a.message->>'tmdb_id')::bigint AS tmdb_id,
      a.message->>'media_type' AS media_type,
      a.message->>'language' AS language,
      (a.message->>'season_number')::int AS season_number,
      (a.message->>'episode_number')::int AS episode_number,
      CASE WHEN (a.message->>'error_message') IS NOT NULL AND (a.message->>'error_message') != '' THEN 'error' ELSE 'completed' END AS status,
      a.message->>'error_message' AS error_message,
      a.enqueued_at AS created_at,
      a.read_ct,
      COALESCE((a.message->>'is_manual')::boolean, false) AS is_manual
    FROM pgmq.a_wiki_extract a
    WHERE (p_queue_name IS NULL OR p_queue_name = 'wiki_extract')
      AND (p_status IS NULL OR (p_status = 'error' AND (a.message->>'error_message') IS NOT NULL) OR (p_status = 'completed' AND (a.message->>'error_message' IS NULL OR a.message->>'error_message' = '')))

    UNION ALL

    -- Check Archive
    SELECT
      a.msg_id AS id,
      'wiki_check'::text AS queue_name,
      (a.message->>'tmdb_id')::bigint AS tmdb_id,
      a.message->>'media_type' AS media_type,
      a.message->>'language' AS language,
      (a.message->>'season_number')::int AS season_number,
      (a.message->>'episode_number')::int AS episode_number,
      CASE WHEN (a.message->>'error_message') IS NOT NULL AND (a.message->>'error_message') != '' THEN 'error' ELSE 'completed' END AS status,
      a.message->>'error_message' AS error_message,
      a.enqueued_at AS created_at,
      a.read_ct,
      COALESCE((a.message->>'is_manual')::boolean, false) AS is_manual
    FROM pgmq.a_wiki_check a
    WHERE (p_queue_name IS NULL OR p_queue_name = 'wiki_check')
      AND (p_status IS NULL OR (p_status = 'error' AND (a.message->>'error_message') IS NOT NULL) OR (p_status = 'completed' AND (a.message->>'error_message' IS NULL OR a.message->>'error_message' = '')))

    UNION ALL

    -- Discovery Archive
    SELECT
      a.msg_id AS id,
      'wiki_discovery'::text AS queue_name,
      (a.message->>'tmdb_id')::bigint AS tmdb_id,
      a.message->>'media_type' AS media_type,
      a.message->>'language' AS language,
      (a.message->>'season_number')::int AS season_number,
      (a.message->>'episode_number')::int AS episode_number,
      CASE WHEN (a.message->>'error_message') IS NOT NULL AND (a.message->>'error_message') != '' THEN 'error' ELSE 'completed' END AS status,
      a.message->>'error_message' AS error_message,
      a.enqueued_at AS created_at,
      a.read_ct,
      COALESCE((a.message->>'is_manual')::boolean, false) AS is_manual
    FROM pgmq.a_wiki_discovery a
    WHERE (p_queue_name IS NULL OR p_queue_name = 'wiki_discovery')
      AND (p_status IS NULL OR (p_status = 'error' AND (a.message->>'error_message') IS NOT NULL) OR (p_status = 'completed' AND (a.message->>'error_message' IS NULL OR a.message->>'error_message' = '')))
  )
  SELECT
    all_items.id,
    all_items.queue_name,
    all_items.tmdb_id,
    all_items.media_type,
    all_items.language,
    all_items.season_number,
    all_items.episode_number,
    all_items.status,
    all_items.error_message,
    all_items.created_at,
    all_items.read_ct,
    all_items.is_manual
  FROM all_items
  ORDER BY
    CASE WHEN all_items.status = 'pending' AND all_items.is_manual = TRUE THEN 0
         WHEN all_items.status = 'processing' THEN 1
         WHEN all_items.status = 'pending' THEN 2
         ELSE 3 END ASC,
    all_items.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 3. Grant permissions
GRANT EXECUTE ON FUNCTION public.get_media_queue_items(text, text, int, int) TO authenticated, anon, service_role;
