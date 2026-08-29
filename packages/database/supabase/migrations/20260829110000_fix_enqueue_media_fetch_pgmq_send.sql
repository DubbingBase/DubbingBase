-- Fix enqueue_media_fetch pgmq.send invocation
-- pgmq.send signature is pgmq.send(queue_name text, msg jsonb, delay integer default 0)
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
    )
  );
  
  RETURN v_msg_id;
END;
$$;
