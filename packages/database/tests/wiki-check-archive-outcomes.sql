-- Run after the wiki_check outcome and legacy queue workflow removal migrations.
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
    RAISE EXCEPTION 'Retired queue RPCs are still installed';
  END IF;

  message_id := pgmq.send('wiki_check', jsonb_build_object(
    'tmdb_id', -980301, 'media_type', 'movie', 'wikipedia_language', 'en',
    'language', 'en', 'requested_by', requester_id
  ));

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
    WHERE id = message_id
      AND requested_by = requester_id
      AND archive_reason = 'ambiguous_region'
      AND archive_details = 'Dubbing evidence did not identify a supported market.'
      AND detected_regions = '[]'::jsonb
      AND candidate_sections = '[{"index":3,"heading":"Distribution","heading_kind":"generic_cast"}]'::jsonb
  ) THEN
    RAISE EXCEPTION 'The archived wiki_check outcome is missing from the standard admin queue';
  END IF;

  IF public.archive_media_queue_message_with_error(
    'wiki_check',
    message_id,
    'stale worker error'
  ) THEN
    RAISE EXCEPTION 'A stale worker reported an already archived message as newly archived';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pgmq.a_wiki_check
    WHERE msg_id = message_id
      AND message->>'archive_reason' = 'ambiguous_region'
      AND message->>'error_message' IS NULL
  ) THEN
    RAISE EXCEPTION 'A stale worker overwrote finalized wiki_check outcome metadata';
  END IF;

  IF public.archive_media_queue_message('wiki_check', -980302) THEN
    RAISE EXCEPTION 'Archiving a missing queue message reported success';
  END IF;
END;
$$;

ROLLBACK;
