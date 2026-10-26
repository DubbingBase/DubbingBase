CREATE TABLE private.admin_credit_import_requests (
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  request_id UUID NOT NULL,
  request_fingerprint TEXT NOT NULL,
  result JSONB NOT NULL CHECK (pg_catalog.jsonb_typeof(result) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  PRIMARY KEY (admin_id, request_id)
);

ALTER TABLE private.admin_credit_import_requests OWNER TO postgres;
ALTER TABLE private.admin_credit_import_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.admin_credit_import_requests
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE private.admin_credit_import_requests IS
  'Private idempotency ledger for per-credit administrative imports; each row commits with the corresponding work and audit change.';

CREATE OR REPLACE FUNCTION public.save_admin_credit_import(
  p_admin_id UUID,
  p_request_id UUID,
  p_content_id BIGINT,
  p_content_type TEXT,
  p_language TEXT,
  p_voice_actor_id BIGINT,
  p_voice_actor_firstname TEXT,
  p_voice_actor_lastname TEXT,
  p_work_actor_id BIGINT,
  p_character_id BIGINT,
  p_character_name TEXT
)
RETURNS TABLE(
  work_id BIGINT,
  project_id BIGINT,
  voice_actor_id BIGINT,
  audit_log_id UUID,
  replayed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_role TEXT;
  v_project_id BIGINT;
  v_project_request_id UUID;
  v_voice_actor_id BIGINT;
  v_voice_actor_request_id UUID;
  v_work_request_id UUID;
  v_legacy_voice_actor_id BIGINT;
  v_voice_actor_result JSONB;
  v_voice_actor_firstname TEXT;
  v_voice_actor_lastname TEXT;
  v_fingerprint TEXT;
  v_role_identity TEXT;
  v_role_match_count BIGINT;
  v_work public.work%ROWTYPE;
  v_work_before public.work%ROWTYPE;
  v_existing_audit public.audit_logs%ROWTYPE;
  v_existing_request private.admin_credit_import_requests%ROWTYPE;
  v_result JSONB;
  v_audit_id UUID;
  v_action TEXT;
BEGIN
  IF p_admin_id IS NULL OR p_request_id IS NULL
     OR p_content_id IS NULL OR p_content_id = 0
     OR p_content_type IS NULL
     OR p_content_type NOT IN (
       'movie', 'tv', 'video_game', 'audiobook', 'podcast', 'advertisement', 'toy'
     )
     OR (p_content_id < 0 AND p_content_type NOT IN ('advertisement', 'toy'))
     OR p_language IS NULL OR NOT public.is_valid_dubbing_language(p_language)
     OR (p_voice_actor_id IS NOT NULL AND p_voice_actor_id <= 0)
     OR (p_voice_actor_id IS NULL AND (
       p_voice_actor_firstname IS NULL
       OR pg_catalog.length(pg_catalog.btrim(p_voice_actor_firstname)) NOT BETWEEN 1 AND 120
       OR p_voice_actor_lastname IS NULL
       OR pg_catalog.length(pg_catalog.btrim(p_voice_actor_lastname)) NOT BETWEEN 1 AND 120
     ))
     OR (p_work_actor_id IS NOT NULL AND p_work_actor_id <= 0)
     OR (p_character_id IS NOT NULL AND p_character_id <= 0)
     OR (p_character_name IS NOT NULL AND (
       pg_catalog.length(p_character_name) > 300
       OR pg_catalog.btrim(p_character_name) = ''
     )) THEN
    RAISE EXCEPTION 'Admin credit import fields are invalid'
      USING ERRCODE = '22023';
  END IF;

  SELECT users.raw_app_meta_data ->> 'role'
  INTO v_admin_role
  FROM auth.users AS users
  WHERE users.id = p_admin_id
  FOR SHARE;
  IF NOT FOUND OR v_admin_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only an administrator can import credits'
      USING ERRCODE = '42501';
  END IF;

  v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'operation', 'save_admin_credit_import',
    'content_id', p_content_id,
    'content_type', p_content_type,
    'language', p_language,
    'voice_actor_id', p_voice_actor_id,
    'voice_actor_name', CASE WHEN p_voice_actor_id IS NULL THEN
      pg_catalog.jsonb_build_object(
        'firstname', pg_catalog.btrim(p_voice_actor_firstname),
        'lastname', pg_catalog.btrim(p_voice_actor_lastname)
      )
      ELSE NULL::JSONB
    END,
    'work_actor_id', p_work_actor_id,
    'character_id', p_character_id,
    'character_name', p_character_name,
    'performance', 'dialogues',
    'status', 'validated'
  )::TEXT);

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'admin-credit-import-request:' || p_admin_id::TEXT || ':' || p_request_id::TEXT,
      0
    )
  );

  SELECT request.*
  INTO v_existing_request
  FROM private.admin_credit_import_requests AS request
  WHERE request.admin_id = p_admin_id
    AND request.request_id = p_request_id;
  IF FOUND THEN
    IF v_existing_request.request_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'Request id was already used with different credit data'
        USING ERRCODE = '23505';
    END IF;
    RETURN QUERY SELECT
      (v_existing_request.result ->> 'work_id')::BIGINT,
      (v_existing_request.result ->> 'project_id')::BIGINT,
      (v_existing_request.result ->> 'voice_actor_id')::BIGINT,
      (v_existing_request.result ->> 'audit_log_id')::UUID,
      TRUE;
    RETURN;
  END IF;

  SELECT audit.*
  INTO v_existing_audit
  FROM public.audit_logs AS audit
  WHERE audit.user_id = p_admin_id
    AND audit.request_id = p_request_id;
  IF FOUND THEN
    IF v_existing_audit.entity_type = 'voice_actor'
       AND v_existing_audit.action = 'create'
       AND p_voice_actor_id IS NULL
       AND pg_catalog.lower(v_existing_audit.new_value ->> 'firstname')
         = pg_catalog.lower(pg_catalog.btrim(p_voice_actor_firstname))
       AND pg_catalog.lower(v_existing_audit.new_value ->> 'lastname')
         = pg_catalog.lower(pg_catalog.btrim(p_voice_actor_lastname)) THEN
      -- Before this RPC existed, process-credits used the credit request ID
      -- for controlled actor creation. Resume that request without creating
      -- another actor, then record the completed work under its own audit ID.
      v_legacy_voice_actor_id := v_existing_audit.entity_id::BIGINT;
    ELSE
      RAISE EXCEPTION 'Request id was already used for a different operation'
        USING ERRCODE = '23505';
    END IF;
  END IF;

  v_work_request_id := pg_catalog.md5(
    'admin-credit-import-work:' || p_admin_id::TEXT || ':' || p_request_id::TEXT
  )::UUID;
  v_project_request_id := pg_catalog.md5(
    'admin-credit-import-project:' || p_admin_id::TEXT || ':' || p_request_id::TEXT
  )::UUID;
  SELECT project.project_id
  INTO v_project_id
  FROM public.find_or_create_dubbing_project(
    p_admin_id, NULL, v_project_request_id,
    p_content_id, p_content_type, p_language
  ) AS project;

  IF v_legacy_voice_actor_id IS NOT NULL THEN
    v_voice_actor_id := v_legacy_voice_actor_id;
  ELSIF p_voice_actor_id IS NOT NULL THEN
    SELECT actor.id
    INTO v_voice_actor_id
    FROM public.voice_actors AS actor
    WHERE actor.id = p_voice_actor_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Selected voice actor does not exist'
        USING ERRCODE = '23503';
    END IF;
  ELSE
    v_voice_actor_firstname := pg_catalog.btrim(p_voice_actor_firstname);
    v_voice_actor_lastname := pg_catalog.btrim(p_voice_actor_lastname);
    IF pg_catalog.length(v_voice_actor_firstname) NOT BETWEEN 1 AND 120
       OR pg_catalog.length(v_voice_actor_lastname) NOT BETWEEN 1 AND 120 THEN
      RAISE EXCEPTION 'Voice actor first and last names are required'
        USING ERRCODE = '22023';
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'admin-credit-import-voice-actor:' ||
          pg_catalog.lower(v_voice_actor_firstname) || E'\x1f' ||
          pg_catalog.lower(v_voice_actor_lastname),
        0
      )
    );

    SELECT actor.id
    INTO v_voice_actor_id
    FROM public.voice_actors AS actor
    WHERE pg_catalog.lower(actor.firstname) = pg_catalog.lower(v_voice_actor_firstname)
      AND pg_catalog.lower(actor.lastname) = pg_catalog.lower(v_voice_actor_lastname)
    ORDER BY (
      actor.firstname = v_voice_actor_firstname
      AND actor.lastname = v_voice_actor_lastname
    ) DESC, actor.id
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      v_voice_actor_request_id := pg_catalog.md5(
        'admin-credit-import-voice-actor:' || p_admin_id::TEXT || ':' || p_request_id::TEXT
      )::UUID;
      BEGIN
        v_voice_actor_result := public.controlled_save_metadata(
          p_admin_id,
          'voice_actor',
          pg_catalog.jsonb_build_object(
            'firstname', v_voice_actor_firstname,
            'lastname', v_voice_actor_lastname
          ),
          v_voice_actor_request_id
        );
      EXCEPTION WHEN unique_violation THEN
        -- A legacy metadata writer may not use this importer lock. Reuse the
        -- actor it inserted if the exact or case-folded name now exists.
        SELECT actor.id
        INTO v_voice_actor_id
        FROM public.voice_actors AS actor
        WHERE pg_catalog.lower(actor.firstname) = pg_catalog.lower(v_voice_actor_firstname)
          AND pg_catalog.lower(actor.lastname) = pg_catalog.lower(v_voice_actor_lastname)
        ORDER BY (
          actor.firstname = v_voice_actor_firstname
          AND actor.lastname = v_voice_actor_lastname
        ) DESC, actor.id
        LIMIT 1
        FOR UPDATE;
        IF NOT FOUND THEN
          RAISE;
        END IF;
      END;

      IF v_voice_actor_id IS NULL THEN
        v_voice_actor_id := (v_voice_actor_result #>> '{record,id}')::BIGINT;
      END IF;
      IF v_voice_actor_id IS NULL THEN
        RAISE EXCEPTION 'Metadata creation returned an invalid voice actor'
          USING ERRCODE = '22023';
      END IF;
    END IF;
  END IF;

  v_role_identity := public.work_role_identity_key(
    p_character_id, p_character_name
  );
  IF v_role_identity IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        pg_catalog.jsonb_build_array(
          v_project_id, p_work_actor_id, v_voice_actor_id, v_role_identity
        )::TEXT,
        0
      )
    );

    SELECT pg_catalog.count(*)
    INTO v_role_match_count
    FROM public.work AS work
    WHERE work.dubbing_project_id = v_project_id
      AND work.actor_id IS NOT DISTINCT FROM p_work_actor_id
      AND work.voice_actor_id = v_voice_actor_id
      AND public.work_role_identity_key(work.character_id, work.character_name)
        = v_role_identity;
    IF v_role_match_count > 1 THEN
      RAISE EXCEPTION 'Multiple work records match this credit role'
        USING ERRCODE = '55000';
    END IF;
  ELSE
    v_role_match_count := 0;
  END IF;

  PERFORM pg_catalog.set_config(
    'app.controlled_voice_actor_work_mutation', 'true', TRUE
  );
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', p_admin_id::TEXT, TRUE);

  IF v_role_match_count = 1 THEN
    SELECT work.*
    INTO v_work_before
    FROM public.work AS work
    WHERE work.dubbing_project_id = v_project_id
      AND work.actor_id IS NOT DISTINCT FROM p_work_actor_id
      AND work.voice_actor_id = v_voice_actor_id
      AND public.work_role_identity_key(work.character_id, work.character_name)
        = v_role_identity
    FOR UPDATE;

    UPDATE public.work AS work
    SET performance = 'dialogues',
        status = 'validated',
        character_name = p_character_name
    WHERE work.id = v_work_before.id
    RETURNING work.* INTO v_work;
    v_action := 'update';
  ELSE
    INSERT INTO public.work (
      dubbing_project_id, actor_id, voice_actor_id, character_id,
      character_name, performance, status
    ) VALUES (
      v_project_id, p_work_actor_id, v_voice_actor_id, p_character_id,
      p_character_name, 'dialogues', 'validated'
    )
    RETURNING * INTO v_work;
    v_action := 'create';
  END IF;

  v_audit_id := public.audit_voice_actor_work_mutation(
    p_admin_id,
    v_work_request_id,
    v_fingerprint,
    v_work.id,
    v_action,
    CASE WHEN v_action = 'create' THEN 'null'::JSONB
      ELSE pg_catalog.to_jsonb(v_work_before) END,
    pg_catalog.to_jsonb(v_work),
    pg_catalog.jsonb_build_object(
      'import_source', 'process_credits',
      'dubbing_project_id', v_project_id,
      'voice_actor_id', v_voice_actor_id,
      'work_actor_id', p_work_actor_id,
      'role_identity', v_role_identity
    )
  );

  v_result := pg_catalog.jsonb_build_object(
    'work_id', v_work.id,
    'project_id', v_project_id,
    'voice_actor_id', v_voice_actor_id,
    'audit_log_id', v_audit_id
  );
  INSERT INTO private.admin_credit_import_requests (
    admin_id, request_id, request_fingerprint, result
  ) VALUES (
    p_admin_id, p_request_id, v_fingerprint, v_result
  );

  RETURN QUERY SELECT v_work.id, v_project_id, v_voice_actor_id, v_audit_id, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.save_admin_credit_import(
  UUID, UUID, BIGINT, TEXT, TEXT, BIGINT, TEXT, TEXT, BIGINT, BIGINT, TEXT
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_admin_credit_import(
  UUID, UUID, BIGINT, TEXT, TEXT, BIGINT, TEXT, TEXT, BIGINT, BIGINT, TEXT
) TO service_role;

COMMENT ON FUNCTION public.save_admin_credit_import(
  UUID, UUID, BIGINT, TEXT, TEXT, BIGINT, TEXT, TEXT, BIGINT, BIGINT, TEXT
) IS
  'Persists one administrator credit as an atomic, idempotent project/voice-actor/work/audit transaction. The caller invokes one transaction per credit and retains per-credit failures for intentional batch partial success.';

NOTIFY pgrst, 'reload schema';
