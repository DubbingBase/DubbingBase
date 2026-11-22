CREATE FUNCTION public.save_dubbing_project_editor_with_characters(
  p_actor_id UUID,
  p_request_id UUID,
  p_project_id BIGINT,
  p_expected_updated_at TIMESTAMP WITHOUT TIME ZONE,
  p_project JSONB,
  p_crew JSONB,
  p_cast JSONB,
  p_new_game_characters JSONB
)
RETURNS TABLE(project_id BIGINT, updated_at TIMESTAMP WITHOUT TIME ZONE, audit_log_id UUID, replayed BOOLEAN)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_draft RECORD;
  v_character_id UUID;
  v_created_ids JSONB := '{}'::JSONB;
  v_cast JSONB;
BEGIN
  IF p_project ->> 'content_type' IS DISTINCT FROM 'video_game'
     OR jsonb_typeof(p_cast) IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_new_game_characters) IS DISTINCT FROM 'object'
     OR p_new_game_characters = '{}'::JSONB THEN
    RAISE EXCEPTION 'New game characters require a video game cast'
      USING ERRCODE = '22023';
  END IF;

  -- Stable draft IDs are creation request IDs. Acquire their audit locks in order
  -- and let both writers use their existing authorization and replay checks.
  FOR v_draft IN SELECT key AS id, value AS name FROM jsonb_each(p_new_game_characters) ORDER BY key
  LOOP
    IF v_draft.id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       OR v_draft.id = p_request_id::TEXT
       OR jsonb_typeof(v_draft.name) IS DISTINCT FROM 'string'
       OR NOT p_cast @> jsonb_build_array(jsonb_build_object('game_character_id', v_draft.id))
       OR EXISTS (
         SELECT 1 FROM jsonb_array_elements(p_cast) AS item(value)
         WHERE item.value ->> 'game_character_id' = v_draft.id
           AND (item.value ->> 'character_id' IS NOT NULL
                OR item.value -> 'character_name' IS DISTINCT FROM v_draft.name)
       ) THEN
      RAISE EXCEPTION 'Invalid assignment for a new game character'
        USING ERRCODE = '22023';
    END IF;

    SELECT created.game_character_id INTO STRICT v_character_id
    FROM public.create_game_character(
      p_actor_id, v_draft.id::UUID, (p_project ->> 'content_id')::BIGINT, v_draft.name #>> '{}'
    ) AS created;
    v_created_ids := v_created_ids || jsonb_build_object(v_draft.id, v_character_id);
  END LOOP;

  SELECT jsonb_agg(
    CASE WHEN v_created_ids ? (item.value ->> 'game_character_id')
      THEN jsonb_set(item.value, '{game_character_id}', v_created_ids -> (item.value ->> 'game_character_id'))
      ELSE item.value END
    ORDER BY item.position
  ) INTO v_cast
  FROM jsonb_array_elements(p_cast) WITH ORDINALITY AS item(value, position);

  -- A save error rolls back both the new characters and their audit entries.
  RETURN QUERY SELECT * FROM public.save_dubbing_project_editor(
    p_actor_id, p_request_id, p_project_id, p_expected_updated_at, p_project, p_crew, v_cast
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_dubbing_project_editor_with_characters(
  UUID, UUID, BIGINT, TIMESTAMP WITHOUT TIME ZONE, JSONB, JSONB, JSONB, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_dubbing_project_editor_with_characters(
  UUID, UUID, BIGINT, TIMESTAMP WITHOUT TIME ZONE, JSONB, JSONB, JSONB, JSONB
) TO service_role;
