-- Keep stale or concurrent queue workers from replacing a finalized archive row.
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
  v_message jsonb;
  v_read_ct integer;
  v_enqueued_at timestamptz;
  v_vt timestamptz;
  v_headers jsonb;
  v_inserted integer;
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

  IF p_queue_name = 'wiki_extract' THEN
    SELECT read_ct, enqueued_at, vt, message, COALESCE(headers, '{}'::jsonb)
    INTO v_read_ct, v_enqueued_at, v_vt, v_message, v_headers
    FROM pgmq.q_wiki_extract WHERE msg_id = p_msg_id FOR UPDATE;
  ELSIF p_queue_name = 'wiki_check' THEN
    SELECT read_ct, enqueued_at, vt, message, COALESCE(headers, '{}'::jsonb)
    INTO v_read_ct, v_enqueued_at, v_vt, v_message, v_headers
    FROM pgmq.q_wiki_check WHERE msg_id = p_msg_id FOR UPDATE;
  ELSE
    SELECT read_ct, enqueued_at, vt, message, COALESCE(headers, '{}'::jsonb)
    INTO v_read_ct, v_enqueued_at, v_vt, v_message, v_headers
    FROM pgmq.q_wiki_discovery WHERE msg_id = p_msg_id FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF p_queue_name = 'wiki_extract' THEN
    INSERT INTO pgmq.a_wiki_extract (msg_id, read_ct, enqueued_at, vt, message, headers)
    VALUES (p_msg_id, v_read_ct, v_enqueued_at, v_vt, v_message, v_headers)
    ON CONFLICT (msg_id) DO NOTHING;
  ELSIF p_queue_name = 'wiki_check' THEN
    INSERT INTO pgmq.a_wiki_check (msg_id, read_ct, enqueued_at, vt, message, headers)
    VALUES (p_msg_id, v_read_ct, v_enqueued_at, v_vt, v_message, v_headers)
    ON CONFLICT (msg_id) DO NOTHING;
  ELSE
    INSERT INTO pgmq.a_wiki_discovery (msg_id, read_ct, enqueued_at, vt, message, headers)
    VALUES (p_msg_id, v_read_ct, v_enqueued_at, v_vt, v_message, v_headers)
    ON CONFLICT (msg_id) DO NOTHING;
  END IF;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    RETURN FALSE;
  END IF;

  IF p_queue_name = 'wiki_extract' THEN
    DELETE FROM pgmq.q_wiki_extract WHERE msg_id = p_msg_id;
  ELSIF p_queue_name = 'wiki_check' THEN
    DELETE FROM pgmq.q_wiki_check WHERE msg_id = p_msg_id;
  ELSE
    DELETE FROM pgmq.q_wiki_discovery WHERE msg_id = p_msg_id;
  END IF;

  RETURN TRUE;
END;
$$;

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
  v_updated integer;
BEGIN
  IF p_queue_name NOT IN ('wiki_extract', 'wiki_check', 'wiki_discovery') THEN
    RAISE EXCEPTION 'Invalid queue name: %', p_queue_name;
  END IF;

  IF p_queue_name = 'wiki_extract' THEN
    UPDATE pgmq.q_wiki_extract SET message = jsonb_set(message, '{error_message}', to_jsonb(p_error))
    WHERE msg_id = p_msg_id;
  ELSIF p_queue_name = 'wiki_check' THEN
    UPDATE pgmq.q_wiki_check SET message = jsonb_set(message, '{error_message}', to_jsonb(p_error))
    WHERE msg_id = p_msg_id;
  ELSE
    UPDATE pgmq.q_wiki_discovery SET message = jsonb_set(message, '{error_message}', to_jsonb(p_error))
    WHERE msg_id = p_msg_id;
  END IF;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RETURN FALSE;
  END IF;

  RETURN public.archive_media_queue_message(p_queue_name, p_msg_id);
END;
$$;
