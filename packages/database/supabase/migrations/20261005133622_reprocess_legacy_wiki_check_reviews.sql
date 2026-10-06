-- Reprocess the four legacy regional-review items through the normal
-- wiki_check queue. The archived messages remain as history and receive an
-- idempotency marker so this operation is safe to repeat.
CREATE FUNCTION public.reprocess_legacy_wiki_check_reviews()
RETURNS TABLE (
  tmdb_id bigint,
  archived_msg_id bigint,
  outcome text,
  queued_msg_id bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_target_id bigint;
  v_archive record;
  v_language text;
  v_queue_msg_id bigint;
  v_outcome text;
  v_count integer;
BEGIN
  FOREACH v_target_id IN ARRAY ARRAY[1492640, 284558, 977942, 1248832]::bigint[] LOOP
    v_count := 0;

    FOR v_archive IN
      SELECT a.msg_id, a.message
      FROM pgmq.a_wiki_check AS a
      WHERE a.message->>'review_needed' = 'true'
        AND (a.message->>'tmdb_id')::bigint = v_target_id
      ORDER BY a.msg_id
      FOR UPDATE
    LOOP
      v_count := v_count + 1;
      v_queue_msg_id := NULL;

      IF v_archive.message ? 'legacy_review_reprocess' THEN
        v_outcome := 'already_reprocessed';
        v_queue_msg_id := NULLIF(
          v_archive.message->'legacy_review_reprocess'->>'queued_msg_id',
          ''
        )::bigint;
      ELSE
        -- Serialize legacy and concurrent normal enqueues for this item.
        PERFORM pg_advisory_xact_lock(v_target_id);

        v_language := COALESCE(
          NULLIF(v_archive.message->>'wikipedia_language', ''),
          NULLIF(v_archive.message->>'language', ''),
          'en'
        );

        SELECT q.msg_id
        INTO v_queue_msg_id
        FROM pgmq.q_wiki_check AS q
        WHERE (q.message->>'tmdb_id')::bigint = v_target_id
          AND q.message->>'media_type' = v_archive.message->>'media_type'
          AND COALESCE(q.message->>'wikipedia_language', q.message->>'language') = v_language
          AND q.message->>'dubbing_language' IS NULL
          AND COALESCE((q.message->>'season_number')::integer, -1) = COALESCE(
            CASE
              WHEN v_archive.message->>'season_number' ~ '^-?[0-9]+$'
                THEN (v_archive.message->>'season_number')::integer
              ELSE NULL
            END,
            -1
          )
          AND COALESCE((q.message->>'episode_number')::integer, -1) = COALESCE(
            CASE
              WHEN v_archive.message->>'episode_number' ~ '^-?[0-9]+$'
                THEN (v_archive.message->>'episode_number')::integer
              ELSE NULL
            END,
            -1
          )
        ORDER BY q.msg_id
        LIMIT 1;

        IF v_queue_msg_id IS NOT NULL THEN
          v_outcome := 'already_enqueued';
        ELSE
          IF NULLIF(v_archive.message->>'media_type', '') IS NULL THEN
            RAISE EXCEPTION 'Legacy wiki_check archive item % has no media_type', v_archive.msg_id;
          END IF;

          v_queue_msg_id := public.enqueue_media_fetch(
            p_tmdb_id => v_target_id,
            p_media_type => v_archive.message->>'media_type',
            p_season_number => CASE
              WHEN v_archive.message->>'season_number' ~ '^-?[0-9]+$'
                THEN (v_archive.message->>'season_number')::integer
              ELSE NULL
            END,
            p_episode_number => CASE
              WHEN v_archive.message->>'episode_number' ~ '^-?[0-9]+$'
                THEN (v_archive.message->>'episode_number')::integer
              ELSE NULL
            END,
            p_wikipedia_language => v_language,
            p_is_manual => false,
            p_requested_by => CASE
              WHEN v_archive.message->>'requested_by' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN (v_archive.message->>'requested_by')::uuid
              ELSE NULL
            END
          );
          v_outcome := 'requeued';
        END IF;

        UPDATE pgmq.a_wiki_check
        SET message = message || jsonb_build_object(
          'legacy_review_reprocess', jsonb_build_object(
            'outcome', v_outcome,
            'processed_at', now(),
            'queued_msg_id', v_queue_msg_id
          )
        )
        WHERE msg_id = v_archive.msg_id;
      END IF;

      tmdb_id := v_target_id;
      archived_msg_id := v_archive.msg_id;
      outcome := v_outcome;
      queued_msg_id := v_queue_msg_id;
      RETURN NEXT;
    END LOOP;

    IF v_count = 0 THEN
      tmdb_id := v_target_id;
      archived_msg_id := NULL;
      outcome := 'not_found';
      queued_msg_id := NULL;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.reprocess_legacy_wiki_check_reviews()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reprocess_legacy_wiki_check_reviews()
  TO service_role;
