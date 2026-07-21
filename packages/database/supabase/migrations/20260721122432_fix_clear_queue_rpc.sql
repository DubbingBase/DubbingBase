-- Helper to clear the entire queue (active and archived)
create or replace function public.clear_media_queue()
returns boolean
language plpgsql
security definer
as $$
begin
  delete from pgmq.q_media_queue where true;
  delete from pgmq.a_media_queue where true;
  return true;
end;
$$;
