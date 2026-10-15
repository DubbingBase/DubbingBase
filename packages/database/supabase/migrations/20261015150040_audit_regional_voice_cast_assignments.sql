CREATE SCHEMA IF NOT EXISTS private AUTHORIZATION postgres;

CREATE TABLE private.regional_assignment_requests (
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  request_id UUID NOT NULL,
  request_fingerprint TEXT NOT NULL,
  result_project_id BIGINT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (actor_id, request_id)
);

CREATE TABLE private.regional_assignment_request_audits (
  actor_id UUID NOT NULL,
  request_id UUID NOT NULL,
  audit_log_id UUID NOT NULL REFERENCES public.audit_logs(id) ON DELETE RESTRICT,
  changed_fields TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  PRIMARY KEY (actor_id, request_id, audit_log_id),
  FOREIGN KEY (actor_id, request_id)
    REFERENCES private.regional_assignment_requests(actor_id, request_id) ON DELETE RESTRICT
);

ALTER TABLE private.regional_assignment_requests OWNER TO postgres;
ALTER TABLE private.regional_assignment_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.regional_assignment_requests FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE private.regional_assignment_request_audits OWNER TO postgres;
ALTER TABLE private.regional_assignment_request_audits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.regional_assignment_request_audits FROM PUBLIC, anon, authenticated, service_role;

REVOKE SELECT ON public.audit_logs FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM PUBLIC, anon, authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM service_role;
GRANT SELECT ON public.audit_logs TO authenticated, service_role;
GRANT INSERT ON public.audit_logs TO service_role;
GRANT UPDATE (reverted_at) ON public.audit_logs TO service_role;

CREATE OR REPLACE FUNCTION public.protect_project_assignment_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Audit history is immutable' USING ERRCODE = '55000';
  END IF;

  IF (to_jsonb(NEW) - 'reverted_at') IS DISTINCT FROM (to_jsonb(OLD) - 'reverted_at')
     OR OLD.reverted_at IS NOT NULL
     OR NEW.reverted_at IS NULL THEN
    RAISE EXCEPTION 'Audit history is immutable' USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_project_assignment_audit() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS protect_project_assignment_audit ON public.audit_logs;
CREATE TRIGGER protect_project_assignment_audit
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.protect_project_assignment_audit();

DROP FUNCTION IF EXISTS public.save_regional_project_actor_assignments(bigint, text, text, jsonb);

