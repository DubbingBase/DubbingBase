BEGIN;

SELECT pgmq.send('wiki_discovery', '{"tmdb_id":991234569,"media_type":"movie"}'::jsonb);

DO $$
DECLARE
  v_ready_queues text[];
BEGIN
  IF has_function_privilege('anon', 'public.get_ready_media_queues()', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.get_ready_media_queues()', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.get_ready_media_queues()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Queue readiness RPC permissions are not service-role only';
  END IF;

  v_ready_queues := public.get_ready_media_queues();
  IF NOT ('wiki_discovery' = ANY(v_ready_queues)) THEN
    RAISE EXCEPTION 'Visible discovery messages were not reported ready: %', v_ready_queues;
  END IF;
END;
$$;

ROLLBACK;
