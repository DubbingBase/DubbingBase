-- Keep direct service-role writes from the legacy self-link endpoints from
-- bypassing the transactional operations below. The existing credits importer
-- writes validated rows and remains compatible with this scoped guard.
CREATE OR REPLACE FUNCTION public.guard_voice_actor_work_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'INSERT'
     AND NEW.voice_actor_id IS NOT NULL
     AND NEW.status = 'user' THEN
    RAISE EXCEPTION 'Voice actor work links must use a controlled operation'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE'
     AND (OLD.voice_actor_id IS NOT NULL OR NEW.voice_actor_id IS NOT NULL)
     AND NEW.performance IS DISTINCT FROM OLD.performance THEN
    -- process-credits is a separate admin-only import path that sets these
    -- three fields together. Keep that existing writer working until its
    -- dedicated audited import slice; reject performance-only/editor writes.
    IF current_user = 'service_role'
       AND NEW.status = 'validated'
       AND (to_jsonb(NEW) - ARRAY['performance', 'status', 'character_name', 'updated_at', 'updated_by']::TEXT[])
         IS NOT DISTINCT FROM
           (to_jsonb(OLD) - ARRAY['performance', 'status', 'character_name', 'updated_at', 'updated_by']::TEXT[]) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Voice actor performance updates must use a controlled operation'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' AND OLD.voice_actor_id IS NOT NULL THEN
    RAISE EXCEPTION 'Voice actor work deletion must use a controlled operation'
      USING ERRCODE = '42501';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_voice_actor_work_mutation()
  FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS guard_voice_actor_work_mutation ON public.work;
CREATE TRIGGER guard_voice_actor_work_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON public.work
  FOR EACH ROW EXECUTE FUNCTION public.guard_voice_actor_work_mutation();

-- Free-text character roles may not have an upstream actor id. The generated
-- schema and current editor contracts already model this field as nullable.
ALTER TABLE public.work ALTER COLUMN actor_id DROP NOT NULL;

-- The old route first called find_or_create_dubbing_project in a separate
-- request, then inserted work. Require the transactional T08 caller whenever
-- that helper is asked to resolve a voice-actor project. The credits importer
-- passes NULL for p_voice_actor_id and keeps its existing behavior.
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
  IF v_actor_role IS DISTINCT FROM 'admin' AND (
    p_voice_actor_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.user_voice_actor_links AS link
      WHERE link.user_id = p_actor_id AND link.voice_actor_id = p_voice_actor_id
    )
  ) THEN
    RAISE EXCEPTION 'The actor does not own the selected voice actor'
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

