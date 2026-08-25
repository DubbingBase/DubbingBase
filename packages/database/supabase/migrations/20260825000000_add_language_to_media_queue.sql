-- Add language support to media queue for per-language Wikipedia parsing
-- This migration updates enqueue_media_fetch to accept an optional language parameter

-- Drop the existing function first (required to change parameter list)
drop function if exists public.enqueue_media_fetch(int, text, int, int);

-- Re-create with language parameter
create or replace function public.enqueue_media_fetch(
  p_tmdb_id int,
  p_media_type text,
  p_season_number int default null,
  p_episode_number int default null,
  p_language text default null
)
returns bigint
language plpgsql
security definer
as $$
declare
  v_msg_id bigint;
begin
  -- Check if already enqueued in the active queue (including language for dedup)
  if exists (
    select 1 
    from pgmq.q_media_queue 
    where (message->>'tmdb_id')::int = p_tmdb_id 
      and message->>'media_type' = p_media_type
      and (
        (p_season_number is null and message->>'season_number' is null)
        or (message->>'season_number')::int = p_season_number
      )
      and (
        (p_episode_number is null and message->>'episode_number' is null)
        or (message->>'episode_number')::int = p_episode_number
      )
      and (
        (p_language is null and message->>'language' is null)
        or message->>'language' = p_language
      )
  ) then
    raise exception 'Request is already in the queue';
  end if;

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
  
  return v_msg_id;
end;
$$;
