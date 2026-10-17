CREATE SCHEMA IF NOT EXISTS private;
ALTER SCHEMA private OWNER TO postgres;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE private.metadata_write_requests (
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  request_id UUID NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('job', 'voice_actor')),
  payload_fingerprint TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  audit_log_id UUID NOT NULL REFERENCES public.audit_logs(id) ON DELETE RESTRICT,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (actor_id, request_id)
);

ALTER TABLE private.metadata_write_requests OWNER TO postgres;
ALTER TABLE private.metadata_write_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.metadata_write_requests FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.protect_metadata_audit_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.entity_type IN ('job', 'voice_actor') THEN
      RAISE EXCEPTION 'Metadata audit history cannot be deleted' USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.entity_type IN ('job', 'voice_actor') OR NEW.entity_type IN ('job', 'voice_actor') THEN
    IF (to_jsonb(NEW) - 'reverted_at') IS DISTINCT FROM (to_jsonb(OLD) - 'reverted_at')
       OR OLD.reverted_at IS NOT NULL
       OR NEW.reverted_at IS NULL
       OR current_user <> 'service_role' THEN
      RAISE EXCEPTION 'Metadata audit history is immutable' USING ERRCODE = '55000';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_metadata_audit_history() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS protect_metadata_audit_history ON public.audit_logs;
CREATE TRIGGER protect_metadata_audit_history
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.protect_metadata_audit_history();

