-- Fix pgmq archive table headers column compatibility
-- When pgmq 1.5+ was upgraded, q_media_queue received the headers column, but a_media_queue did not.
-- This caused pgmq.archive('media_queue', msg_id) to fail silently on INSERT INTO a_media_queue,
-- preventing messages from ever being removed from the active queue.

-- 1. Ensure headers column exists on BOTH q_media_queue and a_media_queue
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'pgmq' AND table_name = 'q_media_queue' AND column_name = 'headers'
  ) THEN
    ALTER TABLE pgmq.q_media_queue ADD COLUMN headers jsonb DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'pgmq' AND table_name = 'a_media_queue' AND column_name = 'headers'
  ) THEN
    ALTER TABLE pgmq.a_media_queue ADD COLUMN headers jsonb DEFAULT '{}';
  END IF;
END $$;

-- 2. Resilient archive_media_queue_message helper with fallback
CREATE OR REPLACE FUNCTION public.archive_media_queue_message(p_msg_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_archived boolean;
BEGIN
  BEGIN
    v_archived := pgmq.archive('media_queue', p_msg_id);
  EXCEPTION WHEN OTHERS THEN
    -- Fallback manual archive if internal pgmq function encounters column or schema mismatch
    WITH deleted AS (
      DELETE FROM pgmq.q_media_queue WHERE msg_id = p_msg_id RETURNING *
    )
    INSERT INTO pgmq.a_media_queue (msg_id, read_ct, enqueued_at, vt, message, headers)
    SELECT d.msg_id, d.read_ct, d.enqueued_at, d.vt, d.message, coalesce(d.headers, '{}'::jsonb)
    FROM deleted d;
    v_archived := true;
  END;

  RETURN coalesce(v_archived, true);
END;
$$;

-- 3. Resilient archive_media_queue_message_with_error helper
CREATE OR REPLACE FUNCTION public.archive_media_queue_message_with_error(p_msg_id bigint, p_error text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Archive the message first
  PERFORM public.archive_media_queue_message(p_msg_id);
  -- Update the archived message to include the error property
  UPDATE pgmq.a_media_queue 
  SET message = message || jsonb_build_object('error', p_error)
  WHERE msg_id = p_msg_id;
  RETURN true;
END;
$$;
