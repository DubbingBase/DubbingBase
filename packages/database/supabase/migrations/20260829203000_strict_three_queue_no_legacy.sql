-- Migration: 20260829203000_strict_three_queue_no_legacy.sql
-- Description: Enforce strict 3-queue system (wiki_discovery, wiki_check, wiki_extract) and drop legacy queue tables.

-- 1. Drop legacy queues completely if they exist
DO $$
BEGIN
  BEGIN
    PERFORM pgmq.drop_queue('wiki_lang');
  EXCEPTION WHEN others THEN
    NULL;
  END;

  BEGIN
    PERFORM pgmq.drop_queue('wiki_nolang');
  EXCEPTION WHEN others THEN
    NULL;
  END;
END $$;

-- 2. Strict pop_media_queue_message
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

-- 3. Strict archive_media_queue_message
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

-- 4. Strict archive_media_queue_message_with_error
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

-- 5. Strict delete_media_queue_item
DROP FUNCTION IF EXISTS public.delete_media_queue_item(bigint, text);

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
