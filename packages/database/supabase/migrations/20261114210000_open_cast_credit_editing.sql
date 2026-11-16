-- Who may validate a cast credit without review: admins, accounts an admin flagged as
-- trusted, and the user linked to the credited voice actor. Everyone else who passes
-- assert_contributor may still add or edit credits; those stay 'waiting' until validated.
CREATE OR REPLACE FUNCTION public.work_contribution_privilege(
  p_user_id UUID,
  p_voice_actor_id BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_metadata JSONB;
BEGIN
  PERFORM private.assert_contributor(p_user_id);
  IF p_voice_actor_id IS NULL THEN
    RAISE EXCEPTION 'A voice actor is required for this operation' USING ERRCODE = '42501';
  END IF;

  SELECT users.raw_app_meta_data INTO v_metadata FROM auth.users AS users WHERE users.id = p_user_id;
  IF COALESCE(v_metadata ->> 'role' = 'admin', FALSE)
     OR COALESCE(v_metadata ->> 'trusted' = 'true', FALSE) THEN
    RETURN TRUE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_voice_actor_links AS link
    WHERE link.user_id = p_user_id AND link.voice_actor_id = p_voice_actor_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.work_contribution_privilege(UUID, BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.find_or_create_dubbing_project(
  p_actor_id UUID,
  p_voice_actor_id BIGINT,
  p_request_id UUID,
  p_content_id BIGINT,
  p_content_type TEXT,
  p_language TEXT
)
RETURNS TABLE(project_id BIGINT, audit_log_id UUID, replayed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_role TEXT;
  v_project public.dubbing_projects%ROWTYPE;
  v_existing_audit public.audit_logs%ROWTYPE;
  v_fingerprint TEXT;
  v_audit_id UUID;
BEGIN
  SELECT users.raw_app_meta_data ->> 'role'
  INTO v_actor_role
  FROM auth.users AS users
  WHERE users.id = p_actor_id;
  IF p_actor_id IS NULL OR p_request_id IS NULL
     OR p_content_id IS NULL OR p_content_id = 0
     OR p_content_type IS NULL
     OR p_content_type NOT IN ('movie', 'tv', 'video_game', 'audiobook', 'podcast', 'advertisement', 'toy')
     OR (p_content_id < 0 AND p_content_type NOT IN ('advertisement', 'toy'))
     OR p_language IS NULL OR NOT public.is_valid_dubbing_language(p_language) THEN
    RAISE EXCEPTION 'Dubbing project references are invalid' USING ERRCODE = '22023';
  END IF;
  IF p_voice_actor_id IS NOT NULL
     AND current_setting('app.controlled_voice_actor_work_mutation', TRUE) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Voice actor project resolution must use a controlled work operation'
      USING ERRCODE = '42501';
  END IF;
  PERFORM private.assert_contributor(p_actor_id);
  IF v_actor_role IS DISTINCT FROM 'admin' AND p_voice_actor_id IS NULL THEN
    RAISE EXCEPTION 'A voice actor is required to resolve a dubbing project'
      USING ERRCODE = '42501';
  END IF;
  IF p_voice_actor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.voice_actors AS voice_actor WHERE voice_actor.id = p_voice_actor_id
  ) THEN
    RAISE EXCEPTION 'Selected voice actor does not exist' USING ERRCODE = '23503';
  END IF;
  IF p_content_type IN ('advertisement', 'toy') AND NOT EXISTS (
    SELECT 1 FROM public.dubbing_projects AS internal_project
    WHERE internal_project.content_id = p_content_id
      AND internal_project.content_type = p_content_type
  ) THEN
    RAISE EXCEPTION 'Internal media must be created before a voice actor can link it'
      USING ERRCODE = '23503';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_actor_id::TEXT || ':' || p_request_id::TEXT, 0)
  );
  v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'voice_actor_id', p_voice_actor_id,
    'content_id', p_content_id,
    'content_type', p_content_type,
    'language', p_language
  )::TEXT);
  SELECT audit.* INTO v_existing_audit
  FROM public.audit_logs AS audit
  WHERE audit.user_id = p_actor_id AND audit.request_id = p_request_id;
  IF FOUND THEN
    IF v_existing_audit.request_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'Request id was already used with different project data'
        USING ERRCODE = '23505';
    END IF;
    SELECT project.* INTO v_project
    FROM public.dubbing_projects AS project
    WHERE project.id = v_existing_audit.entity_id::BIGINT;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The project created by this request no longer exists'
        USING ERRCODE = '55000';
    END IF;
    RETURN QUERY SELECT v_project.id, v_existing_audit.id, TRUE;
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_content_type || ':' || p_content_id::TEXT || ':' || p_language, 0
    )
  );
  SELECT project.* INTO v_project
  FROM public.dubbing_projects AS project
  WHERE project.content_id = p_content_id
    AND project.content_type = p_content_type
    AND project.language = p_language
  FOR UPDATE;
  IF FOUND THEN
    RETURN QUERY SELECT v_project.id, NULL::UUID, FALSE;
    RETURN;
  END IF;

  INSERT INTO public.dubbing_projects(content_id, content_type, language)
  VALUES (p_content_id, p_content_type, p_language)
  RETURNING * INTO v_project;
  v_audit_id := pg_catalog.gen_random_uuid();
  INSERT INTO public.audit_logs (
    id, user_id, entity_type, entity_id, action,
    previous_value, new_value, changed_fields,
    request_id, request_fingerprint, metadata
  ) VALUES (
    v_audit_id, p_actor_id, 'dubbing_project', v_project.id::TEXT, 'create',
    pg_catalog.jsonb_build_object('project', NULL, 'crew', '[]'::JSONB, 'cast', '[]'::JSONB),
    pg_catalog.jsonb_build_object('project', pg_catalog.to_jsonb(v_project), 'crew', '[]'::JSONB, 'cast', '[]'::JSONB),
    ARRAY[]::TEXT[], p_request_id, v_fingerprint,
    pg_catalog.jsonb_build_object(
      'source', 'find_or_create_dubbing_project',
      'voice_actor_id', p_voice_actor_id,
      'transaction_id', pg_catalog.pg_current_xact_id()::TEXT
    )
  );
  RETURN QUERY SELECT v_project.id, v_audit_id, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.find_or_create_dubbing_project(UUID, BIGINT, UUID, BIGINT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_or_create_dubbing_project(UUID, BIGINT, UUID, BIGINT, TEXT, TEXT)
  TO service_role;

CREATE OR REPLACE FUNCTION public.create_voice_actor_work_link(
  p_user_id UUID,
  p_request_id UUID,
  p_voice_actor_id BIGINT,
  p_content_id BIGINT,
  p_content_type TEXT,
  p_language TEXT,
  p_actor_person_id BIGINT,
  p_game_character_id UUID,
  p_character_name TEXT,
  p_performance TEXT
)
RETURNS TABLE(work_id BIGINT, project_id BIGINT, audit_log_id UUID, replayed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project_id BIGINT;
  v_verified BOOLEAN;
  v_project_count BIGINT;
  v_project_request_id UUID;
  v_role TEXT;
  v_role_lock BIGINT;
  v_fingerprint TEXT;
  v_match_count BIGINT;
  v_work public.work%ROWTYPE;
  v_existing_audit public.audit_logs%ROWTYPE;
  v_audit_id UUID;
BEGIN
  IF p_user_id IS NULL OR p_request_id IS NULL
     OR p_voice_actor_id IS NULL OR p_voice_actor_id <= 0
     OR p_content_id IS NULL OR p_content_id = 0
     OR p_content_type IS NULL
     OR p_content_type NOT IN ('movie', 'tv', 'video_game', 'audiobook', 'podcast', 'advertisement', 'toy')
     OR (p_content_id < 0 AND p_content_type NOT IN ('advertisement', 'toy'))
     OR p_language IS NULL OR NOT public.is_valid_dubbing_language(p_language)
     OR (p_actor_person_id IS NOT NULL AND p_actor_person_id <= 0)
     OR (p_game_character_id IS NOT NULL AND p_content_type <> 'video_game')
     OR p_character_name IS NULL OR length(pg_catalog.btrim(p_character_name)) = 0
     OR length(p_character_name) > 300
     OR p_performance IS NULL
     OR p_performance NOT IN ('dialogues', 'chant', 'dialogues & chant', 'bruitages', 'narration', 'ambiances', 'voice') THEN
    RAISE EXCEPTION 'Voice actor work link fields are invalid' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('voice-work-request:' || p_user_id::TEXT || ':' || p_request_id::TEXT, 0)
  );
  v_verified := public.work_contribution_privilege(p_user_id, p_voice_actor_id);
  IF NOT EXISTS (
    SELECT 1 FROM public.voice_actors AS voice_actor WHERE voice_actor.id = p_voice_actor_id
  ) THEN
    RAISE EXCEPTION 'Voice actor does not exist' USING ERRCODE = '23503';
  END IF;
  IF p_game_character_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.game_characters AS character
    WHERE character.id = p_game_character_id AND character.igdb_game_id = p_content_id
  ) THEN
    RAISE EXCEPTION 'Game character does not belong to this game' USING ERRCODE = '23503';
  END IF;

  v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'operation', 'create_voice_actor_work_link',
    'voice_actor_id', p_voice_actor_id,
    'content_id', p_content_id,
    'content_type', p_content_type,
    'language', p_language,
    'actor_person_id', p_actor_person_id,
    'game_character_id', p_game_character_id,
    'character_name', p_character_name,
    'performance', p_performance
  )::TEXT);
  SELECT audit.* INTO v_existing_audit
  FROM public.audit_logs AS audit
  WHERE audit.user_id = p_user_id AND audit.request_id = p_request_id;
  IF FOUND THEN
    IF v_existing_audit.request_fingerprint IS DISTINCT FROM v_fingerprint
       OR v_existing_audit.entity_type <> 'work'
       OR v_existing_audit.action NOT IN ('create', 'ensure_link') THEN
      RAISE EXCEPTION 'Request id was already used with different work data'
        USING ERRCODE = '23505';
    END IF;
    SELECT work.* INTO v_work
    FROM public.work AS work
    WHERE work.id = v_existing_audit.entity_id::BIGINT;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The work created by this request no longer exists'
        USING ERRCODE = '55000';
    END IF;
    RETURN QUERY SELECT v_work.id, v_work.dubbing_project_id, v_existing_audit.id, TRUE;
    RETURN;
  END IF;

  v_project_request_id := pg_catalog.md5(
    'voice-actor-work-project:' || p_user_id::TEXT || ':' || p_request_id::TEXT
  )::UUID;
  PERFORM pg_catalog.set_config('app.controlled_voice_actor_work_mutation', 'true', TRUE);
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', p_user_id::TEXT, TRUE);
  SELECT project.project_id INTO v_project_id
  FROM public.find_or_create_dubbing_project(
    p_user_id, p_voice_actor_id, v_project_request_id,
    p_content_id, p_content_type, p_language
  ) AS project;

  SELECT count(*) INTO v_project_count
  FROM public.dubbing_projects AS project
  WHERE project.content_id = p_content_id
    AND project.content_type = p_content_type
    AND project.language = p_language;
  IF v_project_count <> 1 OR NOT EXISTS (
    SELECT 1 FROM public.dubbing_projects AS project
    WHERE project.id = v_project_id
      AND project.content_id = p_content_id
      AND project.content_type = p_content_type
      AND project.language = p_language
  ) THEN
    RAISE EXCEPTION 'Dubbing project identity is ambiguous or invalid'
      USING ERRCODE = '55000';
  END IF;

  v_role := public.work_assignment_role_identity_key(p_game_character_id, NULL::BIGINT, p_character_name);
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'A character name is required to identify this role'
      USING ERRCODE = '22023';
  END IF;
  v_role_lock := pg_catalog.hashtextextended(
    pg_catalog.jsonb_build_array(v_project_id, p_actor_person_id, p_voice_actor_id, v_role)::TEXT,
    0
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(v_role_lock);

  SELECT count(*) INTO v_match_count
  FROM public.work AS work
  WHERE work.dubbing_project_id = v_project_id
    AND work.actor_id IS NOT DISTINCT FROM p_actor_person_id
    AND work.voice_actor_id = p_voice_actor_id
    AND public.work_assignment_role_identity_key(work.game_character_id, work.character_id, work.character_name) = v_role;
  IF v_match_count > 1 THEN
    RAISE EXCEPTION 'Multiple work records match this role identity'
      USING ERRCODE = '55000';
  END IF;
  IF v_match_count = 1 THEN
    SELECT work.* INTO v_work
    FROM public.work AS work
    WHERE work.dubbing_project_id = v_project_id
      AND work.actor_id IS NOT DISTINCT FROM p_actor_person_id
      AND work.voice_actor_id = p_voice_actor_id
      AND public.work_assignment_role_identity_key(work.game_character_id, work.character_id, work.character_name) = v_role
    FOR UPDATE;
    v_audit_id := public.audit_voice_actor_work_mutation(
      p_user_id, p_request_id, v_fingerprint, v_work.id, 'ensure_link',
      pg_catalog.to_jsonb(v_work), pg_catalog.to_jsonb(v_work),
      pg_catalog.jsonb_build_object('dubbing_project_id', v_project_id, 'voice_actor_id', p_voice_actor_id)
    );
    RETURN QUERY SELECT v_work.id, v_project_id, v_audit_id, FALSE;
    RETURN;
  END IF;

  INSERT INTO public.work (
    dubbing_project_id, game_character_id, actor_id, voice_actor_id, character_name,
    performance, status, reviewed_status, created_by
  ) VALUES (
    v_project_id, p_game_character_id, p_actor_person_id, p_voice_actor_id, p_character_name,
    p_performance, 'user', CASE WHEN v_verified THEN 'accepted' ELSE 'waiting' END, p_user_id
  )
  RETURNING * INTO v_work;
  v_audit_id := public.audit_voice_actor_work_mutation(
    p_user_id, p_request_id, v_fingerprint, v_work.id, 'create',
    'null'::JSONB, pg_catalog.to_jsonb(v_work),
    pg_catalog.jsonb_build_object('dubbing_project_id', v_project_id, 'voice_actor_id', p_voice_actor_id)
  );
  RETURN QUERY SELECT v_work.id, v_project_id, v_audit_id, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.create_voice_actor_work_link(UUID, UUID, BIGINT, BIGINT, TEXT, TEXT, BIGINT, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_voice_actor_work_link(UUID, UUID, BIGINT, BIGINT, TEXT, TEXT, BIGINT, UUID, TEXT, TEXT)
  TO service_role;

CREATE OR REPLACE FUNCTION public.update_voice_actor_work_performance(
  p_user_id UUID,
  p_request_id UUID,
  p_work_id BIGINT,
  p_expected_updated_at TIMESTAMPTZ,
  p_performance TEXT
)
RETURNS TABLE(work_id BIGINT, audit_log_id UUID, replayed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_work public.work%ROWTYPE;
  v_verified BOOLEAN;
  v_before public.work%ROWTYPE;
  v_existing_audit public.audit_logs%ROWTYPE;
  v_fingerprint TEXT;
  v_audit_id UUID;
BEGIN
  IF p_user_id IS NULL OR p_request_id IS NULL OR p_work_id IS NULL OR p_work_id <= 0
     OR p_performance IS NULL
     OR p_performance NOT IN ('dialogues', 'chant', 'dialogues & chant', 'bruitages', 'narration', 'ambiances', 'voice') THEN
    RAISE EXCEPTION 'Voice actor performance update fields are invalid'
      USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('voice-work-request:' || p_user_id::TEXT || ':' || p_request_id::TEXT, 0)
  );

  SELECT work.* INTO v_work
  FROM public.work AS work
  WHERE work.id = p_work_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work not found' USING ERRCODE = 'P0002';
  END IF;
  v_verified := public.work_contribution_privilege(p_user_id, v_work.voice_actor_id);
  IF v_work.reviewed_status = 'accepted' AND NOT v_verified THEN
    RAISE EXCEPTION 'Verified credits can only be changed by trusted users' USING ERRCODE = '42501';
  END IF;

  v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'operation', 'update_voice_actor_work_performance',
    'work_id', p_work_id,
    'expected_updated_at', p_expected_updated_at,
    'performance', p_performance
  )::TEXT);
  SELECT audit.* INTO v_existing_audit
  FROM public.audit_logs AS audit
  WHERE audit.user_id = p_user_id AND audit.request_id = p_request_id;
  IF FOUND THEN
    IF v_existing_audit.request_fingerprint IS DISTINCT FROM v_fingerprint
       OR v_existing_audit.entity_type <> 'work'
       OR v_existing_audit.action <> 'update' THEN
      RAISE EXCEPTION 'Request id was already used with different work data'
        USING ERRCODE = '23505';
    END IF;
    RETURN QUERY SELECT p_work_id, v_existing_audit.id, TRUE;
    RETURN;
  END IF;

  IF v_work.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Work changed since it was loaded' USING ERRCODE = '40001';
  END IF;
  v_before := v_work;
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', p_user_id::TEXT, TRUE);
  PERFORM pg_catalog.set_config('app.controlled_voice_actor_work_mutation', 'true', TRUE);
  UPDATE public.work AS work
  SET performance = p_performance,
      reviewed_status = CASE WHEN v_verified THEN 'accepted' ELSE 'waiting' END,
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

