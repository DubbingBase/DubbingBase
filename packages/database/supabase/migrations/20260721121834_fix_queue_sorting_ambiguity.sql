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
  select * from (
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
  ) q
  order by 
    case 
      when q.status = 'processing' then 1
      when q.status = 'pending' then 2
      else 3
    end asc,
    q.id asc;
end;
$$;
