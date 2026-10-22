ALTER TABLE public.audit_logs
  ADD COLUMN changed_fields TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN request_id UUID,
  ADD COLUMN request_fingerprint TEXT,
  ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::JSONB;

UPDATE public.audit_logs AS audit
SET changed_fields = COALESCE(
  (
    SELECT array_agg(fields.field_name ORDER BY fields.field_name)
    FROM (
      SELECT keys.field_name
      FROM jsonb_object_keys(
        CASE WHEN jsonb_typeof(audit.previous_value) = 'object'
          THEN audit.previous_value ELSE '{}'::JSONB END
      ) AS keys(field_name)
      UNION
      SELECT keys.field_name
      FROM jsonb_object_keys(
        CASE WHEN jsonb_typeof(audit.new_value) = 'object'
          THEN audit.new_value ELSE '{}'::JSONB END
      ) AS keys(field_name)
    ) AS fields
    WHERE (audit.previous_value -> fields.field_name)
      IS DISTINCT FROM (audit.new_value -> fields.field_name)
  ),
  ARRAY[]::TEXT[]
)
WHERE cardinality(audit.changed_fields) = 0
  AND (audit.previous_value IS NOT NULL OR audit.new_value IS NOT NULL);

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_request_fingerprint_pair
  CHECK ((request_id IS NULL) = (request_fingerprint IS NULL));

CREATE UNIQUE INDEX audit_logs_user_request_id_unique
  ON public.audit_logs (user_id, request_id)
  WHERE request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.protect_audit_log_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Database owners retain maintenance access. Runtime roles may only mark an
  -- event as reverted; its actor, target, snapshots, and request data stay fixed.
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Audit history cannot be deleted' USING ERRCODE = '55000';
  END IF;

  IF (to_jsonb(NEW) - 'reverted_at') IS DISTINCT FROM (to_jsonb(OLD) - 'reverted_at')
     OR OLD.reverted_at IS NOT NULL
     OR NEW.reverted_at IS NULL THEN
    RAISE EXCEPTION 'Audit history is immutable' USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_audit_log_history ON public.audit_logs;
CREATE TRIGGER protect_audit_log_history
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.protect_audit_log_history();

CREATE OR REPLACE FUNCTION public.populate_audit_log_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  SELECT COALESCE(array_agg(fields.field_name ORDER BY fields.field_name), ARRAY[]::TEXT[])
  INTO NEW.changed_fields
  FROM (
    SELECT keys.field_name
    FROM jsonb_object_keys(
      CASE WHEN jsonb_typeof(NEW.previous_value) = 'object'
        THEN NEW.previous_value ELSE '{}'::JSONB END
    ) AS keys(field_name)
    UNION
    SELECT keys.field_name
    FROM jsonb_object_keys(
      CASE WHEN jsonb_typeof(NEW.new_value) = 'object'
        THEN NEW.new_value ELSE '{}'::JSONB END
    ) AS keys(field_name)
  ) AS fields
  WHERE (NEW.previous_value -> fields.field_name)
    IS DISTINCT FROM (NEW.new_value -> fields.field_name);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.populate_audit_log_fields() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS populate_audit_log_fields ON public.audit_logs;
CREATE TRIGGER populate_audit_log_fields
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.populate_audit_log_fields();

REVOKE ALL ON public.audit_logs FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.audit_logs TO authenticated, service_role;
GRANT INSERT ON public.audit_logs TO service_role;
GRANT UPDATE (reverted_at) ON public.audit_logs TO service_role;
REVOKE TRUNCATE ON public.audit_logs FROM PUBLIC, anon, authenticated, service_role;

DROP POLICY IF EXISTS "Allow authenticated write access to studios" ON public.studios;
DROP POLICY IF EXISTS "Allow authenticated insert to studios" ON public.studios;
DROP POLICY IF EXISTS "Allow authenticated update to studios" ON public.studios;
CREATE POLICY "Allow trusted editor writes to studios" ON public.studios
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'editor'))
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'editor'));

REVOKE ALL ON public.studios FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.studios TO anon, authenticated, service_role;
GRANT INSERT (name, description, country, city, website_url, logo_url, social_media_links)
  ON public.studios TO authenticated;
GRANT UPDATE (name, description, country, city, website_url, logo_url, social_media_links)
  ON public.studios TO authenticated;
