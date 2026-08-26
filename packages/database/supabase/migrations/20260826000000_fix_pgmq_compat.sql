-- Fix pgmq compatibility after extension upgrade
-- pgmq 1.5+ adds a headers column to queue tables and read() returns 6 cols

-- 1. Add headers column to the queue table if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'pgmq' AND table_name = 'q_media_queue' AND column_name = 'headers'
  ) THEN
    ALTER TABLE pgmq.q_media_queue ADD COLUMN headers jsonb DEFAULT '{}';
  END IF;
END $$;

-- 2. Fix enqueue_media_fetch to pass headers param to pgmq.send
CREATE OR REPLACE FUNCTION public.enqueue_media_fetch(
  p_tmdb_id int,
  p_media_type text,
  p_season_number int default null,
  p_episode_number int default null,
  p_language text default null
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_msg_id bigint;
BEGIN
  -- Check if already enqueued in the active queue (including language for dedup)
  IF EXISTS (
    SELECT 1 
    FROM pgmq.q_media_queue 
    WHERE (message->>'tmdb_id')::int = p_tmdb_id 
      AND message->>'media_type' = p_media_type
      AND (
        (p_season_number IS NULL AND message->>'season_number' IS NULL)
        OR (message->>'season_number')::int = p_season_number
      )
      AND (
        (p_episode_number IS NULL AND message->>'episode_number' IS NULL)
        OR (message->>'episode_number')::int = p_episode_number
      )
      AND (
        (p_language IS NULL AND message->>'language' IS NULL)
        OR message->>'language' = p_language
      )
  ) THEN
    RAISE EXCEPTION 'Request is already in the queue';
  END IF;

  v_msg_id := pgmq.send(
    'media_queue',
    jsonb_build_object(
      'tmdb_id', p_tmdb_id,
      'media_type', p_media_type,
      'season_number', p_season_number,
      'episode_number', p_episode_number,
      'language', p_language,
      'user_id', auth.uid()
    ),
    '{}'::jsonb
  );
  
  RETURN v_msg_id;
END;
$$;

-- 3. Fix pop_media_queue_message to handle 6-column read() output
CREATE OR REPLACE FUNCTION public.pop_media_queue_message(p_vt_seconds int default 30)
RETURNS TABLE (
  msg_id bigint,
  read_ct int,
  enqueued_at timestamp with time zone,
  vt timestamp with time zone,
  message jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.msg_id,
    r.read_ct,
    r.enqueued_at,
    r.vt,
    r.message
  FROM pgmq.read('media_queue', p_vt_seconds, 1) r;
END;
$$;
