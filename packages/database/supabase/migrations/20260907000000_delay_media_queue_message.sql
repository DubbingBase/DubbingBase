-- Migration: 20260907000000_delay_media_queue_message.sql
-- Description: RPC to postpone a queued message's visibility timeout (e.g. 1h on
--   LLM quota exhaustion). The app cannot UPDATE pgmq.q_* directly via PostgREST
--   (pgmq schema is not exposed), so the previous client-side vt update silently
--   failed and quota-delayed messages were re-popped every minute.

CREATE OR REPLACE FUNCTION public.delay_media_queue_message(
  p_queue_name text,
  p_msg_id bigint,
  p_delay_seconds int default 3600
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_vt timestamptz := clock_timestamp() + (COALESCE(p_delay_seconds, 3600) || ' seconds')::interval;
BEGIN
  IF p_queue_name NOT IN ('wiki_extract', 'wiki_check', 'wiki_discovery') THEN
    RAISE EXCEPTION 'Invalid queue name: %', p_queue_name;
  END IF;

  IF p_queue_name = 'wiki_extract' THEN
    UPDATE pgmq.q_wiki_extract SET vt = v_vt WHERE msg_id = p_msg_id;
  ELSIF p_queue_name = 'wiki_check' THEN
    UPDATE pgmq.q_wiki_check SET vt = v_vt WHERE msg_id = p_msg_id;
  ELSE
    UPDATE pgmq.q_wiki_discovery SET vt = v_vt WHERE msg_id = p_msg_id;
  END IF;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delay_media_queue_message(text, bigint, int) TO authenticated, anon, service_role;