GRANT DELETE ON public.studios TO authenticated;

CREATE OR REPLACE FUNCTION public.touch_studio_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF ROW(NEW.name, NEW.description, NEW.country, NEW.city, NEW.website_url, NEW.logo_url, NEW.social_media_links)
     IS DISTINCT FROM
     ROW(OLD.name, OLD.description, OLD.country, OLD.city, OLD.website_url, OLD.logo_url, OLD.social_media_links) THEN
    NEW.updated_at := clock_timestamp();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_studio_updated_at() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS touch_studio_updated_at ON public.studios;
CREATE TRIGGER touch_studio_updated_at
  BEFORE UPDATE ON public.studios
  FOR EACH ROW EXECUTE FUNCTION public.touch_studio_updated_at();

CREATE OR REPLACE FUNCTION public.audit_studio_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_before JSONB := '{}'::JSONB;
  v_after JSONB := '{}'::JSONB;
  v_changed_fields TEXT[] := ARRAY[]::TEXT[];
  v_key TEXT;
  v_old_value JSONB;
  v_new_value JSONB;
  v_entity_id BIGINT;
  v_action TEXT;
BEGIN
  -- Service-role contribution submission has its own transaction-bound audit.
  -- Schema migrations and database owners are maintenance paths, not user edits.
  IF current_setting('app.skip_studio_audit', TRUE) = 'true' OR v_actor_id IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_entity_id := NEW.id;
    v_action := 'create';
    v_after := to_jsonb(NEW);
    SELECT array_agg(fields.key ORDER BY fields.key)
    INTO v_changed_fields
    FROM jsonb_object_keys(v_after) AS fields(key);
  ELSIF TG_OP = 'UPDATE' THEN
    v_entity_id := NEW.id;
    v_action := 'update';
    FOREACH v_key IN ARRAY ARRAY[
      'name', 'description', 'country', 'city', 'website_url', 'logo_url', 'social_media_links'
    ]::TEXT[]
    LOOP
      v_old_value := to_jsonb(OLD) -> v_key;
      v_new_value := to_jsonb(NEW) -> v_key;
      IF v_old_value IS DISTINCT FROM v_new_value THEN
        v_before := v_before || jsonb_build_object(v_key, v_old_value);
        v_after := v_after || jsonb_build_object(v_key, v_new_value);
        v_changed_fields := array_append(v_changed_fields, v_key);
      END IF;
    END LOOP;
    IF cardinality(v_changed_fields) = 0 THEN
      RETURN NEW;
    END IF;
  ELSE
    v_entity_id := OLD.id;
    v_action := 'delete';
    v_before := to_jsonb(OLD);
    SELECT array_agg(fields.key ORDER BY fields.key)
    INTO v_changed_fields
    FROM jsonb_object_keys(v_before) AS fields(key);
  END IF;

  INSERT INTO public.audit_logs (
    user_id, entity_type, entity_id, action,
    previous_value, new_value, changed_fields, metadata
  ) VALUES (
    v_actor_id,
    'studio',
    v_entity_id::TEXT,
    v_action,
    v_before,
    v_after,
    COALESCE(v_changed_fields, ARRAY[]::TEXT[]),
    jsonb_build_object(
      'source', 'database_trigger',
      'operation', v_action,
      'transaction_id', pg_catalog.pg_current_xact_id()::TEXT
    )
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_studio_mutation() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS audit_studio_mutation ON public.studios;
CREATE TRIGGER audit_studio_mutation
  AFTER INSERT OR UPDATE OR DELETE ON public.studios
  FOR EACH ROW EXECUTE FUNCTION public.audit_studio_mutation();

CREATE OR REPLACE FUNCTION public.controlled_save_studio(
  p_actor_id UUID,
  p_studio_id BIGINT,
  p_expected_updated_at TIMESTAMP WITHOUT TIME ZONE,
  p_request_id UUID,
  p_updates JSONB
)
RETURNS TABLE(studio_id BIGINT, audit_log_id UUID, replayed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_metadata JSONB;
  v_can_edit_logo BOOLEAN;
  v_prior_skip_audit TEXT;
  v_key TEXT;
  v_value JSONB;
  v_url TEXT;
  v_studio public.studios%ROWTYPE;
  v_original_studio public.studios%ROWTYPE;
  v_existing_audit public.audit_logs%ROWTYPE;
  v_fingerprint TEXT;
  v_previous JSONB := '{}'::JSONB;
  v_new JSONB := '{}'::JSONB;
  v_old_value JSONB;
  v_new_value JSONB;
  v_changed_fields TEXT[] := ARRAY[]::TEXT[];
  v_action TEXT;
  v_audit_id UUID;
BEGIN
  IF p_actor_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'A verified actor and request id are required' USING ERRCODE = '28000';
  END IF;

  SELECT users.raw_app_meta_data
  INTO v_actor_metadata
  FROM auth.users AS users
  WHERE users.id = p_actor_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The authenticated actor does not exist' USING ERRCODE = '28000';
  END IF;

  v_can_edit_logo := COALESCE(v_actor_metadata ->> 'role' IN ('admin', 'editor'), FALSE);

  IF p_updates IS NULL OR jsonb_typeof(p_updates) <> 'object'
     OR p_updates = '{}'::JSONB THEN
    RAISE EXCEPTION 'Studio updates must be a non-empty object' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_updates) AS fields(field_name)
    WHERE field_name <> ALL (ARRAY[
      'name', 'description', 'country', 'city', 'website_url',
      'logo_url', 'social_media_links'
    ]::TEXT[])
  ) THEN
    RAISE EXCEPTION 'Studio update contains a protected or unknown field' USING ERRCODE = '22023';
  END IF;

  FOR v_key, v_value IN SELECT fields.key, fields.value FROM jsonb_each(p_updates) AS fields
  LOOP
    IF v_key = 'social_media_links' THEN
      IF jsonb_typeof(v_value) <> 'object' THEN
        RAISE EXCEPTION 'social_media_links must be an object' USING ERRCODE = '22023';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM jsonb_each(v_value) AS socials(key, value)
        WHERE socials.key <> ALL (ARRAY['twitter', 'instagram', 'tiktok', 'facebook']::TEXT[])
           OR jsonb_typeof(socials.value) NOT IN ('string', 'null')
           OR (jsonb_typeof(socials.value) = 'string' AND (
             length(socials.value #>> '{}') > 2048
             OR socials.value #>> '{}' !~* '^https?://[^[:space:]]+$'
             OR socials.value #>> '{}' ~* '^https?://[^/]*@'
           ))
      ) THEN
        RAISE EXCEPTION 'social_media_links contains an invalid field or URL' USING ERRCODE = '22023';
      END IF;
    ELSE
      IF jsonb_typeof(v_value) NOT IN ('string', 'null') THEN
        RAISE EXCEPTION '% must be a string or null', v_key USING ERRCODE = '22023';
      END IF;

      IF v_key = 'name' AND (
        jsonb_typeof(v_value) <> 'string'
        OR length(btrim(p_updates ->> v_key)) NOT BETWEEN 1 AND 200
      ) THEN
        RAISE EXCEPTION 'name must contain 1 to 200 characters' USING ERRCODE = '22023';
      END IF;

      IF v_key = 'description' AND v_value <> 'null'::JSONB AND length(p_updates ->> v_key) > 10000 THEN
        RAISE EXCEPTION 'description is too long' USING ERRCODE = '22023';
      END IF;

      IF v_key = 'country' AND v_value <> 'null'::JSONB AND length(p_updates ->> v_key) > 100 THEN
        RAISE EXCEPTION 'country is too long' USING ERRCODE = '22023';
      END IF;

      IF v_key = 'city' AND v_value <> 'null'::JSONB AND length(p_updates ->> v_key) > 200 THEN
        RAISE EXCEPTION 'city is too long' USING ERRCODE = '22023';
      END IF;

      IF v_key IN ('website_url', 'logo_url') AND v_value <> 'null'::JSONB THEN
        v_url := p_updates ->> v_key;
        IF length(v_url) > 2048 OR v_url !~* '^https?://[^[:space:]]+$'
           OR v_url ~* '^https?://[^/]*@' THEN
          RAISE EXCEPTION '% must be an absolute HTTP(S) URL', v_key USING ERRCODE = '22023';
        END IF;
      END IF;

    END IF;
  END LOOP;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_actor_id::TEXT || ':' || p_request_id::TEXT, 0)
  );

  v_fingerprint := md5(COALESCE(p_studio_id::TEXT, 'create') || ':' || p_updates::TEXT);

  SELECT audit.*
  INTO v_existing_audit
  FROM public.audit_logs AS audit
  WHERE audit.user_id = p_actor_id
    AND audit.request_id = p_request_id;

  IF FOUND THEN
    IF v_existing_audit.request_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'Request id was already used with different studio data' USING ERRCODE = '23505';
    END IF;
    RETURN QUERY SELECT v_existing_audit.entity_id::BIGINT, v_existing_audit.id, TRUE;
    RETURN;
  END IF;

  IF p_studio_id IS NULL THEN
    IF NOT (p_updates ? 'name') THEN
      RAISE EXCEPTION 'name is required when creating a studio' USING ERRCODE = '22023';
    END IF;
    IF p_updates ? 'logo_url'
       AND p_updates -> 'logo_url' <> 'null'::JSONB
       AND NOT v_can_edit_logo THEN
      RAISE EXCEPTION 'Only an admin or editor can change a studio logo' USING ERRCODE = '42501';
    END IF;

    v_prior_skip_audit := current_setting('app.skip_studio_audit', TRUE);
    PERFORM set_config('app.skip_studio_audit', 'true', TRUE);

    INSERT INTO public.studios (
      name, description, country, city, website_url, logo_url, social_media_links
    ) VALUES (
      btrim(p_updates ->> 'name'),
      CASE WHEN p_updates ? 'description' THEN p_updates ->> 'description' END,
      CASE WHEN p_updates ? 'country' THEN p_updates ->> 'country' END,
      CASE WHEN p_updates ? 'city' THEN p_updates ->> 'city' END,
      CASE WHEN p_updates ? 'website_url' THEN p_updates ->> 'website_url' END,
      CASE WHEN p_updates ? 'logo_url' THEN p_updates ->> 'logo_url' END,
      CASE WHEN p_updates ? 'social_media_links' THEN p_updates -> 'social_media_links' END
    ) RETURNING * INTO v_studio;
    PERFORM set_config('app.skip_studio_audit', COALESCE(v_prior_skip_audit, 'false'), TRUE);

    v_action := 'create';
    v_new := to_jsonb(v_studio);
    SELECT array_agg(fields.key ORDER BY fields.key)
    INTO v_changed_fields
    FROM jsonb_object_keys(v_new) AS fields(key);
  ELSE
    SELECT studio.* INTO v_studio
    FROM public.studios AS studio
    WHERE studio.id = p_studio_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Studio not found' USING ERRCODE = 'P0002';
    END IF;

    IF p_expected_updated_at IS NULL THEN
      RAISE EXCEPTION 'An expected studio version is required' USING ERRCODE = '22023';
    END IF;

    IF v_studio.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'Studio changed since it was loaded' USING ERRCODE = '40001';
    END IF;

    v_original_studio := v_studio;
    FOR v_key IN SELECT fields.key FROM jsonb_object_keys(p_updates) AS fields(key)
    LOOP
      v_old_value := to_jsonb(v_original_studio) -> v_key;
      v_new_value := CASE
        WHEN v_key = 'social_media_links' THEN
          COALESCE(NULLIF(v_old_value, 'null'::JSONB), '{}'::JSONB) || (p_updates -> v_key)
        WHEN v_key = 'name' THEN to_jsonb(btrim(p_updates ->> v_key))
        ELSE p_updates -> v_key
      END;
      IF v_key = 'logo_url'
         AND v_old_value IS DISTINCT FROM v_new_value
         AND NOT v_can_edit_logo THEN
        RAISE EXCEPTION 'Only an admin or editor can change a studio logo' USING ERRCODE = '42501';
      END IF;
      IF v_old_value IS DISTINCT FROM v_new_value THEN
        v_previous := v_previous || jsonb_build_object(v_key, v_old_value);
        v_new := v_new || jsonb_build_object(v_key, v_new_value);
        v_changed_fields := array_append(v_changed_fields, v_key);
      END IF;
    END LOOP;

    IF cardinality(v_changed_fields) > 0 THEN
      v_prior_skip_audit := current_setting('app.skip_studio_audit', TRUE);
      PERFORM set_config('app.skip_studio_audit', 'true', TRUE);

      UPDATE public.studios AS studio
      SET name = CASE WHEN p_updates ? 'name' THEN btrim(p_updates ->> 'name') ELSE studio.name END,
          description = CASE WHEN p_updates ? 'description' THEN p_updates ->> 'description' ELSE studio.description END,
          country = CASE WHEN p_updates ? 'country' THEN p_updates ->> 'country' ELSE studio.country END,
          city = CASE WHEN p_updates ? 'city' THEN p_updates ->> 'city' ELSE studio.city END,
          website_url = CASE WHEN p_updates ? 'website_url' THEN p_updates ->> 'website_url' ELSE studio.website_url END,
          logo_url = CASE WHEN p_updates ? 'logo_url' THEN p_updates ->> 'logo_url' ELSE studio.logo_url END,
          social_media_links = CASE
            WHEN p_updates ? 'social_media_links' THEN
              COALESCE(NULLIF(studio.social_media_links, 'null'::JSONB), '{}'::JSONB)
                || (p_updates -> 'social_media_links')
            ELSE studio.social_media_links
          END,
          updated_at = clock_timestamp()
      WHERE studio.id = p_studio_id
      RETURNING studio.* INTO v_studio;
      PERFORM set_config('app.skip_studio_audit', COALESCE(v_prior_skip_audit, 'false'), TRUE);
      v_action := 'update';
      v_new := '{}'::JSONB;
      FOREACH v_key IN ARRAY v_changed_fields
      LOOP
        v_new := v_new || jsonb_build_object(v_key, to_jsonb(v_studio) -> v_key);
      END LOOP;
    ELSE
      v_action := 'noop';
    END IF;
  END IF;

  INSERT INTO public.audit_logs (
    user_id, entity_type, entity_id, action, previous_value, new_value,
    changed_fields, request_id, request_fingerprint, metadata
  ) VALUES (
    p_actor_id,
    'studio',
    v_studio.id::TEXT,
    v_action,
    v_previous,
    v_new,
    v_changed_fields,
    p_request_id,
    v_fingerprint,
    jsonb_build_object('source', '/api/save-studio', 'operation', v_action)
  ) RETURNING id INTO v_audit_id;

  IF v_audit_id IS NULL THEN
    RAISE EXCEPTION 'Studio write could not create its audit event';
  END IF;

  RETURN QUERY SELECT v_studio.id, v_audit_id, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.controlled_save_studio(UUID, BIGINT, TIMESTAMP WITHOUT TIME ZONE, UUID, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.controlled_save_studio(UUID, BIGINT, TIMESTAMP WITHOUT TIME ZONE, UUID, JSONB)
  TO service_role;

COMMENT ON FUNCTION public.controlled_save_studio(UUID, BIGINT, TIMESTAMP WITHOUT TIME ZONE, UUID, JSONB) IS
  'Serializes authorized studio creation and edits, validates the field allowlist, and commits a typed before/after audit event atomically. Retries are keyed by user and request UUID.';

CREATE OR REPLACE FUNCTION public.get_recent_contributions(limit_param INTEGER DEFAULT 10)
RETURNS TABLE(
  id UUID,
  user_name TEXT,
  action TEXT,
  entity_type TEXT,
  entity_id TEXT,
  entity_name TEXT,
  points_awarded INTEGER,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    audit.id,
    COALESCE(
      auth_user.raw_user_meta_data->>'username',
      auth_user.raw_user_meta_data->>'full_name',
      'Anonymous Contributor'
    ) AS user_name,
    audit.action,
    audit.entity_type,
    audit.entity_id,
    CASE
      WHEN audit.entity_type IN ('voice_actors', 'voice_actor') THEN (
        SELECT actor.firstname || COALESCE(' ' || actor.lastname, '')
        FROM public.voice_actors AS actor
        WHERE actor.id::TEXT = audit.entity_id
        LIMIT 1
      )
      WHEN audit.entity_type IN ('studios', 'studio') THEN (
        SELECT studio.name
        FROM public.studios AS studio
        WHERE studio.id::TEXT = audit.entity_id
        LIMIT 1
      )
      ELSE 'Unknown'
    END AS entity_name,
    audit.points_awarded,
    audit.created_at
  FROM public.audit_logs AS audit
  JOIN auth.users AS auth_user ON auth_user.id = audit.user_id
  WHERE audit.action <> 'noop'
  ORDER BY audit.created_at DESC
  LIMIT limit_param;
END;
$$;
