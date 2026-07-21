-- Helper to get the number of active (non-locked) messages in the media_queue.
-- Used by process-media-queue to decide whether to self-trigger another invocation.
create or replace function public.get_media_queue_depth()
returns bigint
language sql
security definer
stable
as $$
  select count(*)
  from pgmq.q_media_queue
  where vt <= now(); -- Only count visible (not currently locked) messages
$$;
