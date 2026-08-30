-- Migration: 20260830142000_deduplicate_rpc_overloads.sql
-- Description: Drop all conflicting overloads of media queue RPCs and establish canonical signatures.

-- 1. Dynamically drop all existing overloads for media queue functions
DO $$
DECLARE
  r RECORD;
  func_names text[] := ARRAY[
    'enqueue_media_fetch',
    'enqueue_media_extract',
    'pop_media_queue_message',
    'archive_media_queue_message',
    'archive_media_queue_message_with_error',
    'delete_media_queue_item',
    'get_media_queue_status',
    'get_media_queue_items',
    'get_media_queue_stats'
  ];
  fname text;
BEGIN
  FOREACH fname IN ARRAY func_names LOOP
    FOR r IN (
      SELECT p.oid::regprocedure::text AS func_signature
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = fname
    ) LOOP
      EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
    END LOOP;
  END LOOP;
END $$;

-- 2. Canonical enqueue_media_fetch
CREATE OR REPLACE FUNCTION public.enqueue_media_fetch(
  p_tmdb_id bigint,
  p_media_type text,
  p_season_number int default null,
  p_episode_number int default null,
  p_language text default null
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_payload jsonb;
  v_msg_id bigint;
  v_target_queue text;
BEGIN
  IF p_language IS NOT NULL AND trim(p_language) != '' THEN
    v_target_queue := 'wiki_check';
  ELSE
    v_target_queue := 'wiki_discovery';
  END IF;

  v_payload := jsonb_build_object(
    'tmdb_id', p_tmdb_id,
    'media_type', p_media_type,
    'season_number', p_season_number,
    'episode_number', p_episode_number,
    'language', CASE WHEN p_language IS NOT NULL AND trim(p_language) != '' THEN trim(p_language) ELSE NULL END,
    'requested_by', auth.uid()
  );

  -- Duplicate check in active queue
  IF v_target_queue = 'wiki_check' THEN
    IF EXISTS (
      SELECT 1 FROM pgmq.q_wiki_check
      WHERE (message->>'tmdb_id')::bigint = p_tmdb_id
        AND message->>'media_type' = p_media_type
        AND (message->>'language') = trim(p_language)
        AND COALESCE((message->>'season_number')::int, -1) = COALESCE(p_season_number, -1)
        AND COALESCE((message->>'episode_number')::int, -1) = COALESCE(p_episode_number, -1)
    ) THEN
      RAISE EXCEPTION 'Item is already in the check queue';
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1 FROM pgmq.q_wiki_discovery
      WHERE (message->>'tmdb_id')::bigint = p_tmdb_id
        AND message->>'media_type' = p_media_type
        AND COALESCE((message->>'season_number')::int, -1) = COALESCE(p_season_number, -1)
        AND COALESCE((message->>'episode_number')::int, -1) = COALESCE(p_episode_number, -1)
    ) THEN
      RAISE EXCEPTION 'Item is already in the discovery queue';
    END IF;
  END IF;

  IF v_target_queue = 'wiki_check' THEN
    SELECT pgmq.send('wiki_check', v_payload, '{}'::jsonb) INTO v_msg_id;
  ELSE
    SELECT pgmq.send('wiki_discovery', v_payload, '{}'::jsonb) INTO v_msg_id;
  END IF;

  RETURN v_msg_id;
END;
$$;