REVOKE ALL ON public.audit_logs FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.audit_logs TO authenticated, service_role;
GRANT INSERT ON public.audit_logs TO service_role;
GRANT UPDATE (reverted_at) ON public.audit_logs TO service_role;
REVOKE TRUNCATE ON public.audit_logs FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.controlled_save_metadata(
  p_actor_id UUID,
  p_entity_type TEXT,
  p_payload JSONB,
  p_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_metadata JSONB;
  v_request_id UUID;
  v_payload_fingerprint TEXT;
  v_existing private.metadata_write_requests%ROWTYPE;
  v_record JSONB;
  v_entity_id TEXT;
  v_audit_log_id UUID;
  v_result JSONB;
  v_key TEXT;
  v_value JSONB;
  v_url TEXT;
  v_social_key TEXT;
  v_social_value JSONB;
  v_max_length INTEGER;
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'A verified actor is required' USING ERRCODE = '28000';
  END IF;

  SELECT users.raw_app_meta_data
  INTO v_actor_metadata
  FROM auth.users AS users
  WHERE users.id = p_actor_id
  FOR SHARE OF users;

  IF NOT FOUND OR v_actor_metadata ->> 'role' IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only an administrator can save metadata' USING ERRCODE = '42501';
  END IF;

  IF p_entity_type IS NULL OR p_entity_type NOT IN ('job', 'voice_actor') THEN
    RAISE EXCEPTION 'Invalid metadata entity type' USING ERRCODE = '22023';
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' OR p_payload = '{}'::JSONB THEN
    RAISE EXCEPTION 'Metadata payload must be a non-empty object' USING ERRCODE = '22023';
  END IF;

  IF p_entity_type = 'job' THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_payload) AS fields(key)
      WHERE fields.key <> 'name'
    ) THEN
      RAISE EXCEPTION 'Job payload contains a protected or unknown field' USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(p_payload -> 'name') IS DISTINCT FROM 'string'
       OR length(btrim(p_payload ->> 'name')) NOT BETWEEN 1 AND 120 THEN
      RAISE EXCEPTION 'Job name must contain 1 to 120 characters' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_payload) AS fields(key)
      WHERE fields.key <> ALL (ARRAY[
        'firstname', 'lastname', 'bio', 'nationality', 'date_of_birth',
        'awards', 'years_active', 'social_media_links', 'profile_picture',
        'tmdb_id', 'wikidata_id', 'status'
      ]::TEXT[])
    ) THEN
      RAISE EXCEPTION 'Voice actor payload contains a protected or unknown field' USING ERRCODE = '22023';
    END IF;

    IF jsonb_typeof(p_payload -> 'firstname') IS DISTINCT FROM 'string'
       OR length(btrim(p_payload ->> 'firstname')) NOT BETWEEN 1 AND 120
       OR jsonb_typeof(p_payload -> 'lastname') IS DISTINCT FROM 'string'
       OR length(btrim(p_payload ->> 'lastname')) NOT BETWEEN 1 AND 120 THEN
      RAISE EXCEPTION 'Voice actor first and last names are required' USING ERRCODE = '22023';
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
         OR (
           length(p_payload ->> 'tmdb_id') = 19
           AND p_payload ->> 'tmdb_id' > '9223372036854775807'
         )
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

    IF jsonb_typeof(p_payload -> 'profile_picture') = 'string' THEN
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
      FOR v_social_key, v_social_value IN
        SELECT fields.key, fields.value FROM jsonb_each(p_payload -> 'social_media_links') AS fields
      LOOP
        IF v_social_key !~ '^[a-z][a-z0-9_-]{0,39}$'
           OR jsonb_typeof(v_social_value) NOT IN ('string', 'null') THEN
          RAISE EXCEPTION 'social_media_links contains an invalid entry' USING ERRCODE = '22023';
        END IF;
        IF jsonb_typeof(v_social_value) = 'string' THEN
          v_url := v_social_value #>> '{}';
          IF length(v_url) > 2048
             OR v_url !~* '^https?://[^/[:space:]?#@]+(/[^?#[:space:]]*)?$' THEN
            RAISE EXCEPTION 'social_media_links values must be safe HTTP(S) URLs' USING ERRCODE = '22023';
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  v_payload_fingerprint := md5(p_entity_type || ':' || p_payload::TEXT);
  v_request_id := COALESCE(
    p_request_id,
    md5(p_actor_id::TEXT || ':' || p_entity_type || ':' || p_payload::TEXT)::UUID
  );

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_actor_id::TEXT || ':' || v_request_id::TEXT, 0)
  );

  SELECT request.*
  INTO v_existing
  FROM private.metadata_write_requests AS request
  WHERE request.actor_id = p_actor_id AND request.request_id = v_request_id;

  IF FOUND THEN
    IF v_existing.entity_type IS DISTINCT FROM p_entity_type
       OR v_existing.payload_fingerprint IS DISTINCT FROM v_payload_fingerprint THEN
      RAISE EXCEPTION 'Request id was already used with different metadata' USING ERRCODE = '23505';
    END IF;
    RETURN v_existing.result || jsonb_build_object('replayed', TRUE);
  END IF;

  IF p_entity_type = 'job' THEN
    INSERT INTO public.jobs AS job (name)
    VALUES (btrim(p_payload ->> 'name'))
    RETURNING to_jsonb(job), job.id::TEXT INTO v_record, v_entity_id;
  ELSE
    INSERT INTO public.voice_actors AS actor (
      firstname, lastname, bio, nationality, date_of_birth, awards,
      years_active, social_media_links, profile_picture, tmdb_id,
      wikidata_id, status, created_by
    ) VALUES (
      btrim(p_payload ->> 'firstname'),
      btrim(p_payload ->> 'lastname'),
      p_payload ->> 'bio',
      p_payload ->> 'nationality',
      CASE WHEN jsonb_typeof(p_payload -> 'date_of_birth') = 'string'
        THEN (p_payload ->> 'date_of_birth')::DATE ELSE NULL END,
      p_payload ->> 'awards',
      p_payload ->> 'years_active',
      CASE WHEN p_payload -> 'social_media_links' = 'null'::JSONB
        THEN NULL ELSE p_payload -> 'social_media_links' END,
      p_payload ->> 'profile_picture',
      CASE WHEN jsonb_typeof(p_payload -> 'tmdb_id') = 'number'
        THEN (p_payload ->> 'tmdb_id')::BIGINT ELSE NULL END,
      p_payload ->> 'wikidata_id',
      CASE WHEN jsonb_typeof(p_payload -> 'status') = 'string'
        THEN (p_payload ->> 'status')::public.voice_actor_status ELSE NULL END,
      p_actor_id
    )
    RETURNING to_jsonb(actor), actor.id::TEXT INTO v_record, v_entity_id;
  END IF;

  INSERT INTO public.audit_logs (
    user_id, entity_type, entity_id, action,
    previous_value, new_value, points_awarded, created_at
  ) VALUES (
    p_actor_id, p_entity_type, v_entity_id, 'create',
    NULL, v_record, 0, clock_timestamp()
  )
  RETURNING id INTO v_audit_log_id;

  v_result := jsonb_build_object(
    'record', v_record,
    'audit_log_id', v_audit_log_id,
    'replayed', FALSE
  );

  INSERT INTO private.metadata_write_requests (
    actor_id, request_id, entity_type, payload_fingerprint,
    entity_id, audit_log_id, result
  ) VALUES (
    p_actor_id, v_request_id, p_entity_type, v_payload_fingerprint,
    v_entity_id, v_audit_log_id, v_result
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.controlled_save_metadata(UUID, TEXT, JSONB, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.controlled_save_metadata(UUID, TEXT, JSONB, UUID)
  TO service_role;

COMMENT ON FUNCTION public.controlled_save_metadata(UUID, TEXT, JSONB, UUID) IS
  'Creates an allowlisted job or voice actor for a verified administrator and atomically records its full audit snapshot and idempotency metadata.';
