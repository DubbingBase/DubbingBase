CREATE TABLE public.toy_metadata (
  content_id BIGINT PRIMARY KEY CHECK (content_id <> 0),
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 300),
  manufacturer TEXT CHECK (manufacturer IS NULL OR length(btrim(manufacturer)) <= 300),
  product_line TEXT CHECK (product_line IS NULL OR length(btrim(product_line)) <= 300),
  release_year INTEGER CHECK (release_year IS NULL OR release_year BETWEEN 1800 AND 2200),
  cover_url TEXT CHECK (
    cover_url IS NULL OR (
      length(cover_url) <= 2048
      AND cover_url ~* '^https?://[^/[:space:]?#@]+(/[^[:space:]#?]*)?(\?[^[:space:]#]*)?(#[^[:space:]]*)?$'
      AND cover_url !~* '[?&](access[_-]?token|refresh[_-]?token|id[_-]?token|token|api[_-]?key|apikey|client[_-]?secret|secret|password|passwd|authorization)='
    )
  ),
  description TEXT CHECK (description IS NULL OR length(description) <= 10000),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE public.toy_metadata OWNER TO postgres;
ALTER TABLE public.toy_metadata ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.toy_metadata FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.toy_metadata TO service_role;

-- Preserve audited metadata and keep older project-backed toys visible even when
-- they predate the audited internal media creation flow.
WITH toy_content AS (
  SELECT
    project.content_id,
    MIN(project.created_at) AS created_at
  FROM public.dubbing_projects AS project
  WHERE project.content_type = 'toy'
    AND project.content_id <> 0
  GROUP BY project.content_id
), legacy_toys AS (
  SELECT DISTINCT ON (project.content_id)
    project.content_id,
    audit.user_id,
    audit.created_at,
    audit.new_value -> 'media_metadata' AS metadata
  FROM public.audit_logs AS audit
  JOIN public.dubbing_projects AS project
    ON audit.entity_id = project.id::TEXT
  WHERE audit.entity_type = 'dubbing_project'
    AND audit.action = 'create'
    AND project.content_type = 'toy'
    AND jsonb_typeof(audit.new_value -> 'media_metadata') = 'object'
    AND length(btrim(COALESCE(audit.new_value -> 'media_metadata' ->> 'name', ''))) BETWEEN 1 AND 300
  ORDER BY project.content_id, audit.created_at DESC, audit.id DESC
)
INSERT INTO public.toy_metadata (
  content_id, name, manufacturer, description, created_by, updated_by, created_at, updated_at
)
SELECT
  toy_content.content_id,
  COALESCE(
    NULLIF(btrim(legacy_toys.metadata ->> 'name'), ''),
    'Toy #' || toy_content.content_id::TEXT
  ),
  CASE
    WHEN length(btrim(COALESCE(legacy_toys.metadata ->> 'manufacturer', legacy_toys.metadata ->> 'brand', ''))) <= 300
      THEN COALESCE(
        NULLIF(btrim(legacy_toys.metadata ->> 'manufacturer'), ''),
        NULLIF(btrim(legacy_toys.metadata ->> 'brand'), '')
      )
    ELSE NULL
  END,
  CASE
    WHEN length(COALESCE(legacy_toys.metadata ->> 'description', '')) <= 10000
      THEN NULLIF(legacy_toys.metadata ->> 'description', '')
    ELSE NULL
  END,
  legacy_toys.user_id,
  legacy_toys.user_id,
  COALESCE(legacy_toys.created_at, toy_content.created_at, clock_timestamp()),
  COALESCE(legacy_toys.created_at, toy_content.created_at, clock_timestamp())
