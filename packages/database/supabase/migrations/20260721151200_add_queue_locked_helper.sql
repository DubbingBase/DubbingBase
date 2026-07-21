-- Used by process-media-queue to check for running workers (Option A Watchdog)
create or replace function public.get_media_queue_locked_count()
returns int
language plpgsql
security definer
as $$
declare
  v_count int;
begin
  select count(*) into v_count
  from pgmq.q_media_queue
  where vt > now();
  
  return v_count;
end;
$$;
