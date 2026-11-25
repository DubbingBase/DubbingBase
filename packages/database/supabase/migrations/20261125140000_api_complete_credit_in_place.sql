-- Lets the API complete a credit in place. A legacy credit can exist without a character name;
-- until now the only API routes either created a new credit or changed the performance, so
-- completing one meant deleting it and losing its id, history and review status.
--
-- The change keys present in p_changes are applied, the others are left alone:
--   performance, character_name, actor_id (cast id), game_character_id.
-- A credit never gets both a cast id and a game character, and a name can be set but not cleared.
-- The credit keeps its review status: completing a credit does not verify or reject it, and a
-- verified (accepted) credit can still only be changed by trusted users.
-- The role-aware duplicate trigger rejects (23505) a result that equals another credit of the
-- same voice actor and cast id, so completing a credit cannot create a duplicate role.
CREATE OR REPLACE FUNCTION public.update_voice_actor_work_credit(
  p_user_id UUID,
  p_request_id UUID,
  p_work_id BIGINT,
  p_expected_updated_at TIMESTAMPTZ,
  p_changes JSONB
)
RETURNS TABLE(work_id BIGINT, audit_log_id UUID, replayed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_work public.work%ROWTYPE;
  v_before public.work%ROWTYPE;
  v_verified BOOLEAN;
  v_existing_audit public.audit_logs%ROWTYPE;
  v_fingerprint TEXT;
  v_audit_id UUID;
  v_media_id BIGINT;
  v_media_kind TEXT;
  v_performance TEXT;
  v_name TEXT;
  v_actor BIGINT;
  v_game_character UUID;
BEGIN
  IF p_user_id IS NULL OR p_request_id IS NULL OR p_work_id IS NULL OR p_work_id <= 0
     OR p_changes IS NULL OR pg_catalog.jsonb_typeof(p_changes) <> 'object'
     OR p_changes = '{}'::JSONB
     OR EXISTS (
       SELECT 1 FROM pg_catalog.jsonb_object_keys(p_changes) AS change(key)
       WHERE change.key NOT IN ('performance', 'character_name', 'actor_id', 'game_character_id')
     ) THEN
    RAISE EXCEPTION 'Voice actor work update fields are invalid' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('voice-work-request:' || p_user_id::TEXT || ':' || p_request_id::TEXT, 0)
  );

  SELECT work.* INTO v_work FROM public.work AS work WHERE work.id = p_work_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work not found' USING ERRCODE = 'P0002';
  END IF;
  v_verified := public.work_contribution_privilege(p_user_id, v_work.voice_actor_id);
  IF v_work.reviewed_status = 'accepted' AND NOT v_verified THEN
    RAISE EXCEPTION 'Verified credits can only be changed by trusted users' USING ERRCODE = '42501';
  END IF;

  v_performance := CASE WHEN p_changes ? 'performance' THEN p_changes ->> 'performance' ELSE v_work.performance END;
  v_name := CASE WHEN p_changes ? 'character_name' THEN p_changes ->> 'character_name' ELSE v_work.character_name END;
  v_actor := CASE WHEN p_changes ? 'actor_id' THEN (p_changes ->> 'actor_id')::BIGINT ELSE v_work.actor_id END;
  v_game_character := CASE WHEN p_changes ? 'game_character_id'
    THEN (p_changes ->> 'game_character_id')::UUID ELSE v_work.game_character_id END;

  -- Only a supplied performance is validated: a credit that already has none can still be completed.
  IF (p_changes ? 'performance' AND (
       v_performance IS NULL
       OR v_performance NOT IN ('dialogues', 'chant', 'dialogues & chant', 'bruitages', 'narration', 'ambiances', 'voice')))
     OR (p_changes ? 'character_name' AND (
       v_name IS NULL OR length(pg_catalog.btrim(v_name)) = 0 OR length(v_name) > 300))
     OR (v_actor IS NOT NULL AND v_actor <= 0)
     OR (v_game_character IS NOT NULL AND v_actor IS NOT NULL) THEN
    RAISE EXCEPTION 'Voice actor work update fields are invalid' USING ERRCODE = '22023';
  END IF;

  SELECT project.media_id, media.kind INTO v_media_id, v_media_kind
  FROM public.dubbing_projects AS project
  JOIN public.media AS media ON media.id = project.media_id
  WHERE project.id = v_work.dubbing_project_id;
  IF (v_actor IS NOT NULL AND v_media_kind NOT IN ('movie', 'tv', 'video_game'))
     OR (v_game_character IS NOT NULL AND v_media_kind <> 'video_game') THEN
    RAISE EXCEPTION 'Voice actor work update fields are invalid' USING ERRCODE = '22023';
  END IF;
  IF v_game_character IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.game_characters AS character
    WHERE character.id = v_game_character AND character.media_id = v_media_id
  ) THEN
    RAISE EXCEPTION 'Game character does not belong to this game' USING ERRCODE = '23503';
  END IF;

  v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'operation', 'update_voice_actor_work_credit',
    'work_id', p_work_id,
    'expected_updated_at', p_expected_updated_at,
    'changes', p_changes
  )::TEXT);
  SELECT audit.* INTO v_existing_audit
  FROM public.audit_logs AS audit
  WHERE audit.user_id = p_user_id AND audit.request_id = p_request_id;
  IF FOUND THEN
    IF v_existing_audit.request_fingerprint IS DISTINCT FROM v_fingerprint
       OR v_existing_audit.entity_type <> 'work'
       OR v_existing_audit.action <> 'update' THEN
      RAISE EXCEPTION 'Request id was already used with different work data' USING ERRCODE = '23505';
    END IF;
    RETURN QUERY SELECT p_work_id, v_existing_audit.id, TRUE;
    RETURN;
  END IF;

  IF v_work.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Work changed since it was loaded' USING ERRCODE = 'PT409';
  END IF;
  v_before := v_work;
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', p_user_id::TEXT, TRUE);
  PERFORM pg_catalog.set_config('app.controlled_voice_actor_work_mutation', 'true', TRUE);
  UPDATE public.work AS work
  SET performance = v_performance,
      character_name = v_name,
      actor_id = v_actor,
      game_character_id = v_game_character,
      updated_by = p_user_id
  WHERE work.id = p_work_id
  RETURNING work.* INTO v_work;

  v_audit_id := public.audit_voice_actor_work_mutation(
    p_user_id, p_request_id, v_fingerprint, v_work.id, 'update',
    pg_catalog.to_jsonb(v_before), pg_catalog.to_jsonb(v_work),
    pg_catalog.jsonb_build_object('voice_actor_id', v_work.voice_actor_id)
  );
  RETURN QUERY SELECT v_work.id, v_audit_id, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.update_voice_actor_work_credit(UUID, UUID, BIGINT, TIMESTAMPTZ, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_voice_actor_work_credit(UUID, UUID, BIGINT, TIMESTAMPTZ, JSONB)
  TO service_role;

-- `update` items now carry work_id, expected_updated_at and any of performance, character_name,
-- actor_id and game_character_id; the rest of the function is unchanged.
CREATE OR REPLACE FUNCTION public.api_mutate_credits(p_user_id UUID, p_operation TEXT, p_items JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item JSONB;
  v_index INTEGER := 0;
  v_row RECORD;
  v_created BOOLEAN;
  v_after JSONB;
  v_results JSONB := '[]'::JSONB;
BEGIN
  IF p_user_id IS NULL
     OR p_operation IS NULL OR p_operation NOT IN ('create', 'update')
     OR p_items IS NULL OR pg_catalog.jsonb_typeof(p_items) <> 'array'
     OR pg_catalog.jsonb_array_length(p_items) NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'Credit mutation request is invalid' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.set_config('app.mutation_origin', 'api', TRUE);

  FOR v_item IN SELECT item.value FROM pg_catalog.jsonb_array_elements(p_items) AS item(value) LOOP
    BEGIN
      v_created := FALSE;
      IF p_operation = 'create' THEN
        SELECT * INTO v_row FROM public.create_voice_actor_work_link(
          p_user_id, pg_catalog.gen_random_uuid(),
          (v_item ->> 'voice_actor_id')::BIGINT,
          (v_item ->> 'content_id')::BIGINT,
          v_item ->> 'content_type',
          v_item ->> 'language',
          (v_item ->> 'actor_person_id')::BIGINT,
          (v_item ->> 'game_character_id')::UUID,
          v_item ->> 'character_name',
          v_item ->> 'performance'
        );
        SELECT audit.action = 'create', audit.new_value INTO v_created, v_after
        FROM public.audit_logs AS audit WHERE audit.id = v_row.audit_log_id;
      ELSIF p_operation = 'update' THEN
        SELECT * INTO v_row FROM public.update_voice_actor_work_credit(
          p_user_id, pg_catalog.gen_random_uuid(),
          (v_item ->> 'work_id')::BIGINT,
          (v_item ->> 'expected_updated_at')::TIMESTAMPTZ,
          v_item - 'work_id' - 'expected_updated_at'
        );
        SELECT audit.new_value INTO v_after
        FROM public.audit_logs AS audit WHERE audit.id = v_row.audit_log_id;
      END IF;
      v_results := v_results || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object('work_id', v_row.work_id, 'created', v_created, 'after', v_after)
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Credit % was rejected', v_index
        USING ERRCODE = SQLSTATE, HINT = v_index::TEXT;
    END;
    v_index := v_index + 1;
  END LOOP;
  RETURN v_results;
END;
$$;
