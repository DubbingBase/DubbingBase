-- Migration: 20260829181500_three_queue_pgmq_system.sql
-- Description: Implement a 3-Queue PGMQ architecture:
--   1. wiki_discovery: Media without language (Wikidata sitelink discovery)
--   2. wiki_check: Language-specific media awaiting Wikipedia Table-of-Contents regex check
--   3. wiki_extract: Verified dubbing sections ready for Gemini LLM extraction

CREATE EXTENSION IF NOT EXISTS pgmq CASCADE;

-- 1. Create the three PGMQ queues idempotently
DO $$
BEGIN
  BEGIN
    PERFORM pgmq.create('wiki_discovery');
  EXCEPTION WHEN others THEN
    NULL;
  END;

  BEGIN
    PERFORM pgmq.create('wiki_check');
  EXCEPTION WHEN others THEN
    NULL;
  END;

  BEGIN
    PERFORM pgmq.create('wiki_extract');
  EXCEPTION WHEN others THEN
    NULL;
  END;
END $$;

-- 2. Ensure all queue tables have the headers column (needed by pgmq.send / pgmq.archive)
ALTER TABLE IF EXISTS pgmq.q_wiki_discovery ADD COLUMN IF NOT EXISTS headers jsonb DEFAULT '{}';
ALTER TABLE IF EXISTS pgmq.a_wiki_discovery ADD COLUMN IF NOT EXISTS headers jsonb DEFAULT '{}';
ALTER TABLE IF EXISTS pgmq.q_wiki_check ADD COLUMN IF NOT EXISTS headers jsonb DEFAULT '{}';
ALTER TABLE IF EXISTS pgmq.a_wiki_check ADD COLUMN IF NOT EXISTS headers jsonb DEFAULT '{}';
ALTER TABLE IF EXISTS pgmq.q_wiki_extract ADD COLUMN IF NOT EXISTS headers jsonb DEFAULT '{}';
ALTER TABLE IF EXISTS pgmq.a_wiki_extract ADD COLUMN IF NOT EXISTS headers jsonb DEFAULT '{}';

-- 3. Clear all active and archive tables for a clean start across the 3 queues & legacy tables
TRUNCATE TABLE pgmq.q_wiki_discovery;
TRUNCATE TABLE pgmq.a_wiki_discovery;
TRUNCATE TABLE pgmq.q_wiki_check;
TRUNCATE TABLE pgmq.a_wiki_check;
TRUNCATE TABLE pgmq.q_wiki_extract;
TRUNCATE TABLE pgmq.a_wiki_extract;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'pgmq' AND table_name = 'q_wiki_lang') THEN
    TRUNCATE TABLE pgmq.q_wiki_lang;
    TRUNCATE TABLE pgmq.a_wiki_lang;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'pgmq' AND table_name = 'q_wiki_nolang') THEN
    TRUNCATE TABLE pgmq.q_wiki_nolang;
    TRUNCATE TABLE pgmq.a_wiki_nolang;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'pgmq' AND table_name = 'q_media_queue') THEN
    TRUNCATE TABLE pgmq.q_media_queue;
    TRUNCATE TABLE pgmq.a_media_queue;
  END IF;
END $$;

-- 4. RPC: enqueue_media_fetch
-- Enqueues to wiki_check if language is provided, otherwise wiki_discovery
DROP FUNCTION IF EXISTS public.enqueue_media_fetch(bigint, text, int, int, text);
DROP FUNCTION IF EXISTS public.enqueue_media_fetch(text, bigint, int, int, text);
DROP FUNCTION IF EXISTS public.enqueue_media_fetch(bigint, text, int, int);
DROP FUNCTION IF EXISTS public.enqueue_media_fetch(text, bigint, int, int);

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

-- 5. RPC: enqueue_media_extract
-- Enqueues verified dubbing sections to wiki_extract
DROP FUNCTION IF EXISTS public.enqueue_media_extract(bigint, text, text, bigint, jsonb, int, int);

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

-- 6. RPC: pop_media_queue_message(p_queue_name, p_vt_seconds)
DROP FUNCTION IF EXISTS public.pop_media_queue_message(int);
DROP FUNCTION IF EXISTS public.pop_media_queue_message(text, int);

