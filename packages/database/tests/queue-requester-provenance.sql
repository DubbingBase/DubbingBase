-- Run after the regional review queue migrations and requester provenance migration.
-- This fixture exercises the enqueue/resume RPCs with local-only queue data.
BEGIN;

DO $$
DECLARE
  requester_id uuid := '11111111-1111-4111-8111-111111111111';
  check_id bigint;
  extract_id bigint;
  discovery_id bigint;
BEGIN
  IF has_function_privilege('anon', 'public.get_media_queue_items(text,text,integer,integer)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.get_media_queue_items(text,text,integer,integer)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.get_regional_review_queue_items(integer,integer)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.get_regional_review_queue_items(integer,integer)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.get_media_queue_stats()', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.get_media_queue_stats()', 'EXECUTE') THEN
    RAISE EXCEPTION 'A non-admin database role can execute a requester-bearing queue read RPC';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.get_media_queue_items(text,text,integer,integer)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.get_regional_review_queue_items(integer,integer)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.get_media_queue_stats()', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.enqueue_media_fetch(bigint,text,integer,integer,text,boolean,text,text,uuid)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.enqueue_media_extract(bigint,text,text,bigint,jsonb,integer,integer,boolean,text,text,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'The service-role queue API grants are incomplete';
  END IF;

  IF has_function_privilege('anon', 'public.enqueue_media_fetch(bigint,text,integer,integer,text,boolean,text,text,uuid)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.enqueue_media_fetch(bigint,text,integer,integer,text,boolean,text,text,uuid)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.enqueue_media_extract(bigint,text,text,bigint,jsonb,integer,integer,boolean,text,text,uuid)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.enqueue_media_extract(bigint,text,text,bigint,jsonb,integer,integer,boolean,text,text,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'A public database role can execute a service-role enqueue RPC';
  END IF;

  check_id := public.enqueue_media_fetch(
    p_tmdb_id => -980201,
    p_media_type => 'movie',
    p_language => 'simple',
    p_wikipedia_language => 'simple',
    p_requested_by => requester_id
  );
  IF NOT EXISTS (
    SELECT 1 FROM pgmq.q_wiki_check
    WHERE msg_id = check_id AND message->>'requested_by' = requester_id::text
  ) THEN
    RAISE EXCEPTION 'Initial check enqueue lost its original requester';
  END IF;

  IF NOT public.archive_wiki_check_for_regional_review(check_id, 'Choose a dubbing region.') THEN
    RAISE EXCEPTION 'Could not put the source-only check into regional review';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.get_regional_review_queue_items(100, 0)
    WHERE id = check_id AND requested_by = requester_id
  ) THEN
    RAISE EXCEPTION 'Review-needed state lost its original requester';
  END IF;

  IF NOT public.resume_wiki_check_for_regional_review(check_id, 'en-US') THEN
    RAISE EXCEPTION 'Could not resume review with a regional dubbing target';
  END IF;
  IF EXISTS (SELECT 1 FROM pgmq.a_wiki_check WHERE msg_id = check_id) THEN
    RAISE EXCEPTION 'Successfully resumed review was not removed from the archive';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pgmq.q_wiki_check
    WHERE message->>'tmdb_id' = '-980201'
      AND message->>'wikipedia_language' = 'simple'
      AND message->>'dubbing_language' = 'en-US'
      AND message->>'requested_by' = requester_id::text
  ) THEN
    RAISE EXCEPTION 'Review resume changed or lost the original requester';
  END IF;

  check_id := public.enqueue_media_fetch(
    p_tmdb_id => -980204,
    p_media_type => 'movie',
    p_language => 'simple'
  );
  IF NOT public.archive_wiki_check_for_regional_review(check_id, 'Choose a dubbing region.') THEN
    RAISE EXCEPTION 'Could not archive a review item without a requester';
  END IF;
  IF NOT public.resume_wiki_check_for_regional_review(check_id, 'fr-FR') THEN
    RAISE EXCEPTION 'Could not resume a review item without a requester';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pgmq.q_wiki_check
    WHERE message->>'tmdb_id' = '-980204'
      AND message->>'dubbing_language' = 'fr-FR'
      AND message->>'requested_by' IS NULL
  ) THEN
    RAISE EXCEPTION 'Resume invented a requester for an anonymous queue item';
  END IF;

  extract_id := public.enqueue_media_extract(
    p_tmdb_id => -980202,
    p_media_type => 'movie',
    p_language => 'simple',
    p_page_id => 2,
    p_section_indexes => '[1]'::jsonb,
    p_wikipedia_language => 'simple',
    p_dubbing_language => 'en-US',
    p_requested_by => requester_id
  );
  IF NOT EXISTS (
    SELECT 1 FROM pgmq.q_wiki_extract
    WHERE msg_id = extract_id
      AND message->>'wikipedia_language' = 'simple'
      AND message->>'dubbing_language' = 'en-US'
      AND message->>'requested_by' = requester_id::text
  ) THEN
    RAISE EXCEPTION 'Extract enqueue lost the original requester or source/target distinction';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.get_media_queue_items('wiki_extract', 'active', 100, 0)
    WHERE id = extract_id
      AND requested_by = requester_id
      AND wikipedia_language = 'simple'
      AND dubbing_language = 'en-US'
  ) THEN
    RAISE EXCEPTION 'The admin queue read RPC lost the extract requester or regional target';
  END IF;

  discovery_id := public.enqueue_media_fetch(
    p_tmdb_id => -980203,
    p_media_type => 'movie'
  );
  IF NOT EXISTS (
    SELECT 1 FROM pgmq.q_wiki_discovery
    WHERE msg_id = discovery_id AND message->>'requested_by' IS NULL
  ) THEN
    RAISE EXCEPTION 'A discovery with no requester did not stay anonymous';
  END IF;
END;
$$;

ROLLBACK;
