-- Run after the legacy review workflow and reprocessor migrations.
\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
  v_target_id bigint;
  v_msg_id bigint;
  v_existing_check_id bigint;
  v_extract_msg_id bigint;
  v_requested_by uuid := '11111111-1111-4111-8111-111111111111';
  v_duplicate_blocked boolean := false;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pgmq.a_wiki_check
    WHERE message->>'review_needed' = 'true'
      AND (message->>'tmdb_id')::bigint = ANY (ARRAY[1492640, 284558, 977942, 1248832]::bigint[])
  ) THEN
    RAISE EXCEPTION 'Legacy review fixture IDs are already present';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pgmq.q_wiki_check
    WHERE (message->>'tmdb_id')::bigint = ANY (ARRAY[1492640, 284558, 977942, 1248832]::bigint[])
  ) THEN
    RAISE EXCEPTION 'Legacy review fixture IDs already have active wiki_check jobs';
  END IF;

  FOREACH v_target_id IN ARRAY ARRAY[1492640, 284558, 977942, 1248832]::bigint[] LOOP
    v_msg_id := public.enqueue_media_fetch(
      p_tmdb_id => v_target_id,
      p_media_type => 'movie',
      p_wikipedia_language => 'en',
      p_requested_by => v_requested_by
    );

    IF NOT public.archive_media_queue_message('wiki_check', v_msg_id) THEN
      RAISE EXCEPTION 'Could not archive legacy review fixture %', v_target_id;
    END IF;

    UPDATE pgmq.a_wiki_check
    SET message = message || jsonb_build_object(
      'review_needed', true,
      'review_note', 'Fixture for idempotent legacy reprocessing'
    )
    WHERE msg_id = v_msg_id;
  END LOOP;

  -- A pre-existing active job must be retained without adding a second one.
  v_existing_check_id := public.enqueue_media_fetch(
    p_tmdb_id => 1492640,
    p_media_type => 'movie',
    p_wikipedia_language => 'en'
  );

  IF (SELECT count(*) FROM public.reprocess_legacy_wiki_check_reviews()) <> 4 THEN
    RAISE EXCEPTION 'Expected one outcome per legacy review item';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pgmq.a_wiki_check
    WHERE message->>'tmdb_id' = '1492640'
      AND message->'legacy_review_reprocess'->>'outcome' = 'already_enqueued'
      AND message->'legacy_review_reprocess'->>'queued_msg_id' = v_existing_check_id::text
  ) THEN
    RAISE EXCEPTION 'Existing active check was not recorded as already_enqueued';
  END IF;

  IF (SELECT count(*) FROM pgmq.q_wiki_check WHERE (message->>'tmdb_id')::bigint = 1492640) <> 1 THEN
    RAISE EXCEPTION 'Reprocessing duplicated the already-active wiki_check job';
  END IF;

  IF (SELECT count(*) FROM pgmq.q_wiki_check WHERE (message->>'tmdb_id')::bigint = ANY (ARRAY[284558, 977942, 1248832]::bigint[])) <> 3 THEN
    RAISE EXCEPTION 'Expected the other three legacy IDs to be requeued';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pgmq.q_wiki_check
    WHERE (message->>'tmdb_id')::bigint = ANY (ARRAY[284558, 977942, 1248832]::bigint[])
      AND message->>'requested_by' IS DISTINCT FROM v_requested_by::text
  ) THEN
    RAISE EXCEPTION 'The original requester was not preserved on requeued items';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pgmq.q_wiki_check
    WHERE (message->>'tmdb_id')::bigint = ANY (ARRAY[284558, 977942, 1248832]::bigint[])
      AND message->'dubbing_language' IS DISTINCT FROM 'null'::jsonb
  ) THEN
    RAISE EXCEPTION 'Requeued item was forced to a dubbing region';
  END IF;

  IF (SELECT count(*) FROM public.reprocess_legacy_wiki_check_reviews() WHERE outcome = 'already_reprocessed') <> 4 THEN
    RAISE EXCEPTION 'Repeated operation did not return the idempotent outcome';
  END IF;

  IF (SELECT count(*) FROM pgmq.a_wiki_check WHERE message->>'review_needed' = 'true'
        AND message ? 'legacy_review_reprocess'
        AND (message->>'tmdb_id')::bigint = ANY (ARRAY[1492640, 284558, 977942, 1248832]::bigint[])) <> 4 THEN
    RAISE EXCEPTION 'Archived legacy history was deleted or lost its marker';
  END IF;

  v_extract_msg_id := public.enqueue_media_extract(
    p_tmdb_id => -1492640,
    p_media_type => 'movie',
    p_language => 'fr',
    p_page_id => 987654,
    p_section_indexes => '[3]'::jsonb,
    p_wikipedia_language => 'fr',
    p_dubbing_language => 'fr-FR'
  );

  BEGIN
    PERFORM public.enqueue_media_extract(
      p_tmdb_id => -1492640,
      p_media_type => 'movie',
      p_language => 'fr',
      p_page_id => 987654,
      p_section_indexes => '[3]'::jsonb,
      p_wikipedia_language => 'fr',
      p_dubbing_language => 'fr-FR'
    );
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Item is already in the extract queue' THEN
      RAISE;
    END IF;
    v_duplicate_blocked := true;
  END;

  IF NOT v_duplicate_blocked THEN
    RAISE EXCEPTION 'The normal extraction RPC allowed a duplicate active extract job';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pgmq.q_wiki_extract WHERE msg_id = v_extract_msg_id) THEN
    RAISE EXCEPTION 'The original extraction job was not preserved';
  END IF;
END;
$$;

ROLLBACK;
