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
  v_archive_mutated boolean := false;
  v_duplicate_blocked boolean := false;
  v_constraint_name text;
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

  IF EXISTS (SELECT 1 FROM pgmq.q_wiki_extract WHERE message->>'tmdb_id' = '-1492640')
    OR EXISTS (SELECT 1 FROM public.dubbing_projects WHERE content_id = -11492640) THEN
    RAISE EXCEPTION 'Synthetic extract or project uniqueness fixture IDs are already present';
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

  CREATE TEMP TABLE legacy_review_archive_snapshot AS
    SELECT msg_id, message
    FROM pgmq.a_wiki_check
    WHERE message->>'review_needed' = 'true'
      AND (message->>'tmdb_id')::bigint = ANY (ARRAY[1492640, 284558, 977942, 1248832]::bigint[]);

  CREATE TEMP TABLE legacy_review_first_results AS
    SELECT * FROM public.reprocess_legacy_wiki_check_reviews();

  IF (SELECT count(*) FROM legacy_review_first_results) <> 4 THEN
    RAISE EXCEPTION 'Expected one outcome per legacy review item';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM legacy_review_first_results AS result
    LEFT JOIN public.legacy_wiki_check_reprocesses AS ledger
      ON ledger.archived_msg_id = result.archived_msg_id
    WHERE result.queued_msg_id IS NULL
      OR result.queued_msg_id IS DISTINCT FROM ledger.queued_msg_id
  ) THEN
    RAISE EXCEPTION 'Reprocess RPC did not return the queue ID recorded for every archived item';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM legacy_review_first_results
    WHERE tmdb_id = 1492640
      AND outcome = 'already_enqueued'
      AND queued_msg_id = v_existing_check_id
  ) THEN
    RAISE EXCEPTION 'Reprocess RPC did not return the existing active check queue ID';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.legacy_wiki_check_reprocesses
    WHERE tmdb_id = 1492640
      AND outcome = 'already_enqueued'
      AND queued_msg_id = v_existing_check_id
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

  CREATE TEMP TABLE legacy_review_repeat_results AS
    SELECT * FROM public.reprocess_legacy_wiki_check_reviews();

  IF (SELECT count(*) FROM legacy_review_repeat_results WHERE outcome = 'already_reprocessed') <> 4 THEN
    RAISE EXCEPTION 'Repeated operation did not return the idempotent outcome';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM legacy_review_repeat_results AS result
    LEFT JOIN public.legacy_wiki_check_reprocesses AS ledger
      ON ledger.archived_msg_id = result.archived_msg_id
    WHERE result.queued_msg_id IS NULL
      OR result.queued_msg_id IS DISTINCT FROM ledger.queued_msg_id
  ) THEN
    RAISE EXCEPTION 'Repeated reprocess RPC did not return the original queue IDs';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM legacy_review_archive_snapshot AS s
    FULL JOIN pgmq.a_wiki_check AS a USING (msg_id)
    WHERE s.message IS DISTINCT FROM a.message
  ) THEN
    v_archive_mutated := true;
  END IF;

  IF v_archive_mutated THEN
    RAISE EXCEPTION 'Archived legacy payload was changed by reprocessing';
  END IF;

  IF (SELECT count(*) FROM public.legacy_wiki_check_reprocesses
      WHERE tmdb_id = ANY (ARRAY[1492640, 284558, 977942, 1248832]::bigint[])) <> 4 THEN
    RAISE EXCEPTION 'Expected one separate ledger entry per archived legacy item';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.dubbing_projects'::regclass
      AND conname = 'dubbing_projects_media_region_key'
      AND contype = 'u'
  ) THEN
    RAISE EXCEPTION 'Authoritative media+region project uniqueness constraint is missing';
  END IF;

  INSERT INTO public.dubbing_projects(content_id, content_type, language)
  VALUES (-11492640, 'movie', 'fr-FR');

  BEGIN
    INSERT INTO public.dubbing_projects(content_id, content_type, language)
    VALUES (-11492640, 'movie', 'fr-FR');
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;
    IF v_constraint_name <> 'dubbing_projects_media_region_key' THEN
      RAISE EXCEPTION 'Duplicate project was rejected by unexpected constraint %', v_constraint_name;
    END IF;
    v_duplicate_blocked := true;
  END;

  IF NOT v_duplicate_blocked THEN
    RAISE EXCEPTION 'The database allowed a duplicate project for the same media and region';
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

  v_duplicate_blocked := false;
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
