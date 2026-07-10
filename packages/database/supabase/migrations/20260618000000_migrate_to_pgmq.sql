-- Enable pgmq extension
create extension if not exists pgmq cascade;

-- Create media_queue queue
select pgmq.create('media_queue');

-- Helper to enqueue a fetch request
create or replace function public.enqueue_media_fetch(
  p_tmdb_id int,
  p_media_type text,
  p_season_number int default null,
  p_episode_number int default null
)
returns bigint
language plpgsql
security definer
as $$
declare
  v_msg_id bigint;
begin
  -- Check if already enqueued in the active queue
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
      'user_id', auth.uid()
    )
  );
  
  return v_msg_id;
end;
$$;

-- Helper to get status of a media fetch request
create or replace function public.get_media_queue_status(
  p_tmdb_id int,
  p_media_type text,
  p_season_number int default null,
  p_episode_number int default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_status text;
  v_error text := null;
  v_record record;
begin
  -- Check active queue first
  select * into v_record 
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
  order by msg_id desc
  limit 1;

  if found then
    if v_record.vt > now() then
      v_status := 'processing';
    else
      v_status := 'pending';
    end if;
  else
    -- Check archive table
    select * into v_record 
    from pgmq.a_media_queue 
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
    order by msg_id desc
    limit 1;

    if found then
      -- If the archived message has a recorded error inside its payload
      if v_record.message ? 'error' then
        v_status := 'failed';
        v_error := v_record.message->>'error';
      else
        v_status := 'completed';
      end if;
    else
      v_status := null;
    end if;
  end if;

  if v_status is null then
    return null;
  end if;

  return jsonb_build_object('status', v_status, 'error_message', v_error);
end;
$$;

-- Helper to pop a message from queue
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

-- Helper to archive message upon success
create or replace function public.archive_media_queue_message(p_msg_id bigint)
returns boolean
language plpgsql
security definer
as $$
begin
  return pgmq.archive('media_queue', p_msg_id);
end;
$$;

-- Helper to archive message upon failure and save error log
create or replace function public.archive_media_queue_message_with_error(p_msg_id bigint, p_error text)
returns boolean
language plpgsql
security definer
as $$
begin
  -- Archive the message first
  perform pgmq.archive('media_queue', p_msg_id);
  -- Update the archived message to include the error property
  update pgmq.a_media_queue 
  set message = message || jsonb_build_object('error', p_error)
  where msg_id = p_msg_id;
  return true;
end;
$$;

-- Helper to retrieve all active and archived queue items for the Admin UI
create or replace function public.get_media_queue_items()
returns table (
  id bigint,
  tmdb_id int,
  media_type text,
  season_number int,
  episode_number int,
  status text,
  error_message text,
  user_id uuid,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
language plpgsql
security definer
as $$
begin
  return query
  -- Active items
  select 
    msg_id as id,
    (message->>'tmdb_id')::int as tmdb_id,
    message->>'media_type' as media_type,
    (message->>'season_number')::int as season_number,
    (message->>'episode_number')::int as episode_number,
    case when vt > now() then 'processing'::text else 'pending'::text end as status,
    null::text as error_message,
    (message->>'user_id')::uuid as user_id,
    enqueued_at as created_at,
    vt as updated_at
  from pgmq.q_media_queue
  union all
  -- Archived items
  select 
    msg_id as id,
    (message->>'tmdb_id')::int as tmdb_id,
    message->>'media_type' as media_type,
    (message->>'season_number')::int as season_number,
    (message->>'episode_number')::int as episode_number,
    case when message ? 'error' then 'failed'::text else 'completed'::text end as status,
    message->>'error' as error_message,
    (message->>'user_id')::uuid as user_id,
    enqueued_at as created_at,
    vt as updated_at
  from pgmq.a_media_queue
  order by created_at desc;
end;
$$;

-- Helper to delete an active or archived queue item
create or replace function public.delete_media_queue_item(p_id bigint)
returns boolean
language plpgsql
security definer
as $$
begin
  -- Try to delete from active queue
  perform pgmq.delete('media_queue', p_id);
  -- Also delete from archive
  delete from pgmq.a_media_queue where msg_id = p_id;
  return true;
end;
$$;
