CREATE OR REPLACE FUNCTION public.get_ready_media_queues()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(array_agg(queues.queue_name ORDER BY queues.ordinal), ARRAY[]::text[])
  FROM (VALUES
    (1, 'wiki_discovery'::text, EXISTS (
      SELECT 1 FROM pgmq.q_wiki_discovery WHERE vt <= statement_timestamp()
    )),
    (2, 'wiki_check'::text, EXISTS (
      SELECT 1 FROM pgmq.q_wiki_check WHERE vt <= statement_timestamp()
    )),
    (3, 'wiki_extract'::text, EXISTS (
      SELECT 1 FROM pgmq.q_wiki_extract WHERE vt <= statement_timestamp()
    ))
  ) AS queues(ordinal, queue_name, ready)
  WHERE queues.ready;
$$;

REVOKE ALL ON FUNCTION public.get_ready_media_queues() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ready_media_queues() TO service_role;

NOTIFY pgrst, 'reload schema';
