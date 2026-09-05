-- Migration: 20260906000000_prevent_duplicate_dubbing_projects.sql
-- Prevent queueing when a dubbing_project already exists for that language.
-- Also drop any conflicting overloads and recreate canonical signatures.

DO $$
DECLARE
  r RECORD;
  func_names text[] := ARRAY['enqueue_media_fetch','enqueue_media_extract'];
  fname text;
BEGIN
  FOREACH fname IN ARRAY func_names LOOP
    FOR r IN (
      SELECT p.oid::regprocedure::text AS func_signature
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = fname
    ) LOOP
      EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
    END LOOP;
  END LOOP;
END $$;

-- enqueue_media_fetch: block if dubbing project already exists for language
CREATE OR REPLACE FUNCTION public.enqueue_media_fetch(
  p_tmdb_id bigint,
  p_media_type text,
  p_season_number int default null,
  p_episode_number int default null,
  p_language text default null,
  p_is_manual boolean default false
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
  v_lang := nullif(trim(p_language), '');

  IF v_lang IS NOT NULL THEN
    v_target_queue := 'wiki_check';
  ELSE
    v_target_queue := 'wiki_discovery';
  END IF;

  -- Skip if a dubbing project already has credits for this media+language
  -- When language is specified, block. Discovery (no language) is not blocked here
  -- because it only discovers which languages exist.
  IF v_lang IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.dubbing_projects dp
    WHERE dp.content_id = p_tmdb_id
      AND dp.content_type IN (p_media_type, CASE WHEN p_media_type IN ('season','episode') THEN 'tv' ELSE '' END)
      AND lower(dp.language) = lower(v_lang)
  ) THEN
    RAISE EXCEPTION 'Dubbing project already exists for % % [%]', p_media_type, p_tmdb_id, v_lang;
  END IF;

  v_payload := jsonb_build_object(
    'tmdb_id', p_tmdb_id,
    'media_type', p_media_type,
    'season_number', p_season_number,
    'episode_number', p_episode_number,
    'language', v_lang,
    'is_manual', COALESCE(p_is_manual, false),
    'priority', CASE WHEN COALESCE(p_is_manual, false) THEN 'high' ELSE 'normal' END,
    'requested_by', auth.uid()
  );

  IF v_target_queue = 'wiki_check' THEN
    IF EXISTS (
      SELECT 1 FROM pgmq.q_wiki_check
      WHERE (message->>'tmdb_id')::bigint = p_tmdb_id
        AND message->>'media_type' = p_media_type
        AND (message->>'language') = v_lang
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
    SELECT pgmq.send('wiki_check', v_payload, '{}'::jsonb) INTO v_msg_id;
  ELSE
    SELECT pgmq.send('wiki_discovery', v_payload, '{}'::jsonb) INTO v_msg_id;
  END IF;

  RETURN v_msg_id;
END;
$$;

-- enqueue_media_extract: also block if dubbing project already exists
CREATE OR REPLACE FUNCTION public.enqueue_media_extract(
  p_tmdb_id bigint,
  p_media_type text,
  p_language text,
  p_page_id bigint,
  p_section_indexes jsonb,
  p_season_number int default null,
  p_episode_number int default null,
  p_is_manual boolean default false
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_payload jsonb;
  v_msg_id bigint;
  v_lang text;
BEGIN
  v_lang := trim(p_language);

  IF EXISTS (
    SELECT 1 FROM public.dubbing_projects dp
    WHERE dp.content_id = p_tmdb_id
      AND dp.content_type IN (p_media_type, CASE WHEN p_media_type IN ('season','episode') THEN 'tv' ELSE '' END)
      AND lower(dp.language) = lower(v_lang)
  ) THEN
    RAISE EXCEPTION 'Dubbing project already exists for % % [%]', p_media_type, p_tmdb_id, v_lang;
  END IF;

  v_payload := jsonb_build_object(
    'tmdb_id', p_tmdb_id,
    'media_type', p_media_type,
    'language', v_lang,
    'page_id', p_page_id,
    'section_indexes', p_section_indexes,
    'season_number', p_season_number,
    'episode_number', p_episode_number,
    'is_manual', COALESCE(p_is_manual, false),
    'priority', CASE WHEN COALESCE(p_is_manual, false) THEN 'high' ELSE 'normal' END,
    'requested_by', auth.uid()
  );

  IF EXISTS (
    SELECT 1 FROM pgmq.q_wiki_extract
    WHERE (message->>'tmdb_id')::bigint = p_tmdb_id
      AND message->>'media_type' = p_media_type
      AND (message->>'language') = v_lang
      AND COALESCE((message->>'season_number')::int, -1) = COALESCE(p_season_number, -1)
      AND COALESCE((message->>'episode_number')::int, -1) = COALESCE(p_episode_number, -1)
  ) THEN
    RAISE EXCEPTION 'Item is already in the extract queue';
  END IF;

  SELECT pgmq.send('wiki_extract', v_payload, '{}'::jsonb) INTO v_msg_id;
  RETURN v_msg_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_media_fetch(bigint, text, int, int, text, boolean) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_media_extract(bigint, text, text, bigint, jsonb, int, int, boolean) TO authenticated, anon, service_role;
