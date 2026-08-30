-- Migration: 20260830163000_priority_manual_queue.sql
-- Description: Prioritize manually enqueued items at the top of the queue over background items.

-- 1. Drop existing overloads to avoid PostgREST ambiguities
DO $$
DECLARE
  r RECORD;
  func_names text[] := ARRAY[
    'enqueue_media_fetch',
    'enqueue_media_extract',
    'pop_media_queue_message',
    'get_media_queue_items'
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

-- 2. Updated enqueue_media_fetch with p_is_manual
CREATE OR REPLACE FUNCTION public.enqueue_media_fetch(
  p_tmdb_id bigint,
  p_media_type text,
  p_season_number int default null,
  p_episode_number int default null,
  p_language text default null,
  p_is_manual boolean default false
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
    'is_manual', COALESCE(p_is_manual, false),
    'priority', CASE WHEN COALESCE(p_is_manual, false) THEN 'high' ELSE 'normal' END,
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

-- 3. Updated enqueue_media_extract with p_is_manual
CREATE OR REPLACE FUNCTION public.enqueue_media_extract(
  p_tmdb_id bigint,
  p_media_type text,
  p_language text,
  p_page_id bigint,
  p_section_indexes jsonb,
  p_season_number int default null,
  p_episode_number int default null,
  p_is_manual boolean default false
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
    'is_manual', COALESCE(p_is_manual, false),
    'priority', CASE WHEN COALESCE(p_is_manual, false) THEN 'high' ELSE 'normal' END,
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

-- 4. Priority-aware pop_media_queue_message
-- Prioritizes messages where is_manual = true / priority = 'high' before standard messages
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
  -- If specific queue provided
  IF p_queue_name IS NOT NULL THEN
    IF p_queue_name NOT IN ('wiki_extract', 'wiki_check', 'wiki_discovery') THEN
      RAISE EXCEPTION 'Invalid queue name: %', p_queue_name;
    END IF;

    IF p_queue_name = 'wiki_extract' THEN
      UPDATE pgmq.q_wiki_extract
      SET vt = clock_timestamp() + (p_vt_seconds || ' seconds')::interval,
          read_ct = pgmq.q_wiki_extract.read_ct + 1
      WHERE pgmq.q_wiki_extract.msg_id = (
        SELECT q.msg_id
        FROM pgmq.q_wiki_extract q
        WHERE q.vt <= clock_timestamp()
        ORDER BY
          CASE WHEN (COALESCE((q.message->>'is_manual')::boolean, false) = TRUE OR q.message->>'priority' = 'high') THEN 0 ELSE 1 END ASC,
          q.msg_id ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING pgmq.q_wiki_extract.msg_id, pgmq.q_wiki_extract.read_ct, pgmq.q_wiki_extract.enqueued_at, pgmq.q_wiki_extract.vt, pgmq.q_wiki_extract.message
      INTO msg_id, read_ct, enqueued_at, vt, message;

      IF msg_id IS NOT NULL THEN
        RETURN NEXT;
      END IF;
      RETURN;

    ELSIF p_queue_name = 'wiki_check' THEN
      UPDATE pgmq.q_wiki_check
      SET vt = clock_timestamp() + (p_vt_seconds || ' seconds')::interval,
          read_ct = pgmq.q_wiki_check.read_ct + 1
      WHERE pgmq.q_wiki_check.msg_id = (
        SELECT q.msg_id
        FROM pgmq.q_wiki_check q
        WHERE q.vt <= clock_timestamp()
        ORDER BY
          CASE WHEN (COALESCE((q.message->>'is_manual')::boolean, false) = TRUE OR q.message->>'priority' = 'high') THEN 0 ELSE 1 END ASC,
          q.msg_id ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING pgmq.q_wiki_check.msg_id, pgmq.q_wiki_check.read_ct, pgmq.q_wiki_check.enqueued_at, pgmq.q_wiki_check.vt, pgmq.q_wiki_check.message
      INTO msg_id, read_ct, enqueued_at, vt, message;

      IF msg_id IS NOT NULL THEN
        RETURN NEXT;
      END IF;
      RETURN;

    ELSE
      UPDATE pgmq.q_wiki_discovery
      SET vt = clock_timestamp() + (p_vt_seconds || ' seconds')::interval,
          read_ct = pgmq.q_wiki_discovery.read_ct + 1
      WHERE pgmq.q_wiki_discovery.msg_id = (
        SELECT q.msg_id
        FROM pgmq.q_wiki_discovery q
        WHERE q.vt <= clock_timestamp()
        ORDER BY
          CASE WHEN (COALESCE((q.message->>'is_manual')::boolean, false) = TRUE OR q.message->>'priority' = 'high') THEN 0 ELSE 1 END ASC,
          q.msg_id ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING pgmq.q_wiki_discovery.msg_id, pgmq.q_wiki_discovery.read_ct, pgmq.q_wiki_discovery.enqueued_at, pgmq.q_wiki_discovery.vt, pgmq.q_wiki_discovery.message
      INTO msg_id, read_ct, enqueued_at, vt, message;

      IF msg_id IS NOT NULL THEN
        RETURN NEXT;
      END IF;
      RETURN;
    END IF;
  END IF;

  -- Default priority across queues: extract -> check -> discovery
  -- 1. Extract
  UPDATE pgmq.q_wiki_extract
  SET vt = clock_timestamp() + (p_vt_seconds || ' seconds')::interval,
      read_ct = pgmq.q_wiki_extract.read_ct + 1
  WHERE pgmq.q_wiki_extract.msg_id = (
    SELECT q.msg_id
    FROM pgmq.q_wiki_extract q
    WHERE q.vt <= clock_timestamp()
    ORDER BY
      CASE WHEN (COALESCE((q.message->>'is_manual')::boolean, false) = TRUE OR q.message->>'priority' = 'high') THEN 0 ELSE 1 END ASC,
      q.msg_id ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING pgmq.q_wiki_extract.msg_id, pgmq.q_wiki_extract.read_ct, pgmq.q_wiki_extract.enqueued_at, pgmq.q_wiki_extract.vt, pgmq.q_wiki_extract.message
  INTO msg_id, read_ct, enqueued_at, vt, message;

  IF msg_id IS NOT NULL THEN
    RETURN NEXT;
    RETURN;
  END IF;

  -- 2. Check
  UPDATE pgmq.q_wiki_check
  SET vt = clock_timestamp() + (p_vt_seconds || ' seconds')::interval,
      read_ct = pgmq.q_wiki_check.read_ct + 1
  WHERE pgmq.q_wiki_check.msg_id = (
    SELECT q.msg_id
    FROM pgmq.q_wiki_check q
    WHERE q.vt <= clock_timestamp()
    ORDER BY
      CASE WHEN (COALESCE((q.message->>'is_manual')::boolean, false) = TRUE OR q.message->>'priority' = 'high') THEN 0 ELSE 1 END ASC,
      q.msg_id ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING pgmq.q_wiki_check.msg_id, pgmq.q_wiki_check.read_ct, pgmq.q_wiki_check.enqueued_at, pgmq.q_wiki_check.vt, pgmq.q_wiki_check.message
  INTO msg_id, read_ct, enqueued_at, vt, message;

  IF msg_id IS NOT NULL THEN
    RETURN NEXT;
    RETURN;
  END IF;

  -- 3. Discovery
  UPDATE pgmq.q_wiki_discovery
  SET vt = clock_timestamp() + (p_vt_seconds || ' seconds')::interval,
      read_ct = pgmq.q_wiki_discovery.read_ct + 1
  WHERE pgmq.q_wiki_discovery.msg_id = (
    SELECT q.msg_id
    FROM pgmq.q_wiki_discovery q
    WHERE q.vt <= clock_timestamp()
    ORDER BY
      CASE WHEN (COALESCE((q.message->>'is_manual')::boolean, false) = TRUE OR q.message->>'priority' = 'high') THEN 0 ELSE 1 END ASC,
      q.msg_id ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING pgmq.q_wiki_discovery.msg_id, pgmq.q_wiki_discovery.read_ct, pgmq.q_wiki_discovery.enqueued_at, pgmq.q_wiki_discovery.vt, pgmq.q_wiki_discovery.message
  INTO msg_id, read_ct, enqueued_at, vt, message;

  IF msg_id IS NOT NULL THEN
    RETURN NEXT;
    RETURN;
  END IF;
END;
$$;

-- 5. Updated get_media_queue_items returning is_manual
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
  SELECT * FROM all_items
  ORDER BY
    CASE WHEN status = 'pending' AND is_manual = TRUE THEN 0
         WHEN status = 'processing' THEN 1
         WHEN status = 'pending' THEN 2
         ELSE 3 END ASC,
    created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 6. Grants
GRANT EXECUTE ON FUNCTION public.enqueue_media_fetch(bigint, text, int, int, text, boolean) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_media_extract(bigint, text, text, bigint, jsonb, int, int, boolean) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.pop_media_queue_message(text, int) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_media_queue_items(text, text, int, int) TO authenticated, anon, service_role;
