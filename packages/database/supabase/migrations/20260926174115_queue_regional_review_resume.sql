-- Queue discovery may know its Wikipedia source edition without knowing the
-- regional dubbing target. Keep those checks archived for explicit admin
-- review, and require a registered target before any extract item is queued.

CREATE OR REPLACE FUNCTION public.enqueue_media_extract(
  p_tmdb_id bigint,
  p_media_type text,
  p_language text,
  p_page_id bigint,
  p_section_indexes jsonb,
  p_season_number int DEFAULT NULL,
  p_episode_number int DEFAULT NULL,
  p_is_manual boolean DEFAULT false,
  p_wikipedia_language text DEFAULT NULL,
  p_dubbing_language text DEFAULT NULL
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

  IF v_wikipedia_language IS NULL OR v_wikipedia_language !~ '^[a-z][a-z0-9-]*$' THEN
    RAISE EXCEPTION 'Invalid Wikipedia source language';
  END IF;
  IF p_dubbing_language IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.dubbing_languages WHERE code = p_dubbing_language
  ) THEN
    RAISE EXCEPTION 'A registered regional dubbing language is required';
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
    'requested_by', auth.uid()
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

CREATE OR REPLACE FUNCTION public.archive_wiki_check_for_regional_review(
  p_msg_id bigint,
  p_review_note text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_archived boolean;
BEGIN
  IF p_review_note IS NULL OR btrim(p_review_note) = '' THEN
    RAISE EXCEPTION 'A review note is required';
  END IF;

  PERFORM 1 FROM pgmq.q_wiki_check WHERE msg_id = p_msg_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT public.archive_media_queue_message('wiki_check', p_msg_id) INTO v_archived;
  IF NOT v_archived THEN
    RAISE EXCEPTION 'Could not archive wiki_check item %', p_msg_id;
  END IF;

  UPDATE pgmq.a_wiki_check
  SET message = message || jsonb_build_object(
    'review_needed', true,
    'review_note', btrim(p_review_note)
  )
  WHERE msg_id = p_msg_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Archived wiki_check item % was not found', p_msg_id;
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.resume_wiki_check_for_regional_review(
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
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.dubbing_languages WHERE code = p_dubbing_language
  ) THEN
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

  IF v_wikipedia_language IS NULL OR v_wikipedia_language !~ '^[a-z][a-z0-9-]*$' THEN
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
      p_dubbing_language := p_dubbing_language
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

CREATE OR REPLACE FUNCTION public.get_regional_review_queue_items(
  p_limit int DEFAULT 100
)
RETURNS TABLE (
  id bigint,
  queue_name text,
  tmdb_id bigint,
  media_type text,
  wikipedia_language text,
  dubbing_language text,
  season_number int,
  episode_number int,
  status text,
  error_message text,
  created_at timestamptz,
  read_ct int,
  is_manual boolean,
  review_note text
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
    a.message->>'review_note'
  FROM pgmq.a_wiki_check a
  WHERE a.message->>'review_needed' = 'true'
  ORDER BY a.enqueued_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 500));
$$;

REVOKE EXECUTE ON FUNCTION public.archive_wiki_check_for_regional_review(bigint, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_wiki_check_for_regional_review(bigint, text)
  TO service_role;
REVOKE EXECUTE ON FUNCTION public.resume_wiki_check_for_regional_review(bigint, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resume_wiki_check_for_regional_review(bigint, text)
  TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_regional_review_queue_items(int)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_regional_review_queue_items(int)
  TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.enqueue_media_extract(bigint, text, text, bigint, jsonb, int, int, boolean, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_media_extract(bigint, text, text, bigint, jsonb, int, int, boolean, text, text)
  TO service_role;
