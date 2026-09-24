-- Add a bounded batch-read RPC while preserving the existing single-item RPC
-- for extraction and other callers.
CREATE OR REPLACE FUNCTION public.pop_media_queue_batch(
  p_queue_name text,
  p_vt_seconds integer,
  p_batch_size integer
)
RETURNS TABLE (
  msg_id bigint,
  read_ct integer,
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

  IF p_batch_size IS NULL OR p_batch_size < 1 OR p_batch_size > 5 THEN
    RAISE EXCEPTION 'Invalid batch size: %, must be between 1 and 5', p_batch_size;
  END IF;

  IF p_vt_seconds IS NULL OR p_vt_seconds < 1 THEN
    RAISE EXCEPTION 'Visibility timeout must be greater than zero';
  END IF;

  RETURN QUERY
  SELECT r.msg_id, r.read_ct, r.enqueued_at, r.vt, r.message
  FROM pgmq.read(p_queue_name, p_vt_seconds, p_batch_size) AS r;
END;
$$;

REVOKE ALL ON FUNCTION public.pop_media_queue_batch(text, integer, integer)
  FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.pop_media_queue_batch(text, integer, integer)
  TO service_role;

CREATE OR REPLACE FUNCTION public.archive_media_queue_messages(
  p_queue_name text,
  p_msg_ids bigint[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_msg_id bigint;
  v_archived boolean;
  v_deleted_count integer;
  v_archived_count integer := 0;
BEGIN
  IF p_queue_name NOT IN ('wiki_extract', 'wiki_check', 'wiki_discovery') THEN
    RAISE EXCEPTION 'Invalid queue name: %', p_queue_name;
  END IF;

  IF COALESCE(cardinality(p_msg_ids), 0) > 5 THEN
    RAISE EXCEPTION 'Cannot archive more than 5 queue messages at once';
  END IF;

  FOREACH v_msg_id IN ARRAY COALESCE(p_msg_ids, ARRAY[]::bigint[]) LOOP
    v_archived := false;
    BEGIN
      SELECT pgmq.archive(p_queue_name, v_msg_id) INTO v_archived;
    EXCEPTION WHEN others THEN
      -- Fall through to the same manual archive fallback as the single-item RPC.
      v_archived := false;
    END;

    IF v_archived THEN
      v_archived_count := v_archived_count + 1;
      CONTINUE;
    END IF;

    IF p_queue_name = 'wiki_extract' THEN
      INSERT INTO pgmq.a_wiki_extract (msg_id, read_ct, enqueued_at, vt, message, headers)
      SELECT msg_id, read_ct, enqueued_at, vt, message, COALESCE(headers, '{}'::jsonb)
      FROM pgmq.q_wiki_extract WHERE msg_id = v_msg_id
      ON CONFLICT (msg_id) DO UPDATE SET message = EXCLUDED.message;
      DELETE FROM pgmq.q_wiki_extract WHERE msg_id = v_msg_id;
    ELSIF p_queue_name = 'wiki_check' THEN
      INSERT INTO pgmq.a_wiki_check (msg_id, read_ct, enqueued_at, vt, message, headers)
      SELECT msg_id, read_ct, enqueued_at, vt, message, COALESCE(headers, '{}'::jsonb)
      FROM pgmq.q_wiki_check WHERE msg_id = v_msg_id
      ON CONFLICT (msg_id) DO UPDATE SET message = EXCLUDED.message;
      DELETE FROM pgmq.q_wiki_check WHERE msg_id = v_msg_id;
    ELSE
      INSERT INTO pgmq.a_wiki_discovery (msg_id, read_ct, enqueued_at, vt, message, headers)
      SELECT msg_id, read_ct, enqueued_at, vt, message, COALESCE(headers, '{}'::jsonb)
      FROM pgmq.q_wiki_discovery WHERE msg_id = v_msg_id
      ON CONFLICT (msg_id) DO UPDATE SET message = EXCLUDED.message;
      DELETE FROM pgmq.q_wiki_discovery WHERE msg_id = v_msg_id;
    END IF;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    v_archived_count := v_archived_count + v_deleted_count;
  END LOOP;

  RETURN v_archived_count;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_media_queue_messages(text, bigint[])
  FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.archive_media_queue_messages(text, bigint[])
  TO service_role;

NOTIFY pgrst, 'reload schema';
