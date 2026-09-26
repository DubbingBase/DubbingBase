-- Run against an isolated database after
-- 20260926092722_enforce_regional_dubbing_languages.sql,
-- 20260926094824_preserve_dubbing_review_dependencies.sql,
-- 20260926130158_map_legacy_dubbing_project_regions.sql, and
-- 20260926174115_queue_regional_review_resume.sql.
-- Fixtures and queue transitions are rolled back.
BEGIN;
SET LOCAL statement_timeout = '30s';

DO $$
DECLARE
  message_id bigint;
  discovery_id bigint;
  extract_id bigint;
BEGIN
  -- Source-only queue work reaches wiki_check and becomes an explicit review item.
  message_id := public.enqueue_media_fetch(
    p_tmdb_id => 980101,
    p_media_type => 'tv',
    p_language => 'simple'
  );
  IF NOT EXISTS (
    SELECT 1 FROM pgmq.q_wiki_check
    WHERE msg_id = message_id
      AND message->>'wikipedia_language' = 'simple'
      AND message->>'dubbing_language' IS NULL
  ) THEN
    RAISE EXCEPTION 'Source-only check did not preserve Wikipedia language separately';
  END IF;

  IF NOT public.archive_wiki_check_for_regional_review(
    message_id,
    'Dubbing sections found; regional selection required.'
  ) THEN
    RAISE EXCEPTION 'Source-only check was not archived for review';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.get_regional_review_queue_items()
    WHERE id = message_id
      AND status = 'review_needed'
      AND wikipedia_language = 'simple'
      AND dubbing_language IS NULL
      AND review_note LIKE '%regional selection required%'
  ) THEN
    RAISE EXCEPTION 'Review-needed state or source/target separation was lost';
  END IF;

  IF NOT public.resume_wiki_check_for_regional_review(message_id, 'fr-FR') THEN
    RAISE EXCEPTION 'Regional review did not resume';
  END IF;
  IF EXISTS (SELECT 1 FROM pgmq.a_wiki_check WHERE msg_id = message_id) THEN
    RAISE EXCEPTION 'Resumed review item was not removed from its archive';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pgmq.q_wiki_check
    WHERE message->>'tmdb_id' = '980101'
      AND message->>'wikipedia_language' = 'simple'
      AND message->>'dubbing_language' = 'fr-FR'
  ) THEN
    RAISE EXCEPTION 'Resumed item did not restart wiki_check with the chosen region';
  END IF;

  -- Discovery may preserve a target without inventing a Wikipedia source.
  discovery_id := public.enqueue_media_fetch(
    p_tmdb_id => 980102,
    p_media_type => 'movie',
    p_dubbing_language => 'fr-CA'
  );
  IF NOT EXISTS (
    SELECT 1 FROM pgmq.q_wiki_discovery
    WHERE msg_id = discovery_id
      AND message->>'wikipedia_language' IS NULL
      AND message->>'dubbing_language' = 'fr-CA'
  ) THEN
    RAISE EXCEPTION 'Discovery did not preserve the regional target independently';
  END IF;

  -- Same Wikipedia edition plus distinct regional targets is distinct queue work.
  PERFORM public.enqueue_media_fetch(
    p_tmdb_id => 980103,
    p_media_type => 'movie',
    p_wikipedia_language => 'fr',
    p_dubbing_language => 'fr-FR'
  );
  PERFORM public.enqueue_media_fetch(
    p_tmdb_id => 980103,
    p_media_type => 'movie',
    p_wikipedia_language => 'fr',
    p_dubbing_language => 'fr-CA'
  );
  IF (
    SELECT count(*) FROM pgmq.q_wiki_check
    WHERE message->>'tmdb_id' = '980103'
      AND message->>'wikipedia_language' = 'fr'
      AND message->>'dubbing_language' IN ('fr-FR', 'fr-CA')
  ) <> 2 THEN
    RAISE EXCEPTION 'Queue collapsed distinct regional targets for one source';
  END IF;

  BEGIN
    PERFORM public.enqueue_media_extract(
      p_tmdb_id => 980104,
      p_media_type => 'movie',
      p_language => 'simple',
      p_page_id => 1,
      p_section_indexes => '[1]'::jsonb
    );
    RAISE EXCEPTION 'Extract accepted a missing regional target';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%regional dubbing language%' THEN RAISE; END IF;
  END;

  extract_id := public.enqueue_media_extract(
    p_tmdb_id => 980105,
    p_media_type => 'movie',
    p_language => 'simple',
    p_page_id => 2,
    p_section_indexes => '[1]'::jsonb,
    p_wikipedia_language => 'simple',
    p_dubbing_language => 'en-US'
  );
  IF NOT EXISTS (
    SELECT 1 FROM pgmq.q_wiki_extract
    WHERE msg_id = extract_id
      AND message->>'wikipedia_language' = 'simple'
      AND message->>'dubbing_language' = 'en-US'
  ) THEN
    RAISE EXCEPTION 'Valid source and target were not accepted by extract';
  END IF;
END;
$$;

ROLLBACK;
