-- Migration: 20260829202500_queue_alias_compatibility.sql
-- Description: Add backwards compatibility mapping for legacy queue names (wiki_nolang -> wiki_discovery, wiki_lang -> wiki_check)

-- 1. RPC: pop_media_queue_message(p_queue_name, p_vt_seconds)
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
DECLARE
  v_normalized_queue text := p_queue_name;
BEGIN
  -- Compatibility aliases
  IF v_normalized_queue = 'wiki_nolang' OR v_normalized_queue = 'discovery' THEN
    v_normalized_queue := 'wiki_discovery';
  ELSIF v_normalized_queue = 'wiki_lang' OR v_normalized_queue = 'check' THEN
    v_normalized_queue := 'wiki_check';
  ELSIF v_normalized_queue = 'extract' THEN
    v_normalized_queue := 'wiki_extract';
  END IF;

  IF v_normalized_queue NOT IN ('wiki_extract', 'wiki_check', 'wiki_discovery') THEN
    RAISE EXCEPTION 'Invalid queue name: %', p_queue_name;
  END IF;

  RETURN QUERY
  SELECT r.msg_id, r.read_ct, r.enqueued_at, r.vt, r.message
  FROM pgmq.read(v_normalized_queue, p_vt_seconds, 1) r;
END;
$$;

-- 2. RPC: archive_media_queue_message(p_queue_name, p_msg_id)
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
  v_normalized_queue text := p_queue_name;
  v_archived boolean;
BEGIN
  -- Compatibility aliases
  IF v_normalized_queue = 'wiki_nolang' OR v_normalized_queue = 'discovery' THEN
    v_normalized_queue := 'wiki_discovery';
  ELSIF v_normalized_queue = 'wiki_lang' OR v_normalized_queue = 'check' THEN
    v_normalized_queue := 'wiki_check';
  ELSIF v_normalized_queue = 'extract' THEN
    v_normalized_queue := 'wiki_extract';
  END IF;

  IF v_normalized_queue NOT IN ('wiki_extract', 'wiki_check', 'wiki_discovery') THEN
    RAISE EXCEPTION 'Invalid queue name: %', p_queue_name;
  END IF;

  BEGIN
    SELECT pgmq.archive(v_normalized_queue, p_msg_id) INTO v_archived;
    IF v_archived THEN
      RETURN TRUE;
    END IF;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  -- Resilient fallback
  IF v_normalized_queue = 'wiki_extract' THEN
    INSERT INTO pgmq.a_wiki_extract (msg_id, read_ct, enqueued_at, vt, message, headers)
    SELECT msg_id, read_ct, enqueued_at, vt, message, COALESCE(headers, '{}'::jsonb)
    FROM pgmq.q_wiki_extract WHERE msg_id = p_msg_id
    ON CONFLICT (msg_id) DO UPDATE SET message = EXCLUDED.message;
    DELETE FROM pgmq.q_wiki_extract WHERE msg_id = p_msg_id;
  ELSIF v_normalized_queue = 'wiki_check' THEN
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

-- 3. RPC: archive_media_queue_message_with_error(p_queue_name, p_msg_id, p_error)
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
DECLARE
  v_normalized_queue text := p_queue_name;
BEGIN
  -- Compatibility aliases
  IF v_normalized_queue = 'wiki_nolang' OR v_normalized_queue = 'discovery' THEN
    v_normalized_queue := 'wiki_discovery';
  ELSIF v_normalized_queue = 'wiki_lang' OR v_normalized_queue = 'check' THEN
    v_normalized_queue := 'wiki_check';
  ELSIF v_normalized_queue = 'extract' THEN
    v_normalized_queue := 'wiki_extract';
  END IF;

  IF v_normalized_queue NOT IN ('wiki_extract', 'wiki_check', 'wiki_discovery') THEN
    RAISE EXCEPTION 'Invalid queue name: %', p_queue_name;
  END IF;

  IF v_normalized_queue = 'wiki_extract' THEN
    UPDATE pgmq.q_wiki_extract
    SET message = jsonb_set(message, '{error_message}', to_jsonb(p_error))
    WHERE msg_id = p_msg_id;
  ELSIF v_normalized_queue = 'wiki_check' THEN
    UPDATE pgmq.q_wiki_check
    SET message = jsonb_set(message, '{error_message}', to_jsonb(p_error))
    WHERE msg_id = p_msg_id;
  ELSE
    UPDATE pgmq.q_wiki_discovery
    SET message = jsonb_set(message, '{error_message}', to_jsonb(p_error))
    WHERE msg_id = p_msg_id;
  END IF;

  PERFORM public.archive_media_queue_message(v_normalized_queue, p_msg_id);

  IF v_normalized_queue = 'wiki_extract' THEN
    UPDATE pgmq.a_wiki_extract
    SET message = jsonb_set(message, '{error_message}', to_jsonb(p_error))
    WHERE msg_id = p_msg_id;
  ELSIF v_normalized_queue = 'wiki_check' THEN
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

-- 4. RPC: delete_media_queue_item
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
DECLARE
  v_normalized_queue text := p_queue_name;
BEGIN
  IF v_normalized_queue = 'wiki_nolang' OR v_normalized_queue = 'discovery' THEN
    v_normalized_queue := 'wiki_discovery';
  ELSIF v_normalized_queue = 'wiki_lang' OR v_normalized_queue = 'check' THEN
    v_normalized_queue := 'wiki_check';
  ELSIF v_normalized_queue = 'extract' THEN
    v_normalized_queue := 'wiki_extract';
  END IF;

  IF v_normalized_queue = 'wiki_extract' THEN
    DELETE FROM pgmq.q_wiki_extract WHERE msg_id = p_id;
    DELETE FROM pgmq.a_wiki_extract WHERE msg_id = p_id;
    RETURN TRUE;
  ELSIF v_normalized_queue = 'wiki_check' THEN
    DELETE FROM pgmq.q_wiki_check WHERE msg_id = p_id;
    DELETE FROM pgmq.a_wiki_check WHERE msg_id = p_id;
    RETURN TRUE;
  ELSIF v_normalized_queue = 'wiki_discovery' THEN
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
