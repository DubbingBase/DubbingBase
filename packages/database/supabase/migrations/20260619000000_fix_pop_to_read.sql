-- Fix pop_media_queue_message: pgmq.pop() only takes queue_name, not a VT parameter.
-- Switch to pgmq.read() which supports a visibility timeout and provides at-least-once
-- delivery semantics, matching the archive-on-success pattern used by the processor.
create or replace function public.pop_media_queue_message(p_vt_seconds int default 30)
returns table (
  msg_id bigint,
  read_ct int,
  enqueued_at timestamp with time zone,
  vt timestamp with time zone,
  message jsonb
)
language plpgsql
security definer
as $$
begin
  -- pgmq.read(queue_name, vt, qty) - read 1 message with a visibility timeout
  return query select * from pgmq.read('media_queue', p_vt_seconds, 1);
end;
$$;
