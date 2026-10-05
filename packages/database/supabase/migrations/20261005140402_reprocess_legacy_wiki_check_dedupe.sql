-- Keep the archived PGMQ message immutable. Reprocessing state lives in a
-- private-to-the-API ledger table and is keyed by the source archive message.
CREATE TABLE public.legacy_wiki_check_reprocesses (
  archived_msg_id bigint PRIMARY KEY,
  tmdb_id bigint NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('requeued', 'already_enqueued')),
  queued_msg_id bigint NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.legacy_wiki_check_reprocesses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.legacy_wiki_check_reprocesses FROM PUBLIC, anon, authenticated, service_role;

-- All media queue enqueue paths use the same transaction lock identity. Hash
-- collisions can only serialize unrelated items; the queue predicate remains
-- the authority for deciding whether the item is already active.
CREATE FUNCTION public.lock_media_queue_identity(
  p_queue text,
  p_tmdb_id bigint,
  p_media_type text,
  p_wikipedia_language text,
  p_dubbing_language text,
  p_season_number integer,
  p_episode_number integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_queue NOT IN ('wiki_check', 'wiki_discovery', 'wiki_extract') THEN
    RAISE EXCEPTION 'Invalid media queue identity: %', p_queue;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    pg_catalog.jsonb_build_array(
      p_queue,
      p_tmdb_id,
      p_media_type,
      CASE WHEN p_queue IN ('wiki_check', 'wiki_extract') THEN p_wikipedia_language END,
      CASE WHEN p_queue IN ('wiki_check', 'wiki_extract') THEN p_dubbing_language END,
      p_season_number,
      p_episode_number
    )::text,
    0
  ));
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_media_extract(
  p_tmdb_id bigint,
  p_media_type text,
  p_language text,
  p_page_id bigint,
  p_section_indexes jsonb,
  p_season_number integer DEFAULT NULL,
  p_episode_number integer DEFAULT NULL,
  p_is_manual boolean DEFAULT false,
  p_wikipedia_language text DEFAULT NULL,
  p_dubbing_language text DEFAULT NULL,
  p_requested_by uuid DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_payload jsonb;
  v_msg_id bigint;
  v_wikipedia_language text;
BEGIN
  v_wikipedia_language := nullif(trim(COALESCE(p_wikipedia_language, p_language)), '');

  IF v_wikipedia_language IS NULL
    OR v_wikipedia_language !~ '^[a-z][a-z0-9-]*$'
    OR v_wikipedia_language = 'simple' THEN
    RAISE EXCEPTION 'Invalid Wikipedia source language';
  END IF;
  IF p_dubbing_language IS NULL OR NOT public.is_valid_dubbing_language(p_dubbing_language) THEN
    RAISE EXCEPTION 'A regional dubbing language is required (for example fr-FR)';
  END IF;

  PERFORM public.lock_media_queue_identity(
    'wiki_extract', p_tmdb_id, p_media_type, v_wikipedia_language,
    p_dubbing_language, p_season_number, p_episode_number
  );

  IF EXISTS (
    SELECT 1 FROM public.dubbing_projects dp
    WHERE dp.content_id = p_tmdb_id
      AND dp.content_type IN (p_media_type, CASE WHEN p_media_type IN ('season', 'episode') THEN 'tv' ELSE '' END)
      AND dp.language = p_dubbing_language
  ) THEN
    RAISE EXCEPTION 'Dubbing project already exists for % % [%]', p_media_type, p_tmdb_id, v_wikipedia_language;
  END IF;

  v_payload := jsonb_build_object(
    'tmdb_id', p_tmdb_id,
    'media_type', p_media_type,
    'language', v_wikipedia_language,
    'wikipedia_language', v_wikipedia_language,
    'dubbing_language', p_dubbing_language,
    'page_id', p_page_id,
    'section_indexes', p_section_indexes,
    'season_number', p_season_number,
    'episode_number', p_episode_number,
    'is_manual', COALESCE(p_is_manual, false),
    'priority', CASE WHEN COALESCE(p_is_manual, false) THEN 'high' ELSE 'normal' END,
    'requested_by', p_requested_by
  );

  IF EXISTS (
    SELECT 1 FROM pgmq.q_wiki_extract
    WHERE (message->>'tmdb_id')::bigint = p_tmdb_id
      AND message->>'media_type' = p_media_type
      AND COALESCE(message->>'wikipedia_language', message->>'language') = v_wikipedia_language
      AND message->>'dubbing_language' = p_dubbing_language
      AND COALESCE((message->>'season_number')::integer, -1) = COALESCE(p_season_number, -1)
      AND COALESCE((message->>'episode_number')::integer, -1) = COALESCE(p_episode_number, -1)
  ) THEN
    RAISE EXCEPTION 'Item is already in the extract queue';
  END IF;

  SELECT pgmq.send('wiki_extract', v_payload, 0) INTO v_msg_id;
  RETURN v_msg_id;
END;
$$;
REVOKE ALL ON FUNCTION public.lock_media_queue_identity(text, bigint, text, text, text, integer, integer)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enqueue_media_fetch(
  p_tmdb_id bigint,
  p_media_type text,
  p_season_number integer DEFAULT NULL,
  p_episode_number integer DEFAULT NULL,
  p_language text DEFAULT NULL,
  p_is_manual boolean DEFAULT false,
  p_wikipedia_language text DEFAULT NULL,
  p_dubbing_language text DEFAULT NULL,
  p_requested_by uuid DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_payload jsonb;
  v_msg_id bigint;
  v_target_queue text;
  v_lang text;
BEGIN
  v_lang := nullif(trim(COALESCE(p_wikipedia_language, p_language)), '');

  IF v_lang IS NOT NULL AND (v_lang !~ '^[a-z][a-z0-9-]*$' OR v_lang = 'simple') THEN
    RAISE EXCEPTION 'Invalid Wikipedia source language';
  END IF;
  IF p_dubbing_language IS NOT NULL AND NOT public.is_valid_dubbing_language(p_dubbing_language) THEN
    RAISE EXCEPTION 'Invalid regional dubbing language';
  END IF;

  IF v_lang IS NOT NULL THEN
    v_target_queue := 'wiki_check';
  ELSE
    v_target_queue := 'wiki_discovery';
  END IF;

  PERFORM public.lock_media_queue_identity(
    v_target_queue, p_tmdb_id, p_media_type, v_lang, p_dubbing_language,
    p_season_number, p_episode_number
  );

  IF p_dubbing_language IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.dubbing_projects dp
    WHERE dp.content_id = p_tmdb_id
      AND dp.content_type IN (p_media_type, CASE WHEN p_media_type IN ('season', 'episode') THEN 'tv' ELSE '' END)
      AND dp.language = p_dubbing_language
  ) THEN
    RAISE EXCEPTION 'Dubbing project already exists for % % [%]', p_media_type, p_tmdb_id, v_lang;
  END IF;

  v_payload := jsonb_build_object(
    'tmdb_id', p_tmdb_id,
    'media_type', p_media_type,
    'season_number', p_season_number,
    'episode_number', p_episode_number,
    'language', v_lang,
    'wikipedia_language', v_lang,
    'dubbing_language', p_dubbing_language,
    'is_manual', COALESCE(p_is_manual, false),
    'priority', CASE WHEN COALESCE(p_is_manual, false) THEN 'high' ELSE 'normal' END,
    'requested_by', p_requested_by
  );

  IF v_target_queue = 'wiki_check' THEN
    IF EXISTS (
      SELECT 1 FROM pgmq.q_wiki_check
      WHERE (message->>'tmdb_id')::bigint = p_tmdb_id
        AND message->>'media_type' = p_media_type
        AND COALESCE(message->>'wikipedia_language', message->>'language') = v_lang
        AND (message->>'dubbing_language') IS NOT DISTINCT FROM p_dubbing_language
        AND COALESCE((message->>'season_number')::int, -1) = COALESCE(p_season_number, -1)
        AND COALESCE((message->>'episode_number')::int, -1) = COALESCE(p_episode_number, -1)
    ) THEN
      RAISE EXCEPTION 'Item is already in the check queue';
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1 FROM pgmq.q_wiki_discovery
      WHERE (message->>'tmdb_id')::bigint = p_tmdb_id
        AND message->>'media_type' = p_media_type
        AND COALESCE((message->>'season_number')::int, -1) = COALESCE(p_season_number, -1)
        AND COALESCE((message->>'episode_number')::int, -1) = COALESCE(p_episode_number, -1)
    ) THEN
      RAISE EXCEPTION 'Item is already in the discovery queue';
    END IF;
  END IF;

  IF v_target_queue = 'wiki_check' THEN
    SELECT pgmq.send('wiki_check', v_payload, 0) INTO v_msg_id;
  ELSE
    SELECT pgmq.send('wiki_discovery', v_payload, 0) INTO v_msg_id;
  END IF;

  RETURN v_msg_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reprocess_legacy_wiki_check_reviews()
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
  v_season_number integer;
  v_episode_number integer;
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

      SELECT r.outcome, r.queued_msg_id
      INTO v_outcome, v_queue_msg_id
      FROM public.legacy_wiki_check_reprocesses AS r
      WHERE r.archived_msg_id = v_archive.msg_id;

      IF FOUND THEN
        v_outcome := 'already_reprocessed';
      ELSE
        IF NULLIF(v_archive.message->>'media_type', '') IS NULL THEN
          RAISE EXCEPTION 'Legacy wiki_check archive item % has no media_type', v_archive.msg_id;
        END IF;

        v_language := COALESCE(
          NULLIF(btrim(v_archive.message->>'wikipedia_language'), ''),
          NULLIF(btrim(v_archive.message->>'language'), ''),
          'en'
        );
        v_season_number := CASE
          WHEN v_archive.message->>'season_number' ~ '^-?[0-9]+$'
            THEN (v_archive.message->>'season_number')::integer
          ELSE NULL
        END;
        v_episode_number := CASE
          WHEN v_archive.message->>'episode_number' ~ '^-?[0-9]+$'
            THEN (v_archive.message->>'episode_number')::integer
          ELSE NULL
        END;

        PERFORM public.lock_media_queue_identity(
          'wiki_check', v_target_id, v_archive.message->>'media_type', v_language,
          NULL, v_season_number, v_episode_number
        );

        SELECT q.msg_id
        INTO v_queue_msg_id
        FROM pgmq.q_wiki_check AS q
        WHERE (q.message->>'tmdb_id')::bigint = v_target_id
          AND q.message->>'media_type' = v_archive.message->>'media_type'
          AND COALESCE(q.message->>'wikipedia_language', q.message->>'language') = v_language
          AND q.message->>'dubbing_language' IS NULL
          AND COALESCE((q.message->>'season_number')::integer, -1) = COALESCE(v_season_number, -1)
          AND COALESCE((q.message->>'episode_number')::integer, -1) = COALESCE(v_episode_number, -1)
        ORDER BY q.msg_id
        LIMIT 1;

        IF v_queue_msg_id IS NOT NULL THEN
          v_outcome := 'already_enqueued';
        ELSE
          v_queue_msg_id := public.enqueue_media_fetch(
            p_tmdb_id => v_target_id,
            p_media_type => v_archive.message->>'media_type',
            p_season_number => v_season_number,
            p_episode_number => v_episode_number,
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

        INSERT INTO public.legacy_wiki_check_reprocesses(
          archived_msg_id, tmdb_id, outcome, queued_msg_id
        ) VALUES (
          v_archive.msg_id, v_target_id, v_outcome, v_queue_msg_id
        );
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