FROM toy_content
LEFT JOIN legacy_toys USING (content_id)
ON CONFLICT (content_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.controlled_save_toy_metadata(
  p_actor_id UUID,
  p_request_id UUID,
  p_content_id BIGINT,
  p_expected_updated_at TIMESTAMPTZ,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_metadata JSONB;
  v_fingerprint TEXT;
  v_existing_audit public.audit_logs%ROWTYPE;
  v_toy public.toy_metadata%ROWTYPE;
  v_before JSONB;
  v_audit_id UUID;
BEGIN
  IF p_actor_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'An authenticated administrator and request id are required'
      USING ERRCODE = '28000';
  END IF;

  SELECT users.raw_app_meta_data
  INTO v_actor_metadata
  FROM auth.users AS users
  WHERE users.id = p_actor_id
  FOR SHARE OF users;

  IF NOT FOUND OR v_actor_metadata ->> 'role' IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only an administrator can save toy metadata'
      USING ERRCODE = '42501';
  END IF;

  IF p_content_id IS NULL OR p_content_id = 0
     OR p_payload IS NULL
     OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
     OR NOT (p_payload ?& ARRAY[
       'name', 'manufacturer', 'product_line', 'release_year',
       'cover_url', 'description'
     ]::TEXT[])
     OR EXISTS (
       SELECT 1
       FROM jsonb_object_keys(p_payload) AS field(key)
       WHERE field.key <> ALL (ARRAY[
         'name', 'manufacturer', 'product_line', 'release_year',
         'cover_url', 'description'
       ]::TEXT[])
     ) THEN
    RAISE EXCEPTION 'Toy metadata contains an unknown, missing, or invalid field'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.dubbing_projects AS project
    WHERE project.content_id = p_content_id
      AND project.content_type = 'toy'
  ) THEN
    RAISE EXCEPTION 'Toy metadata must belong to an existing toy project'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_payload -> 'name') IS DISTINCT FROM 'string'
     OR length(btrim(p_payload ->> 'name')) NOT BETWEEN 1 AND 300
     OR jsonb_typeof(p_payload -> 'manufacturer') NOT IN ('string', 'null')
     OR jsonb_typeof(p_payload -> 'product_line') NOT IN ('string', 'null')
     OR jsonb_typeof(p_payload -> 'release_year') NOT IN ('number', 'null')
     OR jsonb_typeof(p_payload -> 'cover_url') NOT IN ('string', 'null')
     OR jsonb_typeof(p_payload -> 'description') NOT IN ('string', 'null') THEN
    RAISE EXCEPTION 'Toy metadata fields are invalid'
      USING ERRCODE = '22023';
  END IF;

  IF length(btrim(COALESCE(p_payload ->> 'manufacturer', ''))) > 300
     OR length(btrim(COALESCE(p_payload ->> 'product_line', ''))) > 300
     OR length(COALESCE(p_payload ->> 'description', '')) > 10000 THEN
    RAISE EXCEPTION 'Toy metadata text fields are too long'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_payload -> 'release_year') = 'number'
     AND (
       p_payload ->> 'release_year' !~ '^[0-9]{4}$'
       OR (p_payload ->> 'release_year')::INTEGER NOT BETWEEN 1800 AND 2200
     ) THEN
    RAISE EXCEPTION 'release_year must be between 1800 and 2200'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_payload -> 'cover_url') = 'string'
     AND (
       length(p_payload ->> 'cover_url') > 2048
       OR p_payload ->> 'cover_url' !~* '^https?://[^/[:space:]?#@]+(/[^[:space:]#?]*)?(\?[^[:space:]#]*)?(#[^[:space:]]*)?$'
       OR p_payload ->> 'cover_url' ~* '[?&](access[_-]?token|refresh[_-]?token|id[_-]?token|token|api[_-]?key|apikey|client[_-]?secret|secret|password|passwd|authorization)='
     ) THEN
    RAISE EXCEPTION 'cover_url must be a safe HTTP(S) URL'
      USING ERRCODE = '22023';
  END IF;

  v_fingerprint := md5(
    p_content_id::TEXT || ':' || COALESCE(p_expected_updated_at::TEXT, 'new') || ':' || p_payload::TEXT
  );

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_actor_id::TEXT || ':' || p_request_id::TEXT, 0)
  );

  SELECT audit.*
  INTO v_existing_audit
  FROM public.audit_logs AS audit
  WHERE audit.user_id = p_actor_id
    AND audit.request_id = p_request_id;

  IF FOUND THEN
    IF v_existing_audit.entity_type IS DISTINCT FROM 'toy_metadata'
       OR v_existing_audit.entity_id IS DISTINCT FROM p_content_id::TEXT
       OR v_existing_audit.request_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'Request id was already used with different toy metadata'
        USING ERRCODE = '23505';
    END IF;

    SELECT metadata.*
    INTO v_toy
    FROM public.toy_metadata AS metadata
    WHERE metadata.content_id = p_content_id
    FOR UPDATE;

    IF NOT FOUND OR to_jsonb(v_toy) IS DISTINCT FROM v_existing_audit.new_value THEN
      RAISE EXCEPTION 'Toy metadata changed after this save; reload before retrying'
        USING ERRCODE = '55000';
    END IF;

    RETURN jsonb_build_object(
      'record', to_jsonb(v_toy),
      'audit_log_id', v_existing_audit.id,
      'replayed', TRUE
    );
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('toy-metadata:' || p_content_id::TEXT, 0)
  );

  SELECT metadata.*
  INTO v_toy
  FROM public.toy_metadata AS metadata
  WHERE metadata.content_id = p_content_id
  FOR UPDATE;

  IF FOUND THEN
    IF p_expected_updated_at IS NULL OR v_toy.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'Toy metadata changed since it was loaded; reload before saving'
        USING ERRCODE = '55000';
    END IF;

    v_before := to_jsonb(v_toy);
    UPDATE public.toy_metadata AS metadata
    SET name = btrim(p_payload ->> 'name'),
        manufacturer = NULLIF(btrim(p_payload ->> 'manufacturer'), ''),
        product_line = NULLIF(btrim(p_payload ->> 'product_line'), ''),
        release_year = CASE
          WHEN jsonb_typeof(p_payload -> 'release_year') = 'number'
            THEN (p_payload ->> 'release_year')::INTEGER
          ELSE NULL
        END,
        cover_url = NULLIF(btrim(p_payload ->> 'cover_url'), ''),
        description = NULLIF(btrim(p_payload ->> 'description'), ''),
        updated_by = p_actor_id,
        updated_at = clock_timestamp()
    WHERE metadata.content_id = p_content_id
    RETURNING metadata.* INTO v_toy;
  ELSE
    IF p_expected_updated_at IS NOT NULL THEN
      RAISE EXCEPTION 'Toy metadata changed since it was loaded; reload before saving'
        USING ERRCODE = '55000';
    END IF;

    INSERT INTO public.toy_metadata (
      content_id, name, manufacturer, product_line, release_year,
      cover_url, description, created_by, updated_by
    ) VALUES (
      p_content_id,
      btrim(p_payload ->> 'name'),
      NULLIF(btrim(p_payload ->> 'manufacturer'), ''),
      NULLIF(btrim(p_payload ->> 'product_line'), ''),
      CASE
        WHEN jsonb_typeof(p_payload -> 'release_year') = 'number'
          THEN (p_payload ->> 'release_year')::INTEGER
        ELSE NULL
      END,
      NULLIF(btrim(p_payload ->> 'cover_url'), ''),
      NULLIF(btrim(p_payload ->> 'description'), ''),
      p_actor_id,
      p_actor_id
    )
    RETURNING * INTO v_toy;
  END IF;

  v_audit_id := pg_catalog.gen_random_uuid();
  INSERT INTO public.audit_logs (
    id, user_id, entity_type, entity_id, action,
    previous_value, new_value, changed_fields,
    request_id, request_fingerprint, metadata
  ) VALUES (
    v_audit_id,
    p_actor_id,
    'toy_metadata',
    p_content_id::TEXT,
    CASE WHEN v_before IS NULL THEN 'create' ELSE 'update' END,
    v_before,
    to_jsonb(v_toy),
    ARRAY[]::TEXT[],
    p_request_id,
    v_fingerprint,
    jsonb_build_object(
      'source', 'controlled_save_toy_metadata',
      'transaction_id', pg_catalog.pg_current_xact_id()::TEXT
    )
  )
  RETURNING id INTO v_audit_id;

  RETURN jsonb_build_object(
    'record', to_jsonb(v_toy),
    'audit_log_id', v_audit_id,
    'replayed', FALSE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.controlled_save_toy_metadata(UUID, UUID, BIGINT, TIMESTAMPTZ, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.controlled_save_toy_metadata(UUID, UUID, BIGINT, TIMESTAMPTZ, JSONB)
  TO service_role;

COMMENT ON FUNCTION public.controlled_save_toy_metadata(UUID, UUID, BIGINT, TIMESTAMPTZ, JSONB) IS
  'Creates or updates allowlisted toy metadata for a verified administrator and atomically records its audit snapshot.';

CREATE FUNCTION public.create_internal_dubbing_project_with_metadata(
  p_actor_id UUID,
  p_request_id UUID,
  p_media_type TEXT,
  p_language TEXT,
  p_name TEXT,
  p_brand TEXT,
  p_manufacturer TEXT,
  p_description TEXT,
  p_product_line TEXT,
  p_release_year INTEGER,
  p_cover_url TEXT
)
RETURNS TABLE(project_id BIGINT, content_id BIGINT, updated_at TIMESTAMP WITHOUT TIME ZONE, metadata_updated_at TIMESTAMPTZ, audit_log_id UUID, replayed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role TEXT;
  v_project public.dubbing_projects%ROWTYPE;
  v_toy public.toy_metadata%ROWTYPE;
  v_existing_audit public.audit_logs%ROWTYPE;
  v_content_id BIGINT;
  v_fingerprint TEXT;
  v_audit_id UUID;
  v_metadata JSONB;
BEGIN
  SELECT users.raw_app_meta_data ->> 'role'
  INTO v_role
  FROM auth.users AS users
  WHERE users.id = p_actor_id;
  IF p_actor_id IS NULL OR v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only an administrator can create internal media'
      USING ERRCODE = '42501';
  END IF;

  IF p_request_id IS NULL OR p_media_type NOT IN ('advertisement', 'toy')
     OR p_language IS NULL OR NOT public.is_valid_dubbing_language(p_language)
     OR p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 300
     OR length(COALESCE(p_brand, '')) > 300
     OR length(COALESCE(p_manufacturer, '')) > 300
     OR length(COALESCE(p_description, '')) > 10000
     OR length(COALESCE(p_product_line, '')) > 300
     OR (p_release_year IS NOT NULL AND p_release_year NOT BETWEEN 1800 AND 2200)
     OR (p_cover_url IS NOT NULL AND (
       length(p_cover_url) > 2048
       OR p_cover_url !~* '^https?://[^/[:space:]?#@]+(/[^[:space:]#?]*)?(\?[^[:space:]#]*)?(#[^[:space:]]*)?$'
       OR p_cover_url ~* '[?&](access[_-]?token|refresh[_-]?token|id[_-]?token|token|api[_-]?key|apikey|client[_-]?secret|secret|password|passwd|authorization)='
     ))
     OR (p_media_type <> 'toy' AND (p_product_line IS NOT NULL OR p_release_year IS NOT NULL OR p_cover_url IS NOT NULL)) THEN
    RAISE EXCEPTION 'Internal media fields are invalid'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_actor_id::TEXT || ':' || p_request_id::TEXT, 0)
  );
  v_metadata := jsonb_build_object(
    'name', p_name,
    'brand', p_brand,
    'manufacturer', p_manufacturer,
    'description', p_description
  );
  IF p_product_line IS NOT NULL THEN
    v_metadata := v_metadata || jsonb_build_object('product_line', p_product_line);
  END IF;
  IF p_release_year IS NOT NULL THEN
    v_metadata := v_metadata || jsonb_build_object('release_year', p_release_year);
  END IF;
  IF p_cover_url IS NOT NULL THEN
    v_metadata := v_metadata || jsonb_build_object('cover_url', p_cover_url);
  END IF;
  v_fingerprint := md5(jsonb_build_object(
    'media_type', p_media_type,
    'language', p_language,
    'metadata', v_metadata
  )::TEXT);

  SELECT audit.* INTO v_existing_audit
  FROM public.audit_logs AS audit
  WHERE audit.user_id = p_actor_id
    AND audit.request_id = p_request_id;
  IF FOUND THEN
    IF v_existing_audit.request_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'Request id was already used with different internal media data'
        USING ERRCODE = '23505';
    END IF;
    SELECT project.* INTO v_project
    FROM public.dubbing_projects AS project
    WHERE project.id = v_existing_audit.entity_id::BIGINT;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The project created by this request no longer exists'
        USING ERRCODE = '55000';
    END IF;
    IF p_media_type = 'toy' THEN
      SELECT metadata.* INTO v_toy
      FROM public.toy_metadata AS metadata
      WHERE metadata.content_id = v_project.content_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Toy metadata created by this request no longer exists'
          USING ERRCODE = '55000';
      END IF;
    END IF;
    RETURN QUERY SELECT v_project.id, v_project.content_id, v_project.updated_at, v_toy.updated_at, v_existing_audit.id, TRUE;
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('internal-media:' || p_media_type, 0)
  );
  SELECT COALESCE(min(project.content_id), 0) - 1
  INTO v_content_id
  FROM public.dubbing_projects AS project
  WHERE project.content_type = p_media_type
    AND project.content_id < 0;

  INSERT INTO public.dubbing_projects(content_id, content_type, language, status)
  VALUES (v_content_id, p_media_type, p_language, 'validated')
  RETURNING * INTO v_project;

  IF p_media_type = 'toy' THEN
    INSERT INTO public.toy_metadata (
      content_id, name, manufacturer, product_line, release_year,
      cover_url, description, created_by, updated_by
    ) VALUES (
      v_content_id,
      btrim(p_name),
      COALESCE(NULLIF(btrim(p_manufacturer), ''), NULLIF(btrim(p_brand), '')),
      NULLIF(btrim(p_product_line), ''),
      p_release_year,
      NULLIF(btrim(p_cover_url), ''),
      NULLIF(btrim(p_description), ''),
      p_actor_id,
      p_actor_id
    ) RETURNING * INTO v_toy;
  END IF;

  v_audit_id := pg_catalog.gen_random_uuid();
  INSERT INTO public.audit_logs (
    id, user_id, entity_type, entity_id, action,
    previous_value, new_value, changed_fields,
    request_id, request_fingerprint, metadata
  ) VALUES (
    v_audit_id, p_actor_id, 'dubbing_project', v_project.id::TEXT, 'create',
    jsonb_build_object(
      'project', NULL,
      'media_metadata', NULL,
      'crew', '[]'::JSONB,
      'cast', '[]'::JSONB
    ),
    jsonb_build_object(
      'project', to_jsonb(v_project),
      'media_metadata', v_metadata,
      'crew', '[]'::JSONB,
      'cast', '[]'::JSONB
    ),
    ARRAY[]::TEXT[], p_request_id, v_fingerprint,
    jsonb_build_object(
      'source', 'create_internal_dubbing_project',
      'media_type', p_media_type,
      'internal_media', v_metadata,
      'transaction_id', pg_catalog.pg_current_xact_id()::TEXT
    )
  );

  RETURN QUERY SELECT v_project.id, v_project.content_id, v_project.updated_at, v_toy.updated_at, v_audit_id, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.create_internal_dubbing_project_with_metadata(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_internal_dubbing_project_with_metadata(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT)
  TO service_role;

-- Keep the previous RPC signature available while website instances roll forward.
CREATE OR REPLACE FUNCTION public.create_internal_dubbing_project(
  p_actor_id UUID,
  p_request_id UUID,
  p_media_type TEXT,
  p_language TEXT,
  p_name TEXT,
  p_brand TEXT,
  p_manufacturer TEXT,
  p_description TEXT
)
RETURNS TABLE(project_id BIGINT, content_id BIGINT, audit_log_id UUID, replayed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT created.project_id, created.content_id, created.audit_log_id, created.replayed
  FROM public.create_internal_dubbing_project_with_metadata(
    p_actor_id,
    p_request_id,
    p_media_type,
    p_language,
    p_name,
    p_brand,
    p_manufacturer,
    p_description,
    NULL,
    NULL,
    NULL
  ) AS created;
END;
$$;

REVOKE ALL ON FUNCTION public.create_internal_dubbing_project(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_internal_dubbing_project(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  TO service_role;