-- 3. Canonical enqueue_media_extract
CREATE OR REPLACE FUNCTION public.enqueue_media_extract(
  p_tmdb_id bigint,
  p_media_type text,
  p_language text,
  p_page_id bigint,
  p_section_indexes jsonb,
  p_season_number int default null,
  p_episode_number int default null
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_payload jsonb;
  v_msg_id bigint;
BEGIN
  v_payload := jsonb_build_object(
    'tmdb_id', p_tmdb_id,
    'media_type', p_media_type,
    'language', trim(p_language),
    'page_id', p_page_id,
    'section_indexes', p_section_indexes,
    'season_number', p_season_number,
    'episode_number', p_episode_number,
    'requested_by', auth.uid()
  );

  -- Duplicate check in active extract queue
  IF EXISTS (
    SELECT 1 FROM pgmq.q_wiki_extract
    WHERE (message->>'tmdb_id')::bigint = p_tmdb_id
      AND message->>'media_type' = p_media_type
      AND (message->>'language') = trim(p_language)
      AND COALESCE((message->>'season_number')::int, -1) = COALESCE(p_season_number, -1)
      AND COALESCE((message->>'episode_number')::int, -1) = COALESCE(p_episode_number, -1)
  ) THEN
    RAISE EXCEPTION 'Item is already in the extract queue';
  END IF;

  SELECT pgmq.send('wiki_extract', v_payload, '{}'::jsonb) INTO v_msg_id;
  RETURN v_msg_id;
END;
$$;

-- 4. Canonical pop_media_queue_message
CREATE OR REPLACE FUNCTION public.pop_media_queue_message(
  p_queue_name text default null,
  p_vt_seconds int default 30
)
RETURNS TABLE (
  msg_id bigint,
  read_ct int,
  enqueued_at timestamptz,
  vt timestamptz,
  message jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  IF p_queue_name IS NOT NULL THEN
    IF p_queue_name NOT IN ('wiki_extract', 'wiki_check', 'wiki_discovery') THEN
      RAISE EXCEPTION 'Invalid queue name: %', p_queue_name;
    END IF;

    RETURN QUERY
    SELECT r.msg_id, r.read_ct, r.enqueued_at, r.vt, r.message
    FROM pgmq.read(p_queue_name, p_vt_seconds, 1) r;
    RETURN;
  END IF;

  -- Default priority order when no queue specified
  -- 1. Check wiki_extract
  RETURN QUERY
  SELECT r.msg_id, r.read_ct, r.enqueued_at, r.vt, r.message
  FROM pgmq.read('wiki_extract', p_vt_seconds, 1) r;

  IF FOUND THEN
    RETURN;
  END IF;

  -- 2. Check wiki_check
  RETURN QUERY
  SELECT r.msg_id, r.read_ct, r.enqueued_at, r.vt, r.message
  FROM pgmq.read('wiki_check', p_vt_seconds, 1) r;

  IF FOUND THEN
    RETURN;
  END IF;

  -- 3. Check wiki_discovery
  RETURN QUERY
  SELECT r.msg_id, r.read_ct, r.enqueued_at, r.vt, r.message
  FROM pgmq.read('wiki_discovery', p_vt_seconds, 1) r;
END;
$$;

-- 5. Canonical archive_media_queue_message
CREATE OR REPLACE FUNCTION public.archive_media_queue_message(
  p_queue_name text,
  p_msg_id bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_archived boolean;
BEGIN
  IF p_queue_name NOT IN ('wiki_extract', 'wiki_check', 'wiki_discovery') THEN
    RAISE EXCEPTION 'Invalid queue name: %', p_queue_name;
  END IF;

  BEGIN
    SELECT pgmq.archive(p_queue_name, p_msg_id) INTO v_archived;
    IF v_archived THEN
      RETURN TRUE;
    END IF;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  -- Fallback
  IF p_queue_name = 'wiki_extract' THEN
    INSERT INTO pgmq.a_wiki_extract (msg_id, read_ct, enqueued_at, vt, message, headers)
    SELECT msg_id, read_ct, enqueued_at, vt, message, COALESCE(headers, '{}'::jsonb)
    FROM pgmq.q_wiki_extract WHERE msg_id = p_msg_id
    ON CONFLICT (msg_id) DO UPDATE SET message = EXCLUDED.message;
    DELETE FROM pgmq.q_wiki_extract WHERE msg_id = p_msg_id;
  ELSIF p_queue_name = 'wiki_check' THEN
    INSERT INTO pgmq.a_wiki_check (msg_id, read_ct, enqueued_at, vt, message, headers)
    SELECT msg_id, read_ct, enqueued_at, vt, message, COALESCE(headers, '{}'::jsonb)
    FROM pgmq.q_wiki_check WHERE msg_id = p_msg_id
    ON CONFLICT (msg_id) DO UPDATE SET message = EXCLUDED.message;
    DELETE FROM pgmq.q_wiki_check WHERE msg_id = p_msg_id;
  ELSE
    INSERT INTO pgmq.a_wiki_discovery (msg_id, read_ct, enqueued_at, vt, message, headers)
    SELECT msg_id, read_ct, enqueued_at, vt, message, COALESCE(headers, '{}'::jsonb)
    FROM pgmq.q_wiki_discovery WHERE msg_id = p_msg_id
    ON CONFLICT (msg_id) DO UPDATE SET message = EXCLUDED.message;
    DELETE FROM pgmq.q_wiki_discovery WHERE msg_id = p_msg_id;
  END IF;

  RETURN TRUE;
END;
$$;

-- 6. Canonical archive_media_queue_message_with_error
CREATE OR REPLACE FUNCTION public.archive_media_queue_message_with_error(
  p_queue_name text,
  p_msg_id bigint,
  p_error text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  IF p_queue_name NOT IN ('wiki_extract', 'wiki_check', 'wiki_discovery') THEN
    RAISE EXCEPTION 'Invalid queue name: %', p_queue_name;
  END IF;

  IF p_queue_name = 'wiki_extract' THEN
    UPDATE pgmq.q_wiki_extract
    SET message = jsonb_set(message, '{error_message}', to_jsonb(p_error))
    WHERE msg_id = p_msg_id;
  ELSIF p_queue_name = 'wiki_check' THEN
    UPDATE pgmq.q_wiki_check
    SET message = jsonb_set(message, '{error_message}', to_jsonb(p_error))
    WHERE msg_id = p_msg_id;
  ELSE
    UPDATE pgmq.q_wiki_discovery
    SET message = jsonb_set(message, '{error_message}', to_jsonb(p_error))
    WHERE msg_id = p_msg_id;
  END IF;

  PERFORM public.archive_media_queue_message(p_queue_name, p_msg_id);

  IF p_queue_name = 'wiki_extract' THEN
    UPDATE pgmq.a_wiki_extract
    SET message = jsonb_set(message, '{error_message}', to_jsonb(p_error))
    WHERE msg_id = p_msg_id;
  ELSIF p_queue_name = 'wiki_check' THEN
    UPDATE pgmq.a_wiki_check
    SET message = jsonb_set(message, '{error_message}', to_jsonb(p_error))
    WHERE msg_id = p_msg_id;
  ELSE
    UPDATE pgmq.a_wiki_discovery
    SET message = jsonb_set(message, '{error_message}', to_jsonb(p_error))
    WHERE msg_id = p_msg_id;
  END IF;

  RETURN TRUE;
END;
$$;

-- 7. Canonical delete_media_queue_item
CREATE OR REPLACE FUNCTION public.delete_media_queue_item(
  p_id bigint,
  p_queue_name text default null
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  IF p_queue_name = 'wiki_extract' THEN
    DELETE FROM pgmq.q_wiki_extract WHERE msg_id = p_id;
    DELETE FROM pgmq.a_wiki_extract WHERE msg_id = p_id;
    RETURN TRUE;
  ELSIF p_queue_name = 'wiki_check' THEN
    DELETE FROM pgmq.q_wiki_check WHERE msg_id = p_id;
    DELETE FROM pgmq.a_wiki_check WHERE msg_id = p_id;
    RETURN TRUE;
  ELSIF p_queue_name = 'wiki_discovery' THEN
    DELETE FROM pgmq.q_wiki_discovery WHERE msg_id = p_id;
    DELETE FROM pgmq.a_wiki_discovery WHERE msg_id = p_id;
    RETURN TRUE;
  ELSE
    DELETE FROM pgmq.q_wiki_extract WHERE msg_id = p_id;
    DELETE FROM pgmq.a_wiki_extract WHERE msg_id = p_id;
    DELETE FROM pgmq.q_wiki_check WHERE msg_id = p_id;
    DELETE FROM pgmq.a_wiki_check WHERE msg_id = p_id;
    DELETE FROM pgmq.q_wiki_discovery WHERE msg_id = p_id;
    DELETE FROM pgmq.a_wiki_discovery WHERE msg_id = p_id;
    RETURN TRUE;
  END IF;
END;
$$;

-- 8. Canonical get_media_queue_status
CREATE OR REPLACE FUNCTION public.get_media_queue_status(
  p_media_type text,
  p_tmdb_id bigint,
  p_season_number int default null,
  p_episode_number int default null,
  p_language text default null
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_status text;
BEGIN
  -- 1. Check wiki_extract
  SELECT
    CASE
      WHEN q.vt > now() THEN 'processing'
      ELSE 'pending'
    END INTO v_status
  FROM pgmq.q_wiki_extract q
  WHERE (q.message->>'tmdb_id')::bigint = p_tmdb_id
    AND q.message->>'media_type' = p_media_type
    AND (p_language IS NULL OR q.message->>'language' = trim(p_language))
    AND COALESCE((q.message->>'season_number')::int, -1) = COALESCE(p_season_number, -1)
    AND COALESCE((q.message->>'episode_number')::int, -1) = COALESCE(p_episode_number, -1)
  ORDER BY q.msg_id DESC
  LIMIT 1;

  IF v_status IS NOT NULL THEN
    RETURN v_status;
  END IF;

  -- 2. Check wiki_check
  SELECT
    CASE
      WHEN q.vt > now() THEN 'processing'
      ELSE 'pending'
    END INTO v_status
  FROM pgmq.q_wiki_check q
  WHERE (q.message->>'tmdb_id')::bigint = p_tmdb_id
    AND q.message->>'media_type' = p_media_type
    AND (p_language IS NULL OR q.message->>'language' = trim(p_language))
    AND COALESCE((q.message->>'season_number')::int, -1) = COALESCE(p_season_number, -1)
    AND COALESCE((q.message->>'episode_number')::int, -1) = COALESCE(p_episode_number, -1)
  ORDER BY q.msg_id DESC
  LIMIT 1;

  IF v_status IS NOT NULL THEN
    RETURN v_status;
  END IF;

  -- 3. Check wiki_discovery
  SELECT
    CASE
      WHEN q.vt > now() THEN 'processing'
      ELSE 'pending'
    END INTO v_status
  FROM pgmq.q_wiki_discovery q
  WHERE (q.message->>'tmdb_id')::bigint = p_tmdb_id
    AND q.message->>'media_type' = p_media_type
    AND COALESCE((q.message->>'season_number')::int, -1) = COALESCE(p_season_number, -1)
    AND COALESCE((q.message->>'episode_number')::int, -1) = COALESCE(p_episode_number, -1)
  ORDER BY q.msg_id DESC
  LIMIT 1;

  IF v_status IS NOT NULL THEN
    RETURN v_status;
  END IF;

  -- 4. Check archived extract
  SELECT
    CASE
      WHEN (a.message->>'error_message') IS NOT NULL AND (a.message->>'error_message') != '' THEN 'error'
      ELSE 'completed'
    END INTO v_status
  FROM pgmq.a_wiki_extract a
  WHERE (a.message->>'tmdb_id')::bigint = p_tmdb_id
    AND a.message->>'media_type' = p_media_type
    AND (p_language IS NULL OR a.message->>'language' = trim(p_language))
    AND COALESCE((a.message->>'season_number')::int, -1) = COALESCE(p_season_number, -1)
    AND COALESCE((a.message->>'episode_number')::int, -1) = COALESCE(p_episode_number, -1)
  ORDER BY a.msg_id DESC
  LIMIT 1;

  IF v_status IS NOT NULL THEN
    RETURN v_status;
  END IF;

  -- 5. Check archived check
  SELECT
    CASE
      WHEN (a.message->>'error_message') IS NOT NULL AND (a.message->>'error_message') != '' THEN 'error'
      ELSE 'completed'
    END INTO v_status
  FROM pgmq.a_wiki_check a
  WHERE (a.message->>'tmdb_id')::bigint = p_tmdb_id
    AND a.message->>'media_type' = p_media_type
    AND (p_language IS NULL OR a.message->>'language' = trim(p_language))
    AND COALESCE((a.message->>'season_number')::int, -1) = COALESCE(p_season_number, -1)
    AND COALESCE((a.message->>'episode_number')::int, -1) = COALESCE(p_episode_number, -1)
  ORDER BY a.msg_id DESC
  LIMIT 1;

  IF v_status IS NOT NULL THEN
    RETURN v_status;
  END IF;

  -- 6. Check archived discovery
  SELECT
    CASE
      WHEN (a.message->>'error_message') IS NOT NULL AND (a.message->>'error_message') != '' THEN 'error'
      ELSE 'completed'
    END INTO v_status
  FROM pgmq.a_wiki_discovery a
  WHERE (a.message->>'tmdb_id')::bigint = p_tmdb_id
    AND a.message->>'media_type' = p_media_type
    AND COALESCE((a.message->>'season_number')::int, -1) = COALESCE(p_season_number, -1)
    AND COALESCE((a.message->>'episode_number')::int, -1) = COALESCE(p_episode_number, -1)
  ORDER BY a.msg_id DESC
  LIMIT 1;

  RETURN COALESCE(v_status, 'none');
END;
$$;

-- 9. Canonical get_media_queue_items
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
  read_ct int
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
      q.read_ct
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
      q.read_ct
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
      q.read_ct
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
      a.read_ct
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
      a.read_ct
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
      a.read_ct
    FROM pgmq.a_wiki_discovery a
    WHERE (p_queue_name IS NULL OR p_queue_name = 'wiki_discovery')
      AND (p_status IS NULL OR (p_status = 'error' AND (a.message->>'error_message') IS NOT NULL) OR (p_status = 'completed' AND (a.message->>'error_message' IS NULL OR a.message->>'error_message' = '')))
  )
  SELECT * FROM all_items
  ORDER BY created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 10. Canonical get_media_queue_stats
CREATE OR REPLACE FUNCTION public.get_media_queue_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_extract_pending bigint := 0;
  v_extract_processing bigint := 0;
  v_extract_completed bigint := 0;
  v_extract_error bigint := 0;

  v_check_pending bigint := 0;
  v_check_processing bigint := 0;
  v_check_completed bigint := 0;
  v_check_error bigint := 0;

  v_discovery_pending bigint := 0;
  v_discovery_processing bigint := 0;
  v_discovery_completed bigint := 0;
  v_discovery_error bigint := 0;
BEGIN
  -- Extract stats
  SELECT COUNT(*) FILTER (WHERE vt <= now()), COUNT(*) FILTER (WHERE vt > now())
  INTO v_extract_pending, v_extract_processing
  FROM pgmq.q_wiki_extract;

  SELECT COUNT(*) FILTER (WHERE message->>'error_message' IS NULL OR message->>'error_message' = ''),
         COUNT(*) FILTER (WHERE message->>'error_message' IS NOT NULL AND message->>'error_message' != '')
  INTO v_extract_completed, v_extract_error
  FROM pgmq.a_wiki_extract;

  -- Check stats
  SELECT COUNT(*) FILTER (WHERE vt <= now()), COUNT(*) FILTER (WHERE vt > now())
  INTO v_check_pending, v_check_processing
  FROM pgmq.q_wiki_check;

  SELECT COUNT(*) FILTER (WHERE message->>'error_message' IS NULL OR message->>'error_message' = ''),
         COUNT(*) FILTER (WHERE message->>'error_message' IS NOT NULL AND message->>'error_message' != '')
  INTO v_check_completed, v_check_error
  FROM pgmq.a_wiki_check;

  -- Discovery stats
  SELECT COUNT(*) FILTER (WHERE vt <= now()), COUNT(*) FILTER (WHERE vt > now())
  INTO v_discovery_pending, v_discovery_processing
  FROM pgmq.q_wiki_discovery;

  SELECT COUNT(*) FILTER (WHERE message->>'error_message' IS NULL OR message->>'error_message' = ''),
         COUNT(*) FILTER (WHERE message->>'error_message' IS NOT NULL AND message->>'error_message' != '')
  INTO v_discovery_completed, v_discovery_error
  FROM pgmq.a_wiki_discovery;

  RETURN jsonb_build_object(
    'wiki_extract', jsonb_build_object(
      'pending', COALESCE(v_extract_pending, 0),
      'processing', COALESCE(v_extract_processing, 0),
      'completed', COALESCE(v_extract_completed, 0),
      'error', COALESCE(v_extract_error, 0),
      'total_active', COALESCE(v_extract_pending, 0) + COALESCE(v_extract_processing, 0)
    ),
    'wiki_check', jsonb_build_object(
      'pending', COALESCE(v_check_pending, 0),
      'processing', COALESCE(v_check_processing, 0),
      'completed', COALESCE(v_check_completed, 0),
      'error', COALESCE(v_check_error, 0),
      'total_active', COALESCE(v_check_pending, 0) + COALESCE(v_check_processing, 0)
    ),
    'wiki_discovery', jsonb_build_object(
      'pending', COALESCE(v_discovery_pending, 0),
      'processing', COALESCE(v_discovery_processing, 0),
      'completed', COALESCE(v_discovery_completed, 0),
      'error', COALESCE(v_discovery_error, 0),
      'total_active', COALESCE(v_discovery_pending, 0) + COALESCE(v_discovery_processing, 0)
    ),
    'totals', jsonb_build_object(
      'pending', COALESCE(v_extract_pending, 0) + COALESCE(v_check_pending, 0) + COALESCE(v_discovery_pending, 0),
      'processing', COALESCE(v_extract_processing, 0) + COALESCE(v_check_processing, 0) + COALESCE(v_discovery_processing, 0),
      'completed', COALESCE(v_extract_completed, 0) + COALESCE(v_check_completed, 0) + COALESCE(v_discovery_completed, 0),
      'error', COALESCE(v_extract_error, 0) + COALESCE(v_check_error, 0) + COALESCE(v_discovery_error, 0),
      'total_active', COALESCE(v_extract_pending, 0) + COALESCE(v_extract_processing, 0) + COALESCE(v_check_pending, 0) + COALESCE(v_check_processing, 0) + COALESCE(v_discovery_pending, 0) + COALESCE(v_discovery_processing, 0)
    )
  );
END;
$$;

-- 11. Grant permissions
GRANT EXECUTE ON FUNCTION public.enqueue_media_fetch(bigint, text, int, int, text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_media_extract(bigint, text, text, bigint, jsonb, int, int) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.pop_media_queue_message(text, int) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.archive_media_queue_message(text, bigint) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.archive_media_queue_message_with_error(text, bigint, text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.delete_media_queue_item(bigint, text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_media_queue_status(text, bigint, int, int, text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_media_queue_items(text, text, int, int) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_media_queue_stats() TO authenticated, anon, service_role;
