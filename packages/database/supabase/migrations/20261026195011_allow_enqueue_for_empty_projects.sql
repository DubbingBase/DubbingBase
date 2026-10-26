-- An existing regional project blocks automatic extraction only after it has
-- at least one work record. Empty projects can be populated by reprocessing.
CREATE OR REPLACE FUNCTION public.enqueue_media_fetch(
  p_tmdb_id bigint,
  p_media_type text,
  p_season_number integer DEFAULT NULL,
  p_episode_number integer DEFAULT NULL,
  p_language text DEFAULT NULL,
  p_is_manual boolean DEFAULT false,
  p_wikipedia_language text DEFAULT NULL,
  p_dubbing_language text DEFAULT NULL,
  p_requested_by uuid DEFAULT NULL,
  p_wiki_id text DEFAULT NULL,
  p_title text DEFAULT NULL,
  p_page_title text DEFAULT NULL,
  p_poster_path text DEFAULT NULL
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_payload jsonb;
  v_msg_id bigint;
  v_lang text := nullif(trim(COALESCE(p_wikipedia_language, p_language)), '');
BEGIN
  IF v_lang IS NOT NULL AND (v_lang !~ '^[a-z][a-z0-9-]*$' OR v_lang = 'simple') THEN
    RAISE EXCEPTION 'Invalid Wikipedia source language';
  END IF;
  IF p_dubbing_language IS NOT NULL AND NOT public.is_valid_dubbing_language(p_dubbing_language) THEN
    RAISE EXCEPTION 'Invalid regional dubbing language';
  END IF;
  PERFORM public.lock_media_queue_identity(
    'wiki_scan', p_tmdb_id, p_media_type, v_lang, p_dubbing_language,
    p_season_number, p_episode_number
  );
  IF p_dubbing_language IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.dubbing_projects dp
    WHERE dp.content_id = p_tmdb_id
      AND dp.content_type IN (p_media_type, CASE WHEN p_media_type IN ('season', 'episode') THEN 'tv' ELSE '' END)
      AND dp.language = p_dubbing_language
      AND EXISTS (
        SELECT 1 FROM public.work w
        WHERE w.dubbing_project_id = dp.id
      )
  ) THEN
    RAISE EXCEPTION 'Dubbing project already exists for % % [%]', p_media_type, p_tmdb_id, v_lang;
  END IF;

  v_payload := jsonb_strip_nulls(jsonb_build_object(
    'tmdb_id', p_tmdb_id, 'media_type', p_media_type,
    'season_number', p_season_number, 'episode_number', p_episode_number,
    'language', v_lang, 'wikipedia_language', v_lang,
    'dubbing_language', p_dubbing_language, 'is_manual', COALESCE(p_is_manual, false),
    'priority', CASE WHEN COALESCE(p_is_manual, false) THEN 'high' ELSE 'normal' END,
    'requested_by', p_requested_by, 'wiki_id', p_wiki_id, 'title', p_title,
    'page_title', p_page_title, 'poster_path', p_poster_path
  ));

  IF EXISTS (
    SELECT 1 FROM pgmq.q_wiki_scan q
    WHERE (q.message->>'tmdb_id')::bigint = p_tmdb_id
      AND q.message->>'media_type' = p_media_type
      AND COALESCE(q.message->>'wikipedia_language', q.message->>'language') IS NOT DISTINCT FROM v_lang
      AND q.message->>'dubbing_language' IS NOT DISTINCT FROM p_dubbing_language
      AND COALESCE((q.message->>'season_number')::integer, -1) = COALESCE(p_season_number, -1)
      AND COALESCE((q.message->>'episode_number')::integer, -1) = COALESCE(p_episode_number, -1)
  ) THEN
    RAISE EXCEPTION 'Item is already in the wiki_scan queue';
  END IF;

  SELECT pgmq.send('wiki_scan', v_payload, 0) INTO v_msg_id;
  RETURN v_msg_id;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_media_fetch(bigint, text, integer, integer, text, boolean, text, text, uuid, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_media_fetch(bigint, text, integer, integer, text, boolean, text, text, uuid, text, text, text, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_media_extract(
  p_tmdb_id bigint, p_media_type text, p_language text, p_page_id bigint,
  p_section_indexes jsonb, p_season_number integer DEFAULT NULL,
  p_episode_number integer DEFAULT NULL, p_is_manual boolean DEFAULT false,
  p_wikipedia_language text DEFAULT NULL, p_dubbing_language text DEFAULT NULL,
  p_requested_by uuid DEFAULT NULL, p_scan_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_payload jsonb;
  v_msg_id bigint;
  v_wikipedia_language text := nullif(trim(COALESCE(p_wikipedia_language, p_language)), '');
  v_metadata jsonb := COALESCE(p_scan_metadata, '{}'::jsonb);
BEGIN
  IF v_wikipedia_language IS NULL OR v_wikipedia_language !~ '^[a-z][a-z0-9-]*$' OR v_wikipedia_language = 'simple' THEN
    RAISE EXCEPTION 'Invalid Wikipedia source language';
  END IF;
  IF p_dubbing_language IS NULL OR NOT public.is_valid_dubbing_language(p_dubbing_language) THEN
    RAISE EXCEPTION 'A regional dubbing language is required (for example fr-FR)';
  END IF;
  IF jsonb_typeof(v_metadata) <> 'object' THEN RAISE EXCEPTION 'Scan metadata must be a JSON object'; END IF;
  IF jsonb_typeof(p_section_indexes) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Section indexes must be a JSON array'; END IF;
  IF jsonb_array_length(p_section_indexes)=0 THEN RAISE EXCEPTION 'Section indexes must not be empty'; END IF;
  IF v_metadata - ARRAY['title','wiki_id','page_title','revision_id','section_headings','poster_path']::text[] <> '{}'::jsonb THEN
    RAISE EXCEPTION 'Scan metadata contains unsupported fields';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_each(v_metadata) AS item(key,value) WHERE item.key<>'revision_id' AND jsonb_typeof(item.value)<>'string'
      AND item.key<>'section_headings') OR (v_metadata ? 'section_headings' AND jsonb_typeof(v_metadata->'section_headings')<>'array') THEN
    RAISE EXCEPTION 'Scan metadata fields have invalid types';
  END IF;
  IF v_metadata ? 'section_headings' AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_metadata->'section_headings') AS heading(value) WHERE jsonb_typeof(heading.value)<>'string'
  ) THEN RAISE EXCEPTION 'Section headings must contain strings'; END IF;
  IF v_metadata ? 'section_headings' AND jsonb_array_length(v_metadata->'section_headings')<>jsonb_array_length(p_section_indexes) THEN
    RAISE EXCEPTION 'Section headings must match the selected section indexes';
  END IF;
  IF v_metadata ? 'revision_id' AND (v_metadata->>'revision_id') !~ '^[1-9][0-9]*$' THEN
    RAISE EXCEPTION 'Invalid Wikipedia revision ID';
  END IF;

  PERFORM public.lock_media_queue_identity('wiki_extract', p_tmdb_id, p_media_type,
    v_wikipedia_language, p_dubbing_language, p_season_number, p_episode_number);
  IF EXISTS (
    SELECT 1 FROM public.dubbing_projects dp WHERE dp.content_id = p_tmdb_id
      AND dp.content_type IN (p_media_type, CASE WHEN p_media_type IN ('season', 'episode') THEN 'tv' ELSE '' END)
      AND dp.language = p_dubbing_language
      AND EXISTS (
        SELECT 1 FROM public.work w
        WHERE w.dubbing_project_id = dp.id
      )
  ) THEN RAISE EXCEPTION 'Dubbing project already exists for % % [%]', p_media_type, p_tmdb_id, v_wikipedia_language; END IF;

  v_payload := jsonb_strip_nulls(jsonb_build_object(
    'tmdb_id', p_tmdb_id, 'media_type', p_media_type, 'language', v_wikipedia_language,
    'wikipedia_language', v_wikipedia_language, 'dubbing_language', p_dubbing_language,
    'page_id', p_page_id, 'section_indexes', p_section_indexes,
    'season_number', p_season_number, 'episode_number', p_episode_number,
    'is_manual', COALESCE(p_is_manual, false),
    'priority', CASE WHEN COALESCE(p_is_manual, false) THEN 'high' ELSE 'normal' END,
    'requested_by', p_requested_by
  )) || jsonb_strip_nulls(jsonb_build_object(
    'title',v_metadata->>'title','wiki_id',v_metadata->>'wiki_id','page_title',v_metadata->>'page_title',
    'revision_id',CASE WHEN v_metadata ? 'revision_id' THEN (v_metadata->>'revision_id')::bigint END,
    'section_headings',v_metadata->'section_headings','poster_path',v_metadata->>'poster_path'
  ));

  IF EXISTS (
    SELECT 1 FROM pgmq.q_wiki_extract q
    WHERE (q.message->>'tmdb_id')::bigint = p_tmdb_id AND q.message->>'media_type' = p_media_type
      AND COALESCE(q.message->>'wikipedia_language', q.message->>'language') = v_wikipedia_language
      AND q.message->>'dubbing_language' = p_dubbing_language
      AND COALESCE((q.message->>'season_number')::integer, -1) = COALESCE(p_season_number, -1)
      AND COALESCE((q.message->>'episode_number')::integer, -1) = COALESCE(p_episode_number, -1)
  ) THEN RAISE EXCEPTION 'Item is already in the extract queue'; END IF;

  SELECT pgmq.send('wiki_extract', v_payload, 0) INTO v_msg_id;
  RETURN v_msg_id;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_media_extract(bigint, text, text, bigint, jsonb, integer, integer, boolean, text, text, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_media_extract(bigint, text, text, bigint, jsonb, integer, integer, boolean, text, text, uuid, jsonb)
  TO service_role;