REVOKE ALL ON FUNCTION public.update_voice_actor_work_performance(UUID, UUID, BIGINT, TIMESTAMPTZ, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_voice_actor_work_performance(UUID, UUID, BIGINT, TIMESTAMPTZ, TEXT)
  TO service_role;

CREATE OR REPLACE FUNCTION public.update_work_review_status_controlled(
  p_actor_id UUID,
  p_request_id UUID,
  p_work_id BIGINT,
  p_expected_updated_at TIMESTAMPTZ,
  p_reviewed_status TEXT
)
RETURNS TABLE(work_id BIGINT, audit_log_id UUID, replayed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_metadata JSONB;
  v_voice_actor_id BIGINT;
  v_voice_actor_link_id UUID;
  v_before public.work%ROWTYPE;
  v_after public.work%ROWTYPE;
  v_existing_audit public.audit_logs%ROWTYPE;
  v_fingerprint TEXT;
  v_audit_log_id UUID;
BEGIN
  IF p_actor_id IS NULL OR p_work_id IS NULL OR p_work_id <= 0
     OR p_expected_updated_at IS NULL
     OR p_reviewed_status IS NULL
     OR p_reviewed_status NOT IN ('waiting', 'accepted', 'rejected') THEN
    RAISE EXCEPTION 'Review status update fields are invalid'
      USING ERRCODE = '22023';
  END IF;

  IF p_request_id IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'work-review-request:' || p_actor_id::TEXT || ':' || p_request_id::TEXT,
        0
      )
    );
  END IF;

  SELECT users.raw_app_meta_data
  INTO v_actor_metadata
  FROM auth.users AS users
  WHERE users.id = p_actor_id
  FOR SHARE OF users;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Authenticated actor was not found' USING ERRCODE = '28000';
  END IF;
  PERFORM private.assert_contributor(p_actor_id);

  SELECT work.* INTO v_before
  FROM public.work AS work
  WHERE work.id = p_work_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work not found' USING ERRCODE = 'P0002';
  END IF;

  IF COALESCE(v_actor_metadata ->> 'role' = 'admin', FALSE)
     OR COALESCE(v_actor_metadata ->> 'trusted' = 'true', FALSE) THEN
    NULL;
  ELSE
    v_voice_actor_id := v_before.voice_actor_id;
    IF v_voice_actor_id IS NULL THEN
      RAISE EXCEPTION 'Review status update is not authorized' USING ERRCODE = '42501';
    END IF;

    SELECT link.id INTO v_voice_actor_link_id
    FROM public.user_voice_actor_links AS link
    WHERE link.user_id = p_actor_id
      AND link.voice_actor_id = v_voice_actor_id
    FOR KEY SHARE OF link;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Review status update is not authorized' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_request_id IS NOT NULL THEN
    v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
      'operation', 'update_work_review_status',
      'work_id', p_work_id,
      'reviewed_status', p_reviewed_status
    )::TEXT);

    SELECT audit.* INTO v_existing_audit
    FROM public.audit_logs AS audit
    WHERE audit.user_id = p_actor_id
      AND audit.request_id = p_request_id;
    IF FOUND THEN
      IF v_existing_audit.request_fingerprint IS DISTINCT FROM v_fingerprint
         OR v_existing_audit.entity_type <> 'work'
         OR v_existing_audit.entity_id <> p_work_id::TEXT
         OR v_existing_audit.action <> 'update_review_status' THEN
        RAISE EXCEPTION 'Request id was already used with different work data'
          USING ERRCODE = '23505';
      END IF;
      RETURN QUERY SELECT p_work_id, v_existing_audit.id, TRUE;
      RETURN;
    END IF;
  END IF;

  IF v_before.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Work changed since it was loaded' USING ERRCODE = '40001';
  END IF;

  IF v_before.reviewed_status IS NOT DISTINCT FROM p_reviewed_status
     AND p_request_id IS NULL THEN
    -- Legacy callers without retry metadata remain compatible. A same-value
    -- retry has no effect and needs no second audit event.
    RETURN QUERY SELECT p_work_id, NULL::UUID, FALSE;
    RETURN;
  ELSIF v_before.reviewed_status IS NOT DISTINCT FROM p_reviewed_status THEN
    v_after := v_before;
  ELSE
    PERFORM pg_catalog.set_config('request.jwt.claim.sub', p_actor_id::TEXT, TRUE);
    PERFORM pg_catalog.set_config('app.controlled_voice_actor_work_mutation', 'true', TRUE);
    UPDATE public.work AS work
    SET reviewed_status = p_reviewed_status,
        updated_by = p_actor_id
    WHERE work.id = p_work_id
    RETURNING work.* INTO v_after;
  END IF;

  v_audit_log_id := public.audit_voice_actor_work_mutation(
    p_actor_id,
    p_request_id,
    v_fingerprint,
    p_work_id,
    'update_review_status',
    pg_catalog.to_jsonb(v_before),
    pg_catalog.to_jsonb(v_after),
    pg_catalog.jsonb_build_object('reviewed_status', p_reviewed_status)
  );

  RETURN QUERY SELECT p_work_id, v_audit_log_id, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.update_work_review_status_controlled(UUID, UUID, BIGINT, TIMESTAMPTZ, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_work_review_status_controlled(UUID, UUID, BIGINT, TIMESTAMPTZ, TEXT)
  TO service_role;
