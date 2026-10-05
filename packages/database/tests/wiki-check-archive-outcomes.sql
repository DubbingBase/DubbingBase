-- Run after the wiki_check outcome and regional-review removal migrations.
-- Archive outcome metadata is preserved with the PGMQ diagnostic payload.
\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
  message_id bigint;
  requester_id uuid := '11111111-1111-4111-8111-111111111111';
BEGIN
  IF to_regprocedure('public.archive_wiki_check_for_regional_review(bigint,text)') IS NOT NULL
    OR to_regprocedure('public.resume_wiki_check_for_regional_review(bigint,text)') IS NOT NULL
    OR to_regprocedure('public.get_regional_review_queue_items(integer)') IS NOT NULL
    OR to_regprocedure('public.get_regional_review_queue_items(integer,integer)') IS NOT NULL THEN
    RAISE EXCEPTION 'The removed regional queue workflow is still installed';
  END IF;

  message_id := public.enqueue_media_fetch(
    p_tmdb_id => -980301,
    p_media_type => 'movie',
    p_wikipedia_language => 'en',
    p_requested_by => requester_id
  );

  IF NOT public.archive_wiki_check_with_outcome(
    message_id,
    'ambiguous_region',
    'Dubbing evidence did not identify a supported market.',
    '[]'::jsonb,
    '[{"index":3,"heading":"Distribution","heading_kind":"generic_cast"}]'::jsonb
  ) THEN
    RAISE EXCEPTION 'Could not archive wiki_check with its outcome metadata';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pgmq.a_wiki_check
    WHERE msg_id = message_id
      AND message->>'archive_reason' = 'ambiguous_region'
      AND message->>'archive_details' = 'Dubbing evidence did not identify a supported market.'
      AND message->'detected_regions' = '[]'::jsonb
      AND message->'candidate_sections' = '[{"index":3,"heading":"Distribution","heading_kind":"generic_cast"}]'::jsonb
      AND message->>'requested_by' = requester_id::text
      AND message->>'wikipedia_language' = 'en'
  ) THEN
    RAISE EXCEPTION 'Archived queue outcome, diagnostics, or provenance were lost';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.get_media_queue_items('wiki_check', 'archived', 100, 0)
    WHERE id = message_id AND requested_by = requester_id
  ) THEN
    RAISE EXCEPTION 'The archived wiki_check is missing from the standard admin queue';
  END IF;
END;
$$;

ROLLBACK;
