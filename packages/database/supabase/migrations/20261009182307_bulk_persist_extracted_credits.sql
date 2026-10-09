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
BEGIN
  IF p_content_id IS NULL OR p_content_id <= 0
    OR p_content_type IS NULL OR p_content_type NOT IN ('movie', 'tv', 'video_game')
    OR p_dubbing_language IS NULL
    OR NOT public.is_valid_dubbing_language(p_dubbing_language) THEN
    RAISE EXCEPTION 'Invalid extracted credit batch' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_credits) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Extracted credits must be a JSON array' USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(p_credits) > 1000 THEN
    RAISE EXCEPTION 'Extracted credit batch is too large' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_credits) AS item(value)
    WHERE jsonb_typeof(item.value) IS DISTINCT FROM 'object'
      OR NULLIF(btrim(item.value->>'firstname'), '') IS NULL
      OR NULLIF(btrim(item.value->>'lastname'), '') IS NULL
      OR COALESCE(item.value->>'actor_id', '') !~ '^[0-9]+$'
      OR (item.value->>'actor_id')::numeric <= 0
      OR (item.value ? 'character_id'
          AND item.value->>'character_id' IS NOT NULL
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

  -- Lock normalized names in stable order so concurrent bulk calls create one actor.
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
  SELECT names.firstname, names.lastname
  FROM names
  WHERE NOT EXISTS (
    SELECT 1 FROM public.voice_actors AS actor
    WHERE lower(actor.firstname) = lower(names.firstname)
      AND lower(actor.lastname) = lower(names.lastname)
  )
  ON CONFLICT (firstname, lastname) DO NOTHING;
  GET DIAGNOSTICS v_inserted_actors = ROW_COUNT;

  WITH credits AS (
    SELECT DISTINCT ON (
      lower(btrim(item.value->>'firstname')),
      lower(btrim(item.value->>'lastname')),
      (item.value->>'actor_id')::bigint,
      NULLIF(item.value->>'character_id', '')::bigint
    )
      btrim(item.value->>'firstname') AS firstname,
      btrim(item.value->>'lastname') AS lastname,
      (item.value->>'actor_id')::bigint AS actor_id,
      NULLIF(item.value->>'character_id', '')::bigint AS character_id,
      NULLIF(item.value->>'character_name', '') AS character_name,
      NULLIF(item.value->>'performance', '') AS performance
    FROM jsonb_array_elements(p_credits) WITH ORDINALITY AS item(value, ordinal)
    ORDER BY lower(btrim(item.value->>'firstname')),
             lower(btrim(item.value->>'lastname')),
             (item.value->>'actor_id')::bigint,
             NULLIF(item.value->>'character_id', '')::bigint,
             btrim(item.value->>'firstname'), btrim(item.value->>'lastname'),
             item.ordinal DESC
  ), resolved AS (
    SELECT credits.*, actor.id AS voice_actor_id, existing.id AS existing_work_id
    FROM credits
    JOIN LATERAL (
      SELECT candidate.id
      FROM public.voice_actors AS candidate
      WHERE lower(candidate.firstname) = lower(credits.firstname)
        AND lower(candidate.lastname) = lower(credits.lastname)
      ORDER BY (candidate.firstname = credits.firstname
        AND candidate.lastname = credits.lastname) DESC, candidate.id
      LIMIT 1
    ) AS actor ON true
    LEFT JOIN LATERAL (
      SELECT candidate.id
      FROM public.work AS candidate
      WHERE candidate.dubbing_project_id = v_project_id
        AND candidate.voice_actor_id = actor.id
        AND candidate.actor_id = credits.actor_id
        AND (credits.character_id IS NULL OR candidate.character_id = credits.character_id)
      ORDER BY candidate.id
      LIMIT 1
    ) AS existing ON true
  )
  UPDATE public.work AS work
  SET performance = resolved.performance,
      character_name = COALESCE(resolved.character_name, work.character_name)
  FROM resolved
  WHERE work.id = resolved.existing_work_id
    AND work.status = 'suggestion';

  WITH credits AS (
    SELECT DISTINCT ON (
      lower(btrim(item.value->>'firstname')),
      lower(btrim(item.value->>'lastname')),
      (item.value->>'actor_id')::bigint,
      NULLIF(item.value->>'character_id', '')::bigint
    )
      btrim(item.value->>'firstname') AS firstname,
      btrim(item.value->>'lastname') AS lastname,
      (item.value->>'actor_id')::bigint AS actor_id,
      NULLIF(item.value->>'character_id', '')::bigint AS character_id,
      NULLIF(item.value->>'character_name', '') AS character_name,
      COALESCE(NULLIF(item.value->>'performance', ''), 'dialogues') AS performance
    FROM jsonb_array_elements(p_credits) WITH ORDINALITY AS item(value, ordinal)
    ORDER BY lower(btrim(item.value->>'firstname')),
             lower(btrim(item.value->>'lastname')),
             (item.value->>'actor_id')::bigint,
             NULLIF(item.value->>'character_id', '')::bigint,
             btrim(item.value->>'firstname'), btrim(item.value->>'lastname'),
             item.ordinal DESC
  ), resolved AS (
    SELECT credits.*, actor.id AS voice_actor_id, existing.id AS existing_work_id
    FROM credits
    JOIN LATERAL (
      SELECT candidate.id
      FROM public.voice_actors AS candidate
      WHERE lower(candidate.firstname) = lower(credits.firstname)
        AND lower(candidate.lastname) = lower(credits.lastname)
      ORDER BY (candidate.firstname = credits.firstname
        AND candidate.lastname = credits.lastname) DESC, candidate.id
      LIMIT 1
    ) AS actor ON true
    LEFT JOIN LATERAL (
      SELECT candidate.id
      FROM public.work AS candidate
      WHERE candidate.dubbing_project_id = v_project_id
        AND candidate.voice_actor_id = actor.id
        AND candidate.actor_id = credits.actor_id
        AND (credits.character_id IS NULL OR candidate.character_id = credits.character_id)
      ORDER BY candidate.id
      LIMIT 1
    ) AS existing ON true
  )
  INSERT INTO public.work(
    dubbing_project_id, voice_actor_id, actor_id, character_id,
    character_name, performance
  )
  SELECT v_project_id, resolved.voice_actor_id, resolved.actor_id,
         resolved.character_id, resolved.character_name, resolved.performance
  FROM resolved
  WHERE resolved.existing_work_id IS NULL
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'new_voice_actors', v_inserted_actors,
    'credits_added', jsonb_array_length(p_credits)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_extracted_credits(bigint, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_extracted_credits(bigint, text, text, jsonb)
  TO service_role;

NOTIFY pgrst, 'reload schema';
