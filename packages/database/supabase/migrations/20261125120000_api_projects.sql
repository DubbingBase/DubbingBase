-- Narrow API project updates: status and studio only. Cast and crew remain website-managed.
CREATE OR REPLACE FUNCTION public.api_create_dubbing_project(
  p_actor_id UUID,
  p_request_id UUID,
  p_content_id BIGINT,
  p_content_type TEXT,
  p_language TEXT
)
RETURNS TABLE(project_id BIGINT, language TEXT, audit_log_id UUID, replayed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_created RECORD;
BEGIN
  PERFORM pg_catalog.set_config('app.mutation_origin', 'api', TRUE);
  SELECT created.* INTO v_created
  FROM public.find_or_create_dubbing_project(
    p_actor_id, NULL, p_request_id, p_content_id, p_content_type, p_language
  ) AS created;
  RETURN QUERY
  SELECT v_created.project_id, project.language, v_created.audit_log_id, v_created.replayed
  FROM public.dubbing_projects AS project
  WHERE project.id = v_created.project_id;
END;
$$;

ALTER FUNCTION public.api_create_dubbing_project(UUID, UUID, BIGINT, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.api_create_dubbing_project(UUID, UUID, BIGINT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_create_dubbing_project(UUID, UUID, BIGINT, TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.api_update_dubbing_project(
  p_actor_id UUID,
  p_request_id UUID,
  p_project_id BIGINT,
  p_updates JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_metadata JSONB;
  v_project public.dubbing_projects%ROWTYPE;
  v_media public.media%ROWTYPE;
  v_existing_audit public.audit_logs%ROWTYPE;
  v_before JSONB;
  v_after JSONB;
  v_fingerprint TEXT;
  v_audit_id UUID;
  v_studio_id BIGINT;
  v_status TEXT;
  v_changed_fields TEXT[];
  v_changed BOOLEAN;
BEGIN
  SELECT users.raw_app_meta_data INTO v_actor_metadata
  FROM auth.users AS users
  WHERE users.id = p_actor_id
  FOR SHARE;
  IF p_actor_id IS NULL OR v_actor_metadata ->> 'role' IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only an administrator can update dubbing projects' USING ERRCODE = '42501';
  END IF;
  PERFORM private.assert_contributor(p_actor_id);

  IF p_request_id IS NULL OR p_project_id IS NULL OR p_project_id <= 0
     OR p_updates IS NULL OR pg_catalog.jsonb_typeof(p_updates) IS DISTINCT FROM 'object'
     OR p_updates = '{}'::JSONB
     OR EXISTS (
       SELECT 1 FROM pg_catalog.jsonb_object_keys(p_updates) AS field(name)
       WHERE field.name <> ALL (ARRAY['status', 'studio_id']::TEXT[])
     )
     OR (p_updates ? 'status' AND (
       pg_catalog.jsonb_typeof(p_updates -> 'status') IS DISTINCT FROM 'string'
       OR p_updates ->> 'status' <> ALL (ARRAY['validated', 'pending', 'draft']::TEXT[])
     ))
     OR (p_updates ? 'studio_id' AND p_updates -> 'studio_id' <> 'null'::JSONB AND (
       pg_catalog.jsonb_typeof(p_updates -> 'studio_id') IS DISTINCT FROM 'number'
       OR (p_updates ->> 'studio_id') !~ '^[1-9][0-9]{0,17}$'
     )) THEN
    RAISE EXCEPTION 'Project update fields are invalid' USING ERRCODE = '22023';
  END IF;

  v_status := CASE WHEN p_updates ? 'status' THEN p_updates ->> 'status' END;
  v_studio_id := CASE
    WHEN NOT (p_updates ? 'studio_id') OR p_updates -> 'studio_id' = 'null'::JSONB THEN NULL
    ELSE (p_updates ->> 'studio_id')::BIGINT
  END;
  IF p_updates ? 'studio_id' AND v_studio_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.studios AS studio WHERE studio.id = v_studio_id
  ) THEN
    RAISE EXCEPTION 'Selected studio does not exist' USING ERRCODE = '23503';
  END IF;

  v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'project_id', p_project_id,
    'updates', p_updates
  )::TEXT);
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_actor_id::TEXT || ':' || p_request_id::TEXT, 0)
  );

  SELECT audit.* INTO v_existing_audit
  FROM public.audit_logs AS audit
  WHERE audit.user_id = p_actor_id AND audit.request_id = p_request_id;
  IF FOUND THEN
    IF v_existing_audit.entity_type IS DISTINCT FROM 'dubbing_project'
       OR v_existing_audit.action IS DISTINCT FROM 'update'
       OR v_existing_audit.entity_id IS DISTINCT FROM p_project_id::TEXT
       OR v_existing_audit.request_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'Request id was already used with different project data' USING ERRCODE = '23505';
    END IF;
    SELECT project.* INTO v_project
    FROM public.dubbing_projects AS project
    WHERE project.id = p_project_id;
    IF NOT FOUND OR pg_catalog.to_jsonb(v_project) IS DISTINCT FROM v_existing_audit.new_value -> 'project' THEN
      RAISE EXCEPTION 'The project changed after this update; reload before retrying' USING ERRCODE = '55000';
    END IF;
    SELECT media.* INTO v_media FROM public.media AS media WHERE media.id = v_project.media_id;
    RETURN pg_catalog.jsonb_build_object(
      'id', v_project.id, 'language', v_project.language,
      'studio_id', v_project.studio_id, 'status', v_project.status,
      'media', pg_catalog.jsonb_build_object('kind', v_media.kind, 'content_id', v_media.content_id),
      'replayed', TRUE,
      'changed', COALESCE((v_existing_audit.metadata ->> 'changed')::BOOLEAN, FALSE)
    );
  END IF;

  SELECT project.* INTO v_project
  FROM public.dubbing_projects AS project
  WHERE project.id = p_project_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dubbing project does not exist' USING ERRCODE = 'P0002';
  END IF;
  v_before := pg_catalog.to_jsonb(v_project);

  v_changed_fields := ARRAY[]::TEXT[];
  IF p_updates ? 'status' AND v_project.status IS DISTINCT FROM v_status THEN
    v_changed_fields := pg_catalog.array_append(v_changed_fields, 'status');
  END IF;
  IF p_updates ? 'studio_id' AND v_project.studio_id IS DISTINCT FROM v_studio_id THEN
    v_changed_fields := pg_catalog.array_append(v_changed_fields, 'studio_id');
  END IF;
  v_changed := pg_catalog.cardinality(v_changed_fields) > 0;
  IF v_changed THEN
    UPDATE public.dubbing_projects AS project
    SET status = CASE WHEN p_updates ? 'status' THEN v_status ELSE project.status END,
        studio_id = CASE WHEN p_updates ? 'studio_id' THEN v_studio_id ELSE project.studio_id END,
        updated_at = pg_catalog.timezone('utc', pg_catalog.clock_timestamp())
    WHERE project.id = p_project_id
    RETURNING project.* INTO v_project;
  END IF;
  v_after := pg_catalog.to_jsonb(v_project);
  SELECT media.* INTO v_media FROM public.media AS media WHERE media.id = v_project.media_id;

  v_audit_id := pg_catalog.gen_random_uuid();
  PERFORM pg_catalog.set_config('app.mutation_origin', 'api', TRUE);
  INSERT INTO public.audit_logs (
    id, user_id, entity_type, entity_id, action,
    previous_value, new_value, changed_fields, request_id, request_fingerprint, metadata
  ) VALUES (
    v_audit_id, p_actor_id, 'dubbing_project', v_project.id::TEXT, 'update',
    pg_catalog.jsonb_build_object('project', v_before),
    pg_catalog.jsonb_build_object('project', v_after),
    v_changed_fields, p_request_id, v_fingerprint,
    pg_catalog.jsonb_build_object(
      'source', 'api_update_dubbing_project',
      'changed', v_changed,
      'transaction_id', pg_catalog.pg_current_xact_id()::TEXT
    )
  );

  RETURN pg_catalog.jsonb_build_object(
    'id', v_project.id, 'language', v_project.language,
    'studio_id', v_project.studio_id, 'status', v_project.status,
    'media', pg_catalog.jsonb_build_object('kind', v_media.kind, 'content_id', v_media.content_id),
    'replayed', FALSE, 'changed', v_changed
  );
END;
$$;

ALTER FUNCTION public.api_update_dubbing_project(UUID, UUID, BIGINT, JSONB) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.api_update_dubbing_project(UUID, UUID, BIGINT, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_update_dubbing_project(UUID, UUID, BIGINT, JSONB) TO service_role;
