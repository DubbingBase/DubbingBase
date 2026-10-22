CREATE SCHEMA IF NOT EXISTS private;
ALTER SCHEMA private OWNER TO postgres;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE private.voice_actor_write_requests (
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  request_id UUID NOT NULL,
  voice_actor_id BIGINT NOT NULL,
  payload_fingerprint TEXT NOT NULL,
  audit_log_id UUID REFERENCES public.audit_logs(id) ON DELETE RESTRICT,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (actor_id, request_id)
);

ALTER TABLE private.voice_actor_write_requests OWNER TO postgres;
ALTER TABLE private.voice_actor_write_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.voice_actor_write_requests FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.protect_voice_actor_audit_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.entity_type = 'voice_actor' THEN
      RAISE EXCEPTION 'Voice actor audit history cannot be deleted' USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.entity_type = 'voice_actor' OR NEW.entity_type = 'voice_actor' THEN
    IF (to_jsonb(NEW) - 'reverted_at') IS DISTINCT FROM (to_jsonb(OLD) - 'reverted_at')
       OR OLD.reverted_at IS NOT NULL
       OR NEW.reverted_at IS NULL
       OR current_user <> 'service_role' THEN
      RAISE EXCEPTION 'Voice actor audit history is immutable' USING ERRCODE = '55000';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_voice_actor_audit_history() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS protect_voice_actor_audit_history ON public.audit_logs;
CREATE TRIGGER protect_voice_actor_audit_history
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.protect_voice_actor_audit_history();

REVOKE ALL ON public.audit_logs FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.audit_logs TO authenticated, service_role;
GRANT INSERT ON public.audit_logs TO service_role;
GRANT UPDATE (reverted_at) ON public.audit_logs TO service_role;
REVOKE TRUNCATE ON public.audit_logs FROM PUBLIC, anon, authenticated, service_role;

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
  v_link_id UUID;
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

  IF NOT v_is_admin THEN
    SELECT link.id
    INTO v_link_id
    FROM public.user_voice_actor_links AS link
    WHERE link.user_id = p_actor_id AND link.voice_actor_id = p_voice_actor_id
    FOR KEY SHARE OF link;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Actor is not linked to this voice actor' USING ERRCODE = '42501';
    END IF;
  END IF;

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
    WHERE fields.key = ANY (ARRAY['firstname', 'lastname', 'profile_picture', 'tmdb_id', 'wikidata_id', 'status']::TEXT[])
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
  'Updates allowlisted voice actor fields for an admin or linked user and commits a full before/after audit snapshot atomically.';