CREATE OR REPLACE FUNCTION public.pop_media_queue_message(
  p_queue_name text,
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
  IF p_queue_name NOT IN ('wiki_extract', 'wiki_check', 'wiki_discovery') THEN
    RAISE EXCEPTION 'Invalid queue name: %', p_queue_name;
  END IF;

  RETURN QUERY
  SELECT r.msg_id, r.read_ct, r.enqueued_at, r.vt, r.message
  FROM pgmq.read(p_queue_name, p_vt_seconds, 1) r;
END;
$$;

-- Overload: pop_media_queue_message(p_vt_seconds)
-- Priority order: wiki_extract (LLM ready) -> wiki_check (TOC check) -> wiki_discovery (Wikidata)
CREATE OR REPLACE FUNCTION public.pop_media_queue_message(
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

  -- 3. Fallback to wiki_discovery
  RETURN QUERY
  SELECT r.msg_id, r.read_ct, r.enqueued_at, r.vt, r.message
  FROM pgmq.read('wiki_discovery', p_vt_seconds, 1) r;
END;
$$;

-- 7. RPC: archive_media_queue_message(p_queue_name, p_msg_id)
DROP FUNCTION IF EXISTS public.archive_media_queue_message(bigint);
DROP FUNCTION IF EXISTS public.archive_media_queue_message(text, bigint);

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

  -- Resilient fallback
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

-- Overload: archive_media_queue_message(p_msg_id)
CREATE OR REPLACE FUNCTION public.archive_media_queue_message(
  p_msg_id bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM pgmq.q_wiki_extract WHERE msg_id = p_msg_id) THEN
    RETURN public.archive_media_queue_message('wiki_extract', p_msg_id);
  ELSIF EXISTS (SELECT 1 FROM pgmq.q_wiki_check WHERE msg_id = p_msg_id) THEN
    RETURN public.archive_media_queue_message('wiki_check', p_msg_id);
  ELSE
    RETURN public.archive_media_queue_message('wiki_discovery', p_msg_id);
  END IF;
END;
$$;

-- 8. RPC: archive_media_queue_message_with_error(p_queue_name, p_msg_id, p_error)
DROP FUNCTION IF EXISTS public.archive_media_queue_message_with_error(bigint, text);
DROP FUNCTION IF EXISTS public.archive_media_queue_message_with_error(text, bigint, text);

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

-- Overload: archive_media_queue_message_with_error(p_msg_id, p_error)
CREATE OR REPLACE FUNCTION public.archive_media_queue_message_with_error(
  p_msg_id bigint,
  p_error text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM pgmq.q_wiki_extract WHERE msg_id = p_msg_id) THEN
    RETURN public.archive_media_queue_message_with_error('wiki_extract', p_msg_id, p_error);
  ELSIF EXISTS (SELECT 1 FROM pgmq.q_wiki_check WHERE msg_id = p_msg_id) THEN
    RETURN public.archive_media_queue_message_with_error('wiki_check', p_msg_id, p_error);
  ELSE
    RETURN public.archive_media_queue_message_with_error('wiki_discovery', p_msg_id, p_error);
  END IF;
END;
$$;

-- 9. RPC: get_media_queue_status
DROP FUNCTION IF EXISTS public.get_media_queue_status(text, bigint, int, int, text);
DROP FUNCTION IF EXISTS public.get_media_queue_status(text, bigint, int, int);

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

  -- 3. Check wiki_discovery (if language is null)
  IF p_language IS NULL THEN
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
  END IF;

  -- 4. Check archived extract
  SELECT
    CASE
      WHEN a.message->>'error_message' IS NOT NULL THEN 'failed'
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
      WHEN a.message->>'error_message' IS NOT NULL THEN 'failed'
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
  IF p_language IS NULL THEN
    SELECT
      CASE
        WHEN a.message->>'error_message' IS NOT NULL THEN 'failed'
        ELSE 'completed'
      END INTO v_status
    FROM pgmq.a_wiki_discovery a
    WHERE (a.message->>'tmdb_id')::bigint = p_tmdb_id
      AND a.message->>'media_type' = p_media_type
      AND COALESCE((a.message->>'season_number')::int, -1) = COALESCE(p_season_number, -1)
      AND COALESCE((a.message->>'episode_number')::int, -1) = COALESCE(p_episode_number, -1)
    ORDER BY a.msg_id DESC
    LIMIT 1;

    IF v_status IS NOT NULL THEN
      RETURN v_status;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

-- 10. RPC: get_media_queue_items
DROP FUNCTION IF EXISTS public.get_media_queue_items();

CREATE OR REPLACE FUNCTION public.get_media_queue_items()
RETURNS TABLE (
  id bigint,
  tmdb_id bigint,
  media_type text,
  season_number int,
  episode_number int,
  language text,
  status text,
  error_message text,
  requested_by uuid,
  created_at timestamptz,
  queue_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
  -- Active items in wiki_extract (LLM Ready)
  SELECT
    q.msg_id AS id,
    (q.message->>'tmdb_id')::bigint AS tmdb_id,
    q.message->>'media_type' AS media_type,
    (q.message->>'season_number')::int AS season_number,
    (q.message->>'episode_number')::int AS episode_number,
    q.message->>'language' AS language,
    CASE
      WHEN q.vt > now() THEN 'processing'
      ELSE 'pending'
    END AS status,
    q.message->>'error_message' AS error_message,
    (q.message->>'requested_by')::uuid AS requested_by,
    q.enqueued_at AS created_at,
    'wiki_extract' AS queue_name
  FROM pgmq.q_wiki_extract q

  UNION ALL

  -- Active items in wiki_check (TOC Check)
  SELECT
    q.msg_id AS id,
    (q.message->>'tmdb_id')::bigint AS tmdb_id,
    q.message->>'media_type' AS media_type,
    (q.message->>'season_number')::int AS season_number,
    (q.message->>'episode_number')::int AS episode_number,
    q.message->>'language' AS language,
    CASE
      WHEN q.vt > now() THEN 'processing'
      ELSE 'pending'
    END AS status,
    q.message->>'error_message' AS error_message,
    (q.message->>'requested_by')::uuid AS requested_by,
    q.enqueued_at AS created_at,
    'wiki_check' AS queue_name
  FROM pgmq.q_wiki_check q

  UNION ALL

  -- Active items in wiki_discovery (Discovery)
  SELECT
    q.msg_id AS id,
    (q.message->>'tmdb_id')::bigint AS tmdb_id,
    q.message->>'media_type' AS media_type,
    (q.message->>'season_number')::int AS season_number,
    (q.message->>'episode_number')::int AS episode_number,
    q.message->>'language' AS language,
    CASE
      WHEN q.vt > now() THEN 'processing'
      ELSE 'pending'
    END AS status,
    q.message->>'error_message' AS error_message,
    (q.message->>'requested_by')::uuid AS requested_by,
    q.enqueued_at AS created_at,
    'wiki_discovery' AS queue_name
  FROM pgmq.q_wiki_discovery q

  UNION ALL

  -- Archived items from wiki_extract
  SELECT
    a.msg_id AS id,
    (a.message->>'tmdb_id')::bigint AS tmdb_id,
    a.message->>'media_type' AS media_type,
    (a.message->>'season_number')::int AS season_number,
    (a.message->>'episode_number')::int AS episode_number,
    a.message->>'language' AS language,
    CASE
      WHEN a.message->>'error_message' IS NOT NULL THEN 'failed'
      ELSE 'completed'
    END AS status,
    a.message->>'error_message' AS error_message,
    (a.message->>'requested_by')::uuid AS requested_by,
    a.enqueued_at AS created_at,
    'wiki_extract' AS queue_name
  FROM pgmq.a_wiki_extract a

  UNION ALL

  -- Archived items from wiki_check
  SELECT
    a.msg_id AS id,
    (a.message->>'tmdb_id')::bigint AS tmdb_id,
    a.message->>'media_type' AS media_type,
    (a.message->>'season_number')::int AS season_number,
    (a.message->>'episode_number')::int AS episode_number,
    a.message->>'language' AS language,
    CASE
      WHEN a.message->>'error_message' IS NOT NULL THEN 'failed'
      ELSE 'completed'
    END AS status,
    a.message->>'error_message' AS error_message,
    (a.message->>'requested_by')::uuid AS requested_by,
    a.enqueued_at AS created_at,
    'wiki_check' AS queue_name
  FROM pgmq.a_wiki_check a

  UNION ALL

  -- Archived items from wiki_discovery
  SELECT
    a.msg_id AS id,
    (a.message->>'tmdb_id')::bigint AS tmdb_id,
    a.message->>'media_type' AS media_type,
    (a.message->>'season_number')::int AS season_number,
    (a.message->>'episode_number')::int AS episode_number,
    a.message->>'language' AS language,
    CASE
      WHEN a.message->>'error_message' IS NOT NULL THEN 'failed'
      ELSE 'completed'
    END AS status,
    a.message->>'error_message' AS error_message,
    (a.message->>'requested_by')::uuid AS requested_by,
    a.enqueued_at AS created_at,
    'wiki_discovery' AS queue_name
  FROM pgmq.a_wiki_discovery a

  ORDER BY created_at DESC
  LIMIT 200;
$$;

-- 11. RPC: delete_media_queue_item
DROP FUNCTION IF EXISTS public.delete_media_queue_item(bigint, text);
DROP FUNCTION IF EXISTS public.delete_media_queue_item(bigint);

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

-- 12. RPC: clear_media_queue
DROP FUNCTION IF EXISTS public.clear_media_queue();

CREATE OR REPLACE FUNCTION public.clear_media_queue()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  TRUNCATE TABLE pgmq.q_wiki_extract;
  TRUNCATE TABLE pgmq.a_wiki_extract;
  TRUNCATE TABLE pgmq.q_wiki_check;
  TRUNCATE TABLE pgmq.a_wiki_check;
  TRUNCATE TABLE pgmq.q_wiki_discovery;
  TRUNCATE TABLE pgmq.a_wiki_discovery;
  RETURN TRUE;
END;
$$;

-- 13. RPC: get_media_queue_depth
DROP FUNCTION IF EXISTS public.get_media_queue_depth(text);
DROP FUNCTION IF EXISTS public.get_media_queue_depth();

CREATE OR REPLACE FUNCTION public.get_media_queue_depth(
  p_queue_name text default null
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_count bigint := 0;
BEGIN
  IF p_queue_name = 'wiki_extract' THEN
    SELECT count(*) INTO v_count FROM pgmq.q_wiki_extract;
  ELSIF p_queue_name = 'wiki_check' THEN
    SELECT count(*) INTO v_count FROM pgmq.q_wiki_check;
  ELSIF p_queue_name = 'wiki_discovery' THEN
    SELECT count(*) INTO v_count FROM pgmq.q_wiki_discovery;
  ELSE
    SELECT (
      (SELECT count(*) FROM pgmq.q_wiki_extract) +
      (SELECT count(*) FROM pgmq.q_wiki_check) +
      (SELECT count(*) FROM pgmq.q_wiki_discovery)
    ) INTO v_count;
  END IF;
  RETURN v_count;
END;
$$;

-- 14. RPC: get_media_queue_locked_count
DROP FUNCTION IF EXISTS public.get_media_queue_locked_count(text);
DROP FUNCTION IF EXISTS public.get_media_queue_locked_count();

CREATE OR REPLACE FUNCTION public.get_media_queue_locked_count(
  p_queue_name text default null
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_count bigint := 0;
BEGIN
  IF p_queue_name = 'wiki_extract' THEN
    SELECT count(*) INTO v_count FROM pgmq.q_wiki_extract WHERE vt > now();
  ELSIF p_queue_name = 'wiki_check' THEN
    SELECT count(*) INTO v_count FROM pgmq.q_wiki_check WHERE vt > now();
  ELSIF p_queue_name = 'wiki_discovery' THEN
    SELECT count(*) INTO v_count FROM pgmq.q_wiki_discovery WHERE vt > now();
  ELSE
    SELECT (
      (SELECT count(*) FROM pgmq.q_wiki_extract WHERE vt > now()) +
      (SELECT count(*) FROM pgmq.q_wiki_check WHERE vt > now()) +
      (SELECT count(*) FROM pgmq.q_wiki_discovery WHERE vt > now())
    ) INTO v_count;
  END IF;
  RETURN v_count;
END;
$$;
