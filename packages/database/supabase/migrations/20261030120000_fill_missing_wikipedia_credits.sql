-- Let Wikipedia extraction add missing credits to existing projects while preserving saved work rows.
DROP FUNCTION IF EXISTS public.enqueue_media_fetch(bigint, text, integer, integer, text, boolean, text, text, uuid);
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

DROP FUNCTION IF EXISTS public.enqueue_media_extract(bigint, text, text, bigint, jsonb, integer, integer, boolean, text, text, uuid);
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

CREATE OR REPLACE FUNCTION public.apply_extracted_credits(
  p_content_id bigint,
  p_content_type text,
  p_dubbing_language text,
  p_credits jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project_id bigint;
  v_inserted_actors integer := 0;
  v_inserted_works integer := 0;
  v_overlapped_works integer := 0;
  v_mismatched_works integer := 0;
BEGIN
  IF p_content_id IS NULL OR p_content_id <= 0
    OR p_content_type IS NULL OR p_content_type NOT IN ('movie', 'tv', 'video_game')
    OR p_dubbing_language IS NULL
    OR NOT public.is_valid_dubbing_language(p_dubbing_language) THEN
    RAISE EXCEPTION 'Invalid extracted credit batch' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_credits) IS DISTINCT FROM 'array' OR jsonb_array_length(p_credits) > 1000 THEN
    RAISE EXCEPTION 'Extracted credits must be a JSON array of at most 1000 items' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_credits) AS item(value)
    WHERE jsonb_typeof(item.value) IS DISTINCT FROM 'object'
      OR NULLIF(btrim(item.value->>'firstname'), '') IS NULL
      OR NULLIF(btrim(item.value->>'lastname'), '') IS NULL
      OR COALESCE(item.value->>'actor_id', '') !~ '^[0-9]+$'
      OR (item.value->>'actor_id')::numeric <= 0
      OR (item.value ? 'character_id' AND item.value->>'character_id' IS NOT NULL
          AND (item.value->>'character_id' !~ '^[0-9]+$'
            OR (item.value->>'character_id')::numeric <= 0))
  ) THEN
    RAISE EXCEPTION 'Malformed extracted credit' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.dubbing_projects(content_id, content_type, language)
  VALUES (p_content_id, p_content_type, p_dubbing_language)
  ON CONFLICT (content_id, content_type, language) DO NOTHING;
  SELECT project.id INTO STRICT v_project_id
  FROM public.dubbing_projects AS project
  WHERE project.content_id = p_content_id
    AND project.content_type = p_content_type
    AND project.language = p_dubbing_language
  FOR UPDATE;

  PERFORM pg_advisory_xact_lock(hashtextextended(names.normalized_name, 0))
  FROM (
    SELECT DISTINCT lower(btrim(item.value->>'firstname')) || E'\x1f' ||
      lower(btrim(item.value->>'lastname')) AS normalized_name
    FROM jsonb_array_elements(p_credits) WITH ORDINALITY AS item(value, ordinal)
    ORDER BY normalized_name
  ) AS names;

  WITH names AS (
    SELECT DISTINCT ON (lower(btrim(item.value->>'firstname')),
                        lower(btrim(item.value->>'lastname')))
      btrim(item.value->>'firstname') AS firstname,
      btrim(item.value->>'lastname') AS lastname
    FROM jsonb_array_elements(p_credits) WITH ORDINALITY AS item(value, ordinal)
    ORDER BY lower(btrim(item.value->>'firstname')),
             lower(btrim(item.value->>'lastname')),
             btrim(item.value->>'firstname'), btrim(item.value->>'lastname')
  )
  INSERT INTO public.voice_actors(firstname, lastname)
  SELECT names.firstname, names.lastname FROM names
  WHERE NOT EXISTS (
    SELECT 1 FROM public.voice_actors AS actor
    WHERE lower(actor.firstname) = lower(names.firstname)
      AND lower(actor.lastname) = lower(names.lastname)
  )
  ON CONFLICT (firstname, lastname) DO NOTHING;
  GET DIAGNOSTICS v_inserted_actors = ROW_COUNT;

  WITH raw_credits AS (
    SELECT
      btrim(item.value->>'firstname') AS firstname,
      btrim(item.value->>'lastname') AS lastname,
      (item.value->>'actor_id')::bigint AS actor_id,
      NULLIF(item.value->>'character_id', '')::bigint AS character_id,
      NULLIF(item.value->>'character_name', '') AS character_name,
      NULLIF(item.value->>'performance', '') AS incoming_performance,
      COALESCE(NULLIF(item.value->>'performance', ''), 'dialogues') AS performance,
      item.ordinal,
      public.work_role_identity_key(NULLIF(item.value->>'character_id', '')::bigint,
        NULLIF(item.value->>'character_name', '')) AS role_key
    FROM jsonb_array_elements(p_credits) WITH ORDINALITY AS item(value, ordinal)
  ), credits AS (
    SELECT DISTINCT ON (
      lower(firstname), lower(lastname), actor_id,
      COALESCE(role_key, 'ambiguous:' || ordinal::text)
    ) *
    FROM raw_credits
    ORDER BY lower(firstname), lower(lastname), actor_id,
      COALESCE(role_key, 'ambiguous:' || ordinal::text), ordinal DESC
  ), actor_resolved AS (
    SELECT credits.*, actor.id AS voice_actor_id,
      row_number() OVER (
        PARTITION BY actor.id, credits.actor_id, credits.role_key
        ORDER BY credits.ordinal
      ) AS match_ordinal
    FROM credits
    JOIN LATERAL (
      SELECT candidate.id FROM public.voice_actors AS candidate
      WHERE lower(candidate.firstname) = lower(credits.firstname)
        AND lower(candidate.lastname) = lower(credits.lastname)
      ORDER BY (candidate.firstname = credits.firstname AND candidate.lastname = credits.lastname) DESC,
        candidate.id
      LIMIT 1
    ) AS actor ON true
  ), resolved AS (
    SELECT credits.*, existing.id AS existing_work_id
    FROM actor_resolved AS credits
    LEFT JOIN LATERAL (
      SELECT candidate.id FROM public.work AS candidate
      WHERE candidate.dubbing_project_id = v_project_id
        AND candidate.voice_actor_id = credits.voice_actor_id
        AND candidate.actor_id = credits.actor_id
        AND public.work_role_identity_key(candidate.character_id, candidate.character_name)
          IS NOT DISTINCT FROM credits.role_key
      ORDER BY candidate.id
      OFFSET (credits.match_ordinal - 1)
      LIMIT 1
    ) AS existing ON true
  ), inserted AS (
    INSERT INTO public.work(
      dubbing_project_id, voice_actor_id, actor_id, character_id, character_name, performance
    )
    SELECT v_project_id, resolved.voice_actor_id, resolved.actor_id, resolved.character_id,
      resolved.character_name, resolved.performance
    FROM resolved
    WHERE resolved.existing_work_id IS NULL
    ORDER BY resolved.actor_id, resolved.voice_actor_id, resolved.role_key, resolved.match_ordinal
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  SELECT count(*) FILTER (WHERE resolved.existing_work_id IS NOT NULL),
    count(*) FILTER (
      WHERE existing.id IS NOT NULL
        AND (
          (resolved.incoming_performance IS NOT NULL AND existing.performance IS DISTINCT FROM resolved.incoming_performance)
          OR (resolved.character_id IS NOT NULL AND existing.character_id IS DISTINCT FROM resolved.character_id)
          OR (resolved.character_name IS NOT NULL AND lower(btrim(existing.character_name)) IS DISTINCT FROM lower(btrim(resolved.character_name)))
        )
    ),
    (SELECT count(*) FROM inserted)
  INTO v_overlapped_works, v_mismatched_works, v_inserted_works
  FROM resolved
  LEFT JOIN public.work AS existing ON existing.id = resolved.existing_work_id;

  RETURN jsonb_build_object('new_voice_actors', v_inserted_actors,
    'credits_added', v_inserted_works,
    'credits_overlapped', v_overlapped_works,
    'credits_mismatched', v_mismatched_works);
END;
$$;


REVOKE ALL ON FUNCTION public.apply_extracted_credits(bigint, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_extracted_credits(bigint, text, text, jsonb)
  TO service_role;