-- Keep older website instances safe during the database-first deploy window.
-- The old route receives the existing 55000 conflict response but cannot
-- continue writing without an actor and idempotency key.
CREATE FUNCTION public.save_regional_project_actor_assignments(
  p_content_id BIGINT,
  p_content_type TEXT,
  p_dubbing_language TEXT,
  p_operations JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'The legacy regional assignment RPC cannot write without an audited request id'
    USING ERRCODE = '55000';
END;
$$;

REVOKE ALL ON FUNCTION public.save_regional_project_actor_assignments(bigint, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_regional_project_actor_assignments(bigint, text, text, jsonb)
  TO service_role;

CREATE FUNCTION public.save_regional_project_actor_assignments(
  p_content_id BIGINT,
  p_content_type TEXT,
  p_dubbing_language TEXT,
  p_operations JSONB,
  p_actor_id UUID,
  p_request_id UUID
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_role TEXT;
  v_prior_auth_sub TEXT;
  v_project_id BIGINT;
  v_project public.dubbing_projects%ROWTYPE;
  v_project_created BOOLEAN := FALSE;
  v_operation RECORD;
  v_work_ids BIGINT[];
  v_work_count INTEGER;
  v_affected_rows INTEGER;
  v_current_work public.work%ROWTYPE;
  v_new_work public.work%ROWTYPE;
  v_previous_work JSONB;
  v_new_work_json JSONB;
  v_changed_fields TEXT[];
  v_action TEXT;
  v_audit_log_id UUID;
  v_audit_events JSONB := '[]'::JSONB;
  v_event JSONB;
  v_payload JSONB;
  v_fingerprint TEXT;
  v_existing_request private.regional_assignment_requests%ROWTYPE;
BEGIN
  IF p_actor_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'A verified admin and request id are required' USING ERRCODE = '28000';
  END IF;

  SELECT actor.raw_app_meta_data ->> 'role'
  INTO v_actor_role
  FROM auth.users AS actor
  WHERE actor.id = p_actor_id
  FOR SHARE;

  IF NOT FOUND OR v_actor_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'An administrator is required for regional assignment writes'
      USING ERRCODE = '42501';
  END IF;

  v_prior_auth_sub := pg_catalog.current_setting('request.jwt.claim.sub', TRUE);

  IF p_content_id IS NULL OR p_content_id <= 0
    OR p_content_type IS NULL
    OR p_content_type NOT IN ('movie', 'tv', 'video_game', 'audiobook', 'podcast', 'advertisement', 'toy')
    OR p_dubbing_language IS NULL
    OR NOT public.is_valid_dubbing_language(p_dubbing_language) THEN
    RAISE EXCEPTION 'A valid media selection and regional dubbing language are required'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_operations) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Assignment operations must be a JSON array'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(p_operations) = 0 THEN
    RAISE EXCEPTION 'At least one assignment operation is required'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_operations) AS item(value)
    WHERE jsonb_typeof(item.value) IS DISTINCT FROM 'object'
      OR NOT (item.value ?& ARRAY['actor_id', 'work_id', 'expected_voice_actor_id', 'voice_actor_id'])
      OR (item.value - ARRAY['actor_id', 'work_id', 'expected_voice_actor_id', 'voice_actor_id']) <> '{}'::JSONB
  ) THEN
    RAISE EXCEPTION 'Each assignment operation must use only the supported fields'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_operations) AS item(value)
    WHERE jsonb_typeof(item.value -> 'actor_id') IS DISTINCT FROM 'number'
      OR (item.value ->> 'actor_id') !~ '^[0-9]+$'
      OR (
        jsonb_typeof(item.value -> 'work_id') IS DISTINCT FROM 'null'
        AND (
          jsonb_typeof(item.value -> 'work_id') IS DISTINCT FROM 'number'
          OR (item.value ->> 'work_id') !~ '^[0-9]+$'
        )
      )
      OR (
        jsonb_typeof(item.value -> 'expected_voice_actor_id') IS DISTINCT FROM 'null'
        AND (
          jsonb_typeof(item.value -> 'expected_voice_actor_id') IS DISTINCT FROM 'number'
          OR (item.value ->> 'expected_voice_actor_id') !~ '^[0-9]+$'
        )
      )
      OR (
        jsonb_typeof(item.value -> 'voice_actor_id') IS DISTINCT FROM 'null'
        AND (
          jsonb_typeof(item.value -> 'voice_actor_id') IS DISTINCT FROM 'number'
          OR (item.value ->> 'voice_actor_id') !~ '^[0-9]+$'
        )
      )
  ) THEN
    RAISE EXCEPTION 'Assignment IDs must be positive integer values or null where allowed'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_operations) AS operation(
      actor_id BIGINT,
      work_id BIGINT,
      expected_voice_actor_id BIGINT,
      voice_actor_id BIGINT
    )
    WHERE operation.actor_id IS NULL
      OR operation.actor_id <= 0
      OR (operation.work_id IS NOT NULL AND operation.work_id <= 0)
      OR (operation.expected_voice_actor_id IS NOT NULL AND operation.expected_voice_actor_id <= 0)
      OR (operation.voice_actor_id IS NOT NULL AND operation.voice_actor_id <= 0)
      OR (operation.work_id IS NULL AND operation.voice_actor_id IS NULL)
      OR (operation.work_id IS NULL AND operation.expected_voice_actor_id IS NOT NULL)
      OR (operation.work_id IS NOT NULL
        AND operation.expected_voice_actor_id IS NOT DISTINCT FROM operation.voice_actor_id)
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_operations) AS operation(
      actor_id BIGINT,
      work_id BIGINT,
      expected_voice_actor_id BIGINT,
      voice_actor_id BIGINT
    )
    GROUP BY operation.actor_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Each assignment operation must describe one actual change for a unique actor'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_operations) AS operation(
      actor_id BIGINT,
      work_id BIGINT,
      expected_voice_actor_id BIGINT,
      voice_actor_id BIGINT
    )
    LEFT JOIN public.voice_actors AS voice_actor ON voice_actor.id = operation.voice_actor_id
    WHERE operation.voice_actor_id IS NOT NULL AND voice_actor.id IS NULL
  ) THEN
    RAISE EXCEPTION 'A selected voice actor does not exist' USING ERRCODE = '23503';
  END IF;

  v_payload := jsonb_build_object(
    'content_id', p_content_id,
    'content_type', p_content_type,
    'dubbing_language', p_dubbing_language,
    'operations', p_operations
  );
  -- Store the canonical JSONB form rather than a short hash. Request IDs are
  -- idempotency keys, so a collision must never make a different payload look
  -- like a successful retry.
  v_fingerprint := v_payload::TEXT;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_actor_id::TEXT || ':' || p_request_id::TEXT, 0)
  );

  SELECT request.*
  INTO v_existing_request
  FROM private.regional_assignment_requests AS request
  WHERE request.actor_id = p_actor_id AND request.request_id = p_request_id;

  IF FOUND THEN
    IF v_existing_request.request_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'Request id was already used with a different assignment payload'
        USING ERRCODE = '40001';
    END IF;
    RETURN v_existing_request.result_project_id;
  END IF;

  -- The unique media+region key makes project creation race safe. A conflict
  -- leaves the existing project's status untouched.
  INSERT INTO public.dubbing_projects(content_id, content_type, language, status)
  VALUES (p_content_id, p_content_type, p_dubbing_language, 'validated')
  ON CONFLICT (content_id, content_type, language) DO NOTHING
  RETURNING * INTO v_project;
  v_project_created := FOUND;

  IF v_project_created THEN
    v_project_id := v_project.id;
  ELSE
    SELECT project.* INTO v_project
    FROM public.dubbing_projects AS project
    WHERE project.content_id = p_content_id
      AND project.content_type = p_content_type
      AND project.language = p_dubbing_language
    FOR UPDATE;
    v_project_id := v_project.id;
  END IF;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Unable to lock the regional dubbing project';
  END IF;

  IF v_project_created THEN
    SELECT ARRAY(SELECT jsonb_object_keys(to_jsonb(v_project)) ORDER BY 1)
    INTO v_changed_fields;
    INSERT INTO public.audit_logs (
      user_id, entity_type, entity_id, action, previous_value, new_value
    ) VALUES (
      p_actor_id, 'dubbing_project', v_project_id::TEXT, 'create', NULL, to_jsonb(v_project)
    ) RETURNING id INTO v_audit_log_id;
    v_audit_events := v_audit_events || jsonb_build_array(jsonb_build_object(
      'audit_log_id', v_audit_log_id,
      'changed_fields', to_jsonb(v_changed_fields),
      'metadata', jsonb_build_object('source', '/api/admin/dubbing-project', 'entity', 'dubbing_project')
    ));
  END IF;

  FOR v_operation IN
    SELECT operation.actor_id,
           operation.work_id,
           operation.expected_voice_actor_id,
           operation.voice_actor_id
    FROM jsonb_to_recordset(p_operations) AS operation(
      actor_id BIGINT,
      work_id BIGINT,
      expected_voice_actor_id BIGINT,
      voice_actor_id BIGINT
    )
    ORDER BY operation.actor_id
  LOOP
    SELECT coalesce(array_agg(locked_work.id ORDER BY locked_work.id), ARRAY[]::BIGINT[])
      INTO v_work_ids
    FROM (
      SELECT work.id
      FROM public.work AS work
      WHERE work.dubbing_project_id = v_project_id
        AND work.actor_id = v_operation.actor_id
      ORDER BY work.id
      FOR UPDATE
    ) AS locked_work;

    v_work_count := cardinality(v_work_ids);
    IF v_work_count > 1 THEN
      RAISE EXCEPTION 'Actor % has multiple works in this regional project and cannot be edited through this form',
        v_operation.actor_id
        USING ERRCODE = '55000';
    END IF;

    IF v_operation.work_id IS NULL THEN
      IF v_work_count <> 0 THEN
        RAISE EXCEPTION 'The assignment changed since it was loaded; reload before saving'
          USING ERRCODE = '40001';
      END IF;

      INSERT INTO public.work(
        dubbing_project_id,
        actor_id,
        voice_actor_id,
        performance,
        status,
        created_by,
        updated_by
      ) VALUES (
        v_project_id,
        v_operation.actor_id,
        v_operation.voice_actor_id,
        'voice',
        'validated',
        p_actor_id,
        p_actor_id
      ) RETURNING * INTO v_new_work;

      v_action := 'create';
      v_previous_work := NULL;
      v_new_work_json := to_jsonb(v_new_work);
      SELECT ARRAY(SELECT jsonb_object_keys(v_new_work_json) ORDER BY 1)
      INTO v_changed_fields;
    ELSE
      IF v_work_count <> 1 OR v_work_ids[1] IS DISTINCT FROM v_operation.work_id THEN
        RAISE EXCEPTION 'Work % is stale or does not belong to actor % in this regional project',
          v_operation.work_id, v_operation.actor_id
          USING ERRCODE = '40001';
      END IF;

      SELECT work.* INTO v_current_work
      FROM public.work AS work
      WHERE work.id = v_operation.work_id
        AND work.dubbing_project_id = v_project_id
        AND work.actor_id = v_operation.actor_id
      FOR UPDATE;

      IF NOT FOUND OR v_current_work.voice_actor_id IS DISTINCT FROM v_operation.expected_voice_actor_id THEN
        RAISE EXCEPTION 'Assignment changed since it was loaded; reload before saving'
          USING ERRCODE = '40001';
      END IF;

      v_previous_work := to_jsonb(v_current_work);
      IF v_operation.voice_actor_id IS NULL THEN
        DELETE FROM public.work
        WHERE id = v_operation.work_id
          AND dubbing_project_id = v_project_id
          AND actor_id = v_operation.actor_id;
        GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
        IF v_affected_rows <> 1 THEN
          RAISE EXCEPTION 'Work % changed while the assignment was being saved', v_operation.work_id
            USING ERRCODE = '40001';
        END IF;
        v_action := 'delete';
        v_new_work_json := NULL;
        SELECT ARRAY(SELECT jsonb_object_keys(v_previous_work) ORDER BY 1)
        INTO v_changed_fields;
      ELSE
        -- The service-role RPC has no user subject in auth.uid(). Set the
        -- verified caller only while the existing work timestamp trigger runs.
        PERFORM pg_catalog.set_config('request.jwt.claim.sub', p_actor_id::TEXT, TRUE);
        UPDATE public.work
        SET voice_actor_id = v_operation.voice_actor_id
        WHERE id = v_operation.work_id
          AND dubbing_project_id = v_project_id
          AND actor_id = v_operation.actor_id
        RETURNING * INTO v_new_work;
        GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
        IF v_affected_rows <> 1 THEN
          RAISE EXCEPTION 'Work % changed while the assignment was being saved', v_operation.work_id
            USING ERRCODE = '40001';
        END IF;
        PERFORM pg_catalog.set_config('request.jwt.claim.sub', coalesce(v_prior_auth_sub, ''), TRUE);
        v_action := 'update';
        v_new_work_json := to_jsonb(v_new_work);
        SELECT ARRAY(
          SELECT field_name
          FROM (
            SELECT jsonb_object_keys(v_previous_work) AS field_name
            UNION
            SELECT jsonb_object_keys(v_new_work_json) AS field_name
          ) AS fields
          WHERE v_previous_work -> field_name IS DISTINCT FROM v_new_work_json -> field_name
          ORDER BY field_name
        ) INTO v_changed_fields;
      END IF;
    END IF;

    INSERT INTO public.audit_logs (
      user_id, entity_type, entity_id, action, previous_value, new_value
    ) VALUES (
      p_actor_id,
      'work',
      CASE WHEN v_action = 'create' THEN v_new_work.id::TEXT ELSE v_operation.work_id::TEXT END,
      v_action,
      v_previous_work,
      v_new_work_json
    ) RETURNING id INTO v_audit_log_id;
    v_audit_events := v_audit_events || jsonb_build_array(jsonb_build_object(
      'audit_log_id', v_audit_log_id,
      'changed_fields', to_jsonb(v_changed_fields),
      'metadata', jsonb_build_object(
        'source', '/api/admin/dubbing-project',
        'actor_id', v_operation.actor_id,
        'operation', v_action
      )
    ));
  END LOOP;

  INSERT INTO private.regional_assignment_requests (
    actor_id, request_id, request_fingerprint, result_project_id, metadata
  ) VALUES (
    p_actor_id,
    p_request_id,
    v_fingerprint,
    v_project_id,
    jsonb_build_object(
      'source', '/api/admin/dubbing-project',
      'content_id', p_content_id,
      'content_type', p_content_type,
      'dubbing_language', p_dubbing_language,
      'operation_count', jsonb_array_length(p_operations)
    )
  );

  FOR v_event IN SELECT value FROM jsonb_array_elements(v_audit_events) AS event(value)
  LOOP
    INSERT INTO private.regional_assignment_request_audits (
      actor_id, request_id, audit_log_id, changed_fields, metadata
    ) VALUES (
      p_actor_id,
      p_request_id,
      (v_event ->> 'audit_log_id')::UUID,
      ARRAY(SELECT jsonb_array_elements_text(v_event -> 'changed_fields')),
      v_event -> 'metadata'
    );
  END LOOP;

  RETURN v_project_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_regional_project_actor_assignments(bigint, text, text, jsonb, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_regional_project_actor_assignments(bigint, text, text, jsonb, uuid, uuid)
  TO service_role;
