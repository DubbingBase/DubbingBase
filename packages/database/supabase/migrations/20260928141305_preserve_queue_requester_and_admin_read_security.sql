-- Queue requester IDs represent the original authenticated enqueue request.
-- Service-role queue workers must pass that identity explicitly; auth.uid() is
-- NULL for their Supabase client and must never be used as a substitute.

DROP FUNCTION IF EXISTS public.resume_wiki_check_for_regional_review(bigint, text);
DROP FUNCTION IF EXISTS public.enqueue_media_fetch(bigint, text, integer, integer, text, boolean, text, text);
DROP FUNCTION IF EXISTS public.enqueue_media_extract(bigint, text, text, bigint, jsonb, integer, integer, boolean, text, text);

CREATE FUNCTION public.enqueue_media_fetch(
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
    SELECT pgmq.send('wiki_check', v_payload, '{}'::jsonb) INTO v_msg_id;
  ELSE
    SELECT pgmq.send('wiki_discovery', v_payload, '{}'::jsonb) INTO v_msg_id;
  END IF;

  RETURN v_msg_id;
END;
$$;

CREATE FUNCTION public.enqueue_media_extract(
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
      AND COALESCE((message->>'season_number')::int, -1) = COALESCE(p_season_number, -1)
      AND COALESCE((message->>'episode_number')::int, -1) = COALESCE(p_episode_number, -1)
  ) THEN
    RAISE EXCEPTION 'Item is already in the extract queue';
  END IF;

  SELECT pgmq.send('wiki_extract', v_payload, '{}'::jsonb) INTO v_msg_id;
  RETURN v_msg_id;
END;
$$;

CREATE FUNCTION public.resume_wiki_check_for_regional_review(
  p_msg_id bigint,
  p_dubbing_language text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_message jsonb;
  v_tmdb_id bigint;
  v_media_type text;
  v_wikipedia_language text;
  v_season_number int;
  v_episode_number int;
  v_is_manual boolean;
  v_requested_by uuid;
BEGIN
  IF p_dubbing_language IS NULL OR NOT public.is_valid_dubbing_language(p_dubbing_language) THEN
    RAISE EXCEPTION 'Invalid regional dubbing language';
  END IF;

  SELECT message INTO v_message
  FROM pgmq.a_wiki_check
  WHERE msg_id = p_msg_id
    AND message->>'review_needed' = 'true'
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  v_tmdb_id := (v_message->>'tmdb_id')::bigint;
  v_media_type := v_message->>'media_type';
  v_wikipedia_language := COALESCE(v_message->>'wikipedia_language', v_message->>'language');
  v_season_number := nullif(v_message->>'season_number', '')::int;
  v_episode_number := nullif(v_message->>'episode_number', '')::int;
  v_is_manual := COALESCE((v_message->>'is_manual')::boolean, false);
  BEGIN
    v_requested_by := nullif(v_message->>'requested_by', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_requested_by := NULL;
  END;

  IF v_wikipedia_language IS NULL
    OR v_wikipedia_language !~ '^[a-z][a-z0-9-]*$'
    OR v_wikipedia_language = 'simple' THEN
    RAISE EXCEPTION 'Review item has no valid Wikipedia source language';
  END IF;

  BEGIN
    PERFORM public.enqueue_media_fetch(
      p_media_type := v_media_type,
      p_tmdb_id := v_tmdb_id,
      p_season_number := v_season_number,
      p_episode_number := v_episode_number,
      p_language := v_wikipedia_language,
      p_is_manual := v_is_manual,
      p_wikipedia_language := v_wikipedia_language,
      p_dubbing_language := p_dubbing_language,
      p_requested_by := v_requested_by
    );
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Item is already in the check queue'
      OR SQLERRM LIKE 'Dubbing project already exists for %' THEN
      RETURN false;
    END IF;
    RAISE;
  END;

  DELETE FROM pgmq.a_wiki_check WHERE msg_id = p_msg_id;
  RETURN true;
END;
$$;

DROP FUNCTION IF EXISTS public.get_regional_review_queue_items(integer);
CREATE FUNCTION public.get_regional_review_queue_items(
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id bigint,
  queue_name text,
  tmdb_id bigint,
  media_type text,
  wikipedia_language text,
  dubbing_language text,
  season_number integer,
  episode_number integer,
  status text,
  error_message text,
  created_at timestamptz,
  read_ct integer,
  is_manual boolean,
  review_note text,
  requested_by uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    a.msg_id,
    'wiki_check'::text,
    (a.message->>'tmdb_id')::bigint,
    a.message->>'media_type',
    COALESCE(a.message->>'wikipedia_language', a.message->>'language'),
    a.message->>'dubbing_language',
    nullif(a.message->>'season_number', '')::int,
    nullif(a.message->>'episode_number', '')::int,
    'review_needed'::text,
    nullif(a.message->>'error_message', ''),
    a.enqueued_at,
    a.read_ct,
    COALESCE((a.message->>'is_manual')::boolean, false),
    a.message->>'review_note',
    CASE
      WHEN a.message->>'requested_by' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (a.message->>'requested_by')::uuid
      ELSE NULL
    END
  FROM pgmq.a_wiki_check AS a
  WHERE a.message->>'review_needed' = 'true'
  ORDER BY a.enqueued_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 500))
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

-- Earlier queue RPCs still required this staging registry. Their final
-- replacements above use structural validation, so the table can now go.
DROP TABLE public.dubbing_languages;

REVOKE ALL ON FUNCTION public.enqueue_media_fetch(bigint, text, integer, integer, text, boolean, text, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_media_fetch(bigint, text, integer, integer, text, boolean, text, text, uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.enqueue_media_extract(bigint, text, text, bigint, jsonb, integer, integer, boolean, text, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_media_extract(bigint, text, text, bigint, jsonb, integer, integer, boolean, text, text, uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.resume_wiki_check_for_regional_review(bigint, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resume_wiki_check_for_regional_review(bigint, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.get_media_queue_items(text, text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_media_queue_items(text, text, integer, integer)
  TO service_role;

REVOKE ALL ON FUNCTION public.get_regional_review_queue_items(integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_regional_review_queue_items(integer, integer)
  TO service_role;

REVOKE ALL ON FUNCTION public.get_media_queue_stats()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_media_queue_stats()
  TO service_role;
