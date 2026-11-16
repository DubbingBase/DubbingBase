-- Open editing: any signed-in user with a confirmed email may contribute unless an admin
-- set app_metadata.blocked = true. Admins are exempt from the email check. The check reads
-- auth.users inside the write transaction, so a block takes effect immediately instead of
-- when the user's JWT is next refreshed.
CREATE OR REPLACE FUNCTION private.assert_contributor(p_actor_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_metadata JSONB;
  v_email_confirmed_at TIMESTAMPTZ;
BEGIN
  SELECT users.raw_app_meta_data, users.email_confirmed_at
  INTO v_metadata, v_email_confirmed_at
  FROM auth.users AS users
  WHERE users.id = p_actor_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The authenticated actor does not exist' USING ERRCODE = '28000';
  END IF;
  IF COALESCE(v_metadata ->> 'blocked' = 'true', FALSE) THEN
    RAISE EXCEPTION 'Contributions are blocked for this account' USING ERRCODE = '42501';
  END IF;
  IF v_email_confirmed_at IS NULL AND COALESCE(v_metadata ->> 'role' <> 'admin', TRUE) THEN
    RAISE EXCEPTION 'A confirmed email is required to contribute' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.assert_contributor(UUID) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.controlled_update_voice_actor(
  p_actor_id UUID,
  p_voice_actor_id BIGINT,
  p_payload JSONB,
  p_expected_updated_at TIMESTAMPTZ,
  p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_metadata JSONB;
  v_is_admin BOOLEAN;
  v_before public.voice_actors%ROWTYPE;
  v_after public.voice_actors%ROWTYPE;
  v_before_json JSONB;
  v_after_json JSONB;
  v_request_id UUID;
  v_payload_fingerprint TEXT;
  v_existing private.voice_actor_write_requests%ROWTYPE;
  v_audit_log_id UUID;
  v_result JSONB;
  v_key TEXT;
  v_value JSONB;
  v_url TEXT;
  v_max_length INTEGER;
BEGIN
  IF p_actor_id IS NULL OR p_voice_actor_id IS NULL OR p_voice_actor_id <= 0 THEN
    RAISE EXCEPTION 'A verified actor and voice actor id are required' USING ERRCODE = '22023';
  END IF;
  IF p_expected_updated_at IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'A request id and expected voice actor version are required' USING ERRCODE = '22023';
  END IF;

  SELECT users.raw_app_meta_data
  INTO v_actor_metadata
  FROM auth.users AS users
  WHERE users.id = p_actor_id
  FOR SHARE OF users;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Authenticated actor was not found' USING ERRCODE = '42501';
  END IF;
  v_is_admin := COALESCE(v_actor_metadata ->> 'role' = 'admin', FALSE);

  PERFORM private.assert_contributor(p_actor_id);

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' OR p_payload = '{}'::JSONB THEN
    RAISE EXCEPTION 'Voice actor update must be a non-empty object' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_payload) AS fields(key)
    WHERE fields.key <> ALL (ARRAY[
      'firstname', 'lastname', 'bio', 'nationality', 'date_of_birth',
      'awards', 'years_active', 'social_media_links', 'profile_picture',
      'tmdb_id', 'wikidata_id', 'status'
    ]::TEXT[])
  ) THEN
    RAISE EXCEPTION 'Voice actor update contains a protected or unknown field' USING ERRCODE = '22023';
  END IF;

  IF NOT v_is_admin AND EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_payload) AS fields(key)
    WHERE fields.key = ANY (ARRAY['profile_picture', 'status']::TEXT[])
  ) THEN
    RAISE EXCEPTION 'Voice actor update contains an administrator-only field' USING ERRCODE = '42501';
  END IF;

  IF p_payload ? 'firstname'
     AND (jsonb_typeof(p_payload -> 'firstname') IS DISTINCT FROM 'string'
       OR length(btrim(p_payload ->> 'firstname')) NOT BETWEEN 1 AND 120) THEN
    RAISE EXCEPTION 'firstname must contain 1 to 120 characters' USING ERRCODE = '22023';
  END IF;
  IF p_payload ? 'lastname'
     AND (jsonb_typeof(p_payload -> 'lastname') IS DISTINCT FROM 'string'
       OR length(btrim(p_payload ->> 'lastname')) NOT BETWEEN 1 AND 120) THEN
    RAISE EXCEPTION 'lastname must contain 1 to 120 characters' USING ERRCODE = '22023';
  END IF;

  FOR v_key IN SELECT unnest(ARRAY['bio', 'nationality', 'awards', 'years_active', 'profile_picture', 'wikidata_id']::TEXT[])
  LOOP
    IF p_payload ? v_key THEN
      v_value := p_payload -> v_key;
      IF jsonb_typeof(v_value) NOT IN ('string', 'null') THEN
        RAISE EXCEPTION '% must be a string or null', v_key USING ERRCODE = '22023';
      END IF;
      v_max_length := CASE v_key
        WHEN 'bio' THEN 10000
        WHEN 'awards' THEN 5000
        WHEN 'years_active' THEN 200
        WHEN 'profile_picture' THEN 2048
        WHEN 'wikidata_id' THEN 32
        ELSE 120
      END;
      IF jsonb_typeof(v_value) = 'string' AND length(v_value #>> '{}') > v_max_length THEN
        RAISE EXCEPTION '% is too long', v_key USING ERRCODE = '22023';
      END IF;
    END IF;
  END LOOP;

  IF p_payload ? 'date_of_birth'
     AND jsonb_typeof(p_payload -> 'date_of_birth') NOT IN ('string', 'null') THEN
    RAISE EXCEPTION 'date_of_birth must be an ISO date string or null' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_payload -> 'date_of_birth') = 'string'
     AND p_payload ->> 'date_of_birth' !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RAISE EXCEPTION 'date_of_birth must be an ISO date string' USING ERRCODE = '22023';
  END IF;

  IF p_payload ? 'tmdb_id'
     AND jsonb_typeof(p_payload -> 'tmdb_id') NOT IN ('number', 'null') THEN
    RAISE EXCEPTION 'tmdb_id must be a positive integer or null' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_payload -> 'tmdb_id') = 'number'
     AND (
       p_payload ->> 'tmdb_id' !~ '^[1-9][0-9]{0,18}$'
       OR (length(p_payload ->> 'tmdb_id') = 19 AND p_payload ->> 'tmdb_id' > '9223372036854775807')
     ) THEN
    RAISE EXCEPTION 'tmdb_id must be a positive integer' USING ERRCODE = '22023';
  END IF;

  IF p_payload ? 'wikidata_id'
     AND jsonb_typeof(p_payload -> 'wikidata_id') = 'string'
     AND p_payload ->> 'wikidata_id' !~ '^Q[1-9][0-9]*$' THEN
    RAISE EXCEPTION 'wikidata_id must be a Wikidata Q identifier' USING ERRCODE = '22023';
  END IF;

  IF p_payload ? 'status'
     AND jsonb_typeof(p_payload -> 'status') NOT IN ('string', 'null') THEN
    RAISE EXCEPTION 'status must be a string or null' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_payload -> 'status') = 'string'
     AND p_payload ->> 'status' <> ALL (ARRAY['active', 'not contacted', 'not answered']::TEXT[]) THEN
    RAISE EXCEPTION 'status is invalid' USING ERRCODE = '22023';
  END IF;

  IF p_payload ? 'profile_picture' AND jsonb_typeof(p_payload -> 'profile_picture') = 'string' THEN
    v_url := p_payload ->> 'profile_picture';
    IF v_url !~* '^https?://[^/[:space:]?#@]+(/[^?#[:space:]]*)?$'
       AND (v_url !~ '^/?[A-Za-z0-9_./-]+$' OR position('..' IN v_url) > 0) THEN
      RAISE EXCEPTION 'profile_picture must be a safe URL or storage path' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_payload ? 'social_media_links' AND p_payload -> 'social_media_links' <> 'null'::JSONB THEN
    IF jsonb_typeof(p_payload -> 'social_media_links') <> 'object' THEN
      RAISE EXCEPTION 'social_media_links must be an object or null' USING ERRCODE = '22023';
    END IF;
    FOR v_key, v_value IN
      SELECT fields.key, fields.value FROM jsonb_each(p_payload -> 'social_media_links') AS fields
    LOOP
      IF v_key !~ '^[a-z][a-z0-9_-]{0,39}$'
         OR jsonb_typeof(v_value) NOT IN ('string', 'null') THEN
        RAISE EXCEPTION 'social_media_links contains an invalid entry' USING ERRCODE = '22023';
      END IF;
      IF jsonb_typeof(v_value) = 'string' THEN
        v_url := v_value #>> '{}';
        IF length(v_url) > 2048
           OR v_url !~* '^https?://[^/[:space:]?#@]+(/[^?#[:space:]]*)?$' THEN
          RAISE EXCEPTION 'social_media_links values must be safe HTTP(S) URLs' USING ERRCODE = '22023';
        END IF;
      END IF;
    END LOOP;
  END IF;

  IF p_request_id IS NOT NULL THEN
    v_payload_fingerprint := md5(
      p_voice_actor_id::TEXT || ':' || COALESCE(p_expected_updated_at::TEXT, '<none>') || ':' || p_payload::TEXT
    );
    v_request_id := p_request_id;

    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(p_actor_id::TEXT || ':' || v_request_id::TEXT, 0)
    );

    SELECT request.*
    INTO v_existing
    FROM private.voice_actor_write_requests AS request
    WHERE request.actor_id = p_actor_id AND request.request_id = v_request_id;

    IF FOUND THEN
      IF v_existing.voice_actor_id IS DISTINCT FROM p_voice_actor_id
         OR v_existing.payload_fingerprint IS DISTINCT FROM v_payload_fingerprint THEN
        RAISE EXCEPTION 'Request id was already used with different voice actor data' USING ERRCODE = '23505';
      END IF;
      RETURN v_existing.result || jsonb_build_object('replayed', TRUE);
    END IF;
  END IF;

  SELECT actor.*
  INTO v_before
  FROM public.voice_actors AS actor
  WHERE actor.id = p_voice_actor_id
  FOR UPDATE OF actor;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Voice actor not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_expected_updated_at IS NOT NULL AND v_before.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Voice actor was changed by another request' USING ERRCODE = '40001';
  END IF;

  v_before_json := to_jsonb(v_before);
  v_after := jsonb_populate_record(v_before, p_payload);
  IF (to_jsonb(v_after) - ARRAY['updated_at', 'updated_by']::TEXT[])
     IS NOT DISTINCT FROM (v_before_json - ARRAY['updated_at', 'updated_by']::TEXT[]) THEN
    v_result := jsonb_build_object(
      'record', v_before_json,
      'audit_log_id', NULL,
      'changed', FALSE,
      'replayed', FALSE
    );
  ELSE
    PERFORM pg_catalog.set_config('request.jwt.claim.sub', p_actor_id::TEXT, TRUE);
    UPDATE public.voice_actors AS actor
    SET firstname = v_after.firstname,
        lastname = v_after.lastname,
        bio = v_after.bio,
        nationality = v_after.nationality,
        date_of_birth = v_after.date_of_birth,
        awards = v_after.awards,
        years_active = v_after.years_active,
        social_media_links = v_after.social_media_links,
        profile_picture = v_after.profile_picture,
        tmdb_id = v_after.tmdb_id,
        wikidata_id = v_after.wikidata_id,
        status = v_after.status
    WHERE actor.id = p_voice_actor_id
    RETURNING to_jsonb(actor) INTO v_after_json;

    INSERT INTO public.audit_logs (
      user_id, entity_type, entity_id, action,
      previous_value, new_value, points_awarded, created_at
    ) VALUES (
      p_actor_id, 'voice_actor', p_voice_actor_id::TEXT, 'update',
      v_before_json, v_after_json, 0, clock_timestamp()
    )
    RETURNING id INTO v_audit_log_id;

    v_result := jsonb_build_object(
      'record', v_after_json,
      'audit_log_id', v_audit_log_id,
      'changed', TRUE,
      'replayed', FALSE
    );
  END IF;

  IF p_request_id IS NOT NULL THEN
    INSERT INTO private.voice_actor_write_requests (
      actor_id, request_id, voice_actor_id, payload_fingerprint, audit_log_id, result
    ) VALUES (
      p_actor_id, v_request_id, p_voice_actor_id, v_payload_fingerprint, v_audit_log_id, v_result
    );
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.controlled_update_voice_actor(UUID, BIGINT, JSONB, TIMESTAMPTZ, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.controlled_update_voice_actor(UUID, BIGINT, JSONB, TIMESTAMPTZ, UUID)
  TO service_role;

COMMENT ON FUNCTION public.controlled_update_voice_actor(UUID, BIGINT, JSONB, TIMESTAMPTZ, UUID) IS
  'Updates allowlisted voice actor fields for any confirmed, unblocked contributor (profile_picture and status stay admin-only) and commits a full before/after audit snapshot atomically.';

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

  PERFORM private.assert_contributor(p_actor_id);

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
  'Serializes studio creation and edits by any confirmed, unblocked contributor, validates the field allowlist, and commits a typed before/after audit event atomically. Retries are keyed by user and request UUID.';