CREATE OR REPLACE FUNCTION public.require_voice_actor_work_permission(
  p_user_id UUID,
  p_voice_actor_id BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role TEXT;
  v_link_id UUID;
BEGIN
  SELECT users.raw_app_meta_data ->> 'role'
  INTO v_role
  FROM auth.users AS users
  WHERE users.id = p_user_id
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Authenticated actor not found' USING ERRCODE = '42501';
  END IF;

  IF v_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  IF p_voice_actor_id IS NULL THEN
    RAISE EXCEPTION 'A voice actor is required for this operation'
      USING ERRCODE = '42501';
  END IF;
  SELECT link.id
  INTO v_link_id
  FROM public.user_voice_actor_links AS link
  WHERE link.user_id = p_user_id
    AND link.voice_actor_id = p_voice_actor_id
  FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The actor does not own this voice actor'
      USING ERRCODE = '42501';
  END IF;
  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.require_voice_actor_work_permission(UUID, BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.audit_voice_actor_work_mutation(
  p_user_id UUID,
  p_request_id UUID,
  p_request_fingerprint TEXT,
  p_work_id BIGINT,
  p_action TEXT,
  p_before JSONB,
  p_after JSONB,
  p_metadata JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_audit_id UUID := pg_catalog.gen_random_uuid();
BEGIN
  INSERT INTO public.audit_logs (
    id, user_id, entity_type, entity_id, action,
    previous_value, new_value, changed_fields,
    request_id, request_fingerprint, metadata
  ) VALUES (
    v_audit_id, p_user_id, 'work', p_work_id::TEXT, p_action,
    p_before, p_after, ARRAY[]::TEXT[],
    p_request_id, p_request_fingerprint,
    COALESCE(p_metadata, '{}'::JSONB) || pg_catalog.jsonb_build_object(
      'source', 'voice_actor_work_mutation',
      'operation', p_action,
      'transaction_id', pg_catalog.pg_current_xact_id()::TEXT
    )
  );
  RETURN v_audit_id;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_voice_actor_work_mutation(UUID, UUID, TEXT, BIGINT, TEXT, JSONB, JSONB, JSONB)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_voice_actor_work_link(
  p_user_id UUID,
  p_request_id UUID,
  p_voice_actor_id BIGINT,
  p_content_id BIGINT,
  p_content_type TEXT,
  p_language TEXT,
  p_actor_person_id BIGINT,
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
     OR p_character_name IS NULL OR length(pg_catalog.btrim(p_character_name)) = 0
     OR length(p_character_name) > 300
     OR p_performance IS NULL
     OR p_performance NOT IN ('dialogues', 'chant', 'dialogues & chant', 'bruitages', 'narration', 'ambiances', 'voice') THEN
    RAISE EXCEPTION 'Voice actor work link fields are invalid' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('voice-work-request:' || p_user_id::TEXT || ':' || p_request_id::TEXT, 0)
  );
  PERFORM public.require_voice_actor_work_permission(p_user_id, p_voice_actor_id);
  IF NOT EXISTS (
    SELECT 1 FROM public.voice_actors AS voice_actor WHERE voice_actor.id = p_voice_actor_id
  ) THEN
    RAISE EXCEPTION 'Voice actor does not exist' USING ERRCODE = '23503';
  END IF;

  v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'operation', 'create_voice_actor_work_link',
    'voice_actor_id', p_voice_actor_id,
    'content_id', p_content_id,
    'content_type', p_content_type,
    'language', p_language,
    'actor_person_id', p_actor_person_id,
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

  v_role := public.work_role_identity_key(NULL::BIGINT, p_character_name);
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
    AND public.work_role_identity_key(work.character_id, work.character_name) = v_role;
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
      AND public.work_role_identity_key(work.character_id, work.character_name) = v_role
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
    dubbing_project_id, actor_id, voice_actor_id, character_name,
    performance, status, created_by
  ) VALUES (
    v_project_id, p_actor_person_id, p_voice_actor_id, p_character_name,
    p_performance, 'user', p_user_id
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

REVOKE ALL ON FUNCTION public.create_voice_actor_work_link(UUID, UUID, BIGINT, BIGINT, TEXT, TEXT, BIGINT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_voice_actor_work_link(UUID, UUID, BIGINT, BIGINT, TEXT, TEXT, BIGINT, TEXT, TEXT)
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
  PERFORM public.require_voice_actor_work_permission(p_user_id, v_work.voice_actor_id);

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
  SET performance = p_performance
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

CREATE OR REPLACE FUNCTION public.delete_voice_actor_work_link(
  p_user_id UUID,
  p_request_id UUID,
  p_work_id BIGINT,
  p_expected_updated_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(work_id BIGINT, audit_log_id UUID, replayed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_work public.work%ROWTYPE;
  v_existing_audit public.audit_logs%ROWTYPE;
  v_fingerprint TEXT;
  v_voice_actor_id BIGINT;
  v_audit_id UUID;
BEGIN
  IF p_user_id IS NULL OR p_request_id IS NULL OR p_work_id IS NULL OR p_work_id <= 0 THEN
    RAISE EXCEPTION 'Voice actor work deletion fields are invalid'
      USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('voice-work-request:' || p_user_id::TEXT || ':' || p_request_id::TEXT, 0)
  );
  v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'operation', 'delete_voice_actor_work_link',
    'work_id', p_work_id,
    'expected_updated_at', p_expected_updated_at
  )::TEXT);
  SELECT audit.* INTO v_existing_audit
  FROM public.audit_logs AS audit
  WHERE audit.user_id = p_user_id AND audit.request_id = p_request_id;
  IF FOUND THEN
    IF v_existing_audit.request_fingerprint IS DISTINCT FROM v_fingerprint
       OR v_existing_audit.entity_type <> 'work'
       OR v_existing_audit.action <> 'delete' THEN
      RAISE EXCEPTION 'Request id was already used with different work data'
        USING ERRCODE = '23505';
    END IF;
    v_voice_actor_id := NULLIF(v_existing_audit.previous_value ->> 'voice_actor_id', '')::BIGINT;
    PERFORM public.require_voice_actor_work_permission(p_user_id, v_voice_actor_id);
    RETURN QUERY SELECT p_work_id, v_existing_audit.id, TRUE;
    RETURN;
  END IF;

  SELECT work.* INTO v_work
  FROM public.work AS work
  WHERE work.id = p_work_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.require_voice_actor_work_permission(p_user_id, v_work.voice_actor_id);
  IF v_work.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Work changed since it was loaded' USING ERRCODE = '40001';
  END IF;

  PERFORM pg_catalog.set_config('app.controlled_voice_actor_work_mutation', 'true', TRUE);
  DELETE FROM public.work AS work WHERE work.id = p_work_id;
  v_audit_id := public.audit_voice_actor_work_mutation(
    p_user_id, p_request_id, v_fingerprint, p_work_id, 'delete',
    pg_catalog.to_jsonb(v_work), 'null'::JSONB,
    pg_catalog.jsonb_build_object(
      'dubbing_project_id', v_work.dubbing_project_id,
      'voice_actor_id', v_work.voice_actor_id,
      'restore_snapshot', TRUE
    )
  );
  RETURN QUERY SELECT p_work_id, v_audit_id, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_voice_actor_work_link(UUID, UUID, BIGINT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_voice_actor_work_link(UUID, UUID, BIGINT, TIMESTAMPTZ)
  TO service_role;
