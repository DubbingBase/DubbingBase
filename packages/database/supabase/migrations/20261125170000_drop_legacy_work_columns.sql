-- Removes the legacy work columns `character_id`, `suggestions` and `source_id`.
--
--   * `suggestions` and `source_id` hold no data in production, and who changed what is in audit_logs.
--   * `character_id` was the legacy IGDB character id. Game credits are identified by
--     `game_character_id` (a registered game character) and the name; the last nine credits that
--     only had `character_id` are linked by 20261125150000_complete_witcher3_nameless_credits.sql.
--
-- The migration refuses to run if a row would lose information (a `character_id` that no linked game
-- character carries as its IGDB id, a non-blank `suggestions`, or a `source_id`).
--
-- Every function that read or wrote the columns is re-created from its current definition with
-- only those references removed; the role-identity helpers keep their signature and are passed
-- NULL for the old id. `save_admin_credit_import` loses its `p_character_id` argument, so the old
-- signature is dropped. The `work_unique_assignment` unique index contained `character_id` and goes
-- with the column; the role-aware duplicate trigger remains the uniqueness guard. The `source`
-- table only existed for `work.source_id`; it is empty and is dropped too.
--
-- This is not an expand/contract change: the previous website build selects `character_id` on game
-- pages and sends it to the editor, so it errors on those routes from the moment the migration
-- commits until the new Worker is live (see docs/release-pipeline.md). Deploy back to back, during
-- low traffic. There is no down migration; take a backup or PITR marker first.
-- Fail early, before anything is rewritten, when a row would lose information.
DO $guard$
BEGIN
  -- The linked game character replaces the legacy id only when it carries that same IGDB id.
  IF EXISTS (
    SELECT 1 FROM public.work AS work
    WHERE work.character_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.game_characters AS character
        WHERE character.id = work.game_character_id
          AND character.igdb_character_id = work.character_id
      )
  ) THEN
    RAISE EXCEPTION 'work.character_id still holds an IGDB id that no linked game character carries'
      USING ERRCODE = '55000';
  END IF;
  IF EXISTS (SELECT 1 FROM public.work WHERE pg_catalog.btrim(COALESCE(suggestions, '')) <> '') THEN
    RAISE EXCEPTION 'work.suggestions still holds data' USING ERRCODE = '55000';
  END IF;
  IF EXISTS (SELECT 1 FROM public.work WHERE source_id IS NOT NULL) THEN
    RAISE EXCEPTION 'work.source_id still holds data' USING ERRCODE = '55000';
  END IF;
  IF EXISTS (SELECT 1 FROM public.source) THEN
    RAISE EXCEPTION 'public.source still holds data' USING ERRCODE = '55000';
  END IF;
END
$guard$;

DROP FUNCTION IF EXISTS public.save_admin_credit_import(
  UUID, UUID, BIGINT, TEXT, TEXT, BIGINT, TEXT, TEXT, BIGINT, BIGINT, TEXT
);

CREATE OR REPLACE FUNCTION public.prevent_duplicate_work_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_new_role_key TEXT;
  v_old_role_key TEXT;
  v_new_lock_key BIGINT;
  v_old_lock_key BIGINT;
BEGIN
  v_new_role_key := public.work_assignment_role_identity_key(
    NEW.game_character_id, NULL::BIGINT, NEW.character_name
  );

  IF TG_OP = 'UPDATE' THEN
    v_old_role_key := public.work_assignment_role_identity_key(
      OLD.game_character_id, NULL::BIGINT, OLD.character_name
    );
    IF ROW(NEW.dubbing_project_id, NEW.actor_id, NEW.voice_actor_id, v_new_role_key)
       IS NOT DISTINCT FROM
       ROW(OLD.dubbing_project_id, OLD.actor_id, OLD.voice_actor_id, v_old_role_key) THEN
      RETURN NEW;
    END IF;

    IF v_old_role_key IS NOT NULL THEN
      v_old_lock_key := pg_catalog.hashtextextended(
        pg_catalog.jsonb_build_array(OLD.dubbing_project_id, OLD.actor_id, OLD.voice_actor_id, v_old_role_key)::TEXT,
        0
      );
    END IF;
  END IF;

  IF v_new_role_key IS NOT NULL THEN
    v_new_lock_key := pg_catalog.hashtextextended(
      pg_catalog.jsonb_build_array(NEW.dubbing_project_id, NEW.actor_id, NEW.voice_actor_id, v_new_role_key)::TEXT,
      0
    );
  END IF;

  IF TG_OP = 'UPDATE' AND v_old_lock_key IS NOT NULL AND v_new_lock_key IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(LEAST(v_old_lock_key, v_new_lock_key));
    IF v_old_lock_key <> v_new_lock_key THEN
      PERFORM pg_catalog.pg_advisory_xact_lock(GREATEST(v_old_lock_key, v_new_lock_key));
    END IF;
  ELSIF v_old_lock_key IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(v_old_lock_key);
  ELSIF v_new_lock_key IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(v_new_lock_key);
  END IF;

  IF v_new_role_key IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.work AS existing
    WHERE existing.dubbing_project_id IS NOT DISTINCT FROM NEW.dubbing_project_id
      AND existing.actor_id IS NOT DISTINCT FROM NEW.actor_id
      AND existing.voice_actor_id IS NOT DISTINCT FROM NEW.voice_actor_id
      AND public.work_assignment_role_identity_key(
        existing.game_character_id, NULL::BIGINT, existing.character_name
      ) = v_new_role_key
      AND (TG_OP <> 'UPDATE' OR existing.id <> OLD.id)
  ) THEN
    RAISE EXCEPTION 'duplicate work assignment already exists'
      USING ERRCODE = '23505', CONSTRAINT = 'work_unique_assignment_role_aware';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.find_work_role_identity_matches(p_work_ids bigint[], p_character_id bigint, p_character_name text)
 RETURNS bigint[]
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT COALESCE(pg_catalog.array_agg(work.id), ARRAY[]::bigint[])
  FROM public.work
  WHERE work.id = ANY(p_work_ids)
    AND work.game_character_id IS NULL
    AND public.work_role_identity_key(p_character_id, p_character_name) IS NOT NULL
    AND public.work_role_identity_key(NULL::bigint, work.character_name)
      = public.work_role_identity_key(p_character_id, p_character_name);
$function$;

CREATE OR REPLACE FUNCTION public.create_voice_actor_work_link(p_user_id uuid, p_request_id uuid, p_voice_actor_id bigint, p_content_id bigint, p_content_type text, p_language text, p_actor_person_id bigint, p_character_name text, p_performance text)
 RETURNS TABLE(work_id bigint, project_id bigint, audit_log_id uuid, replayed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_project_id BIGINT;
  v_media_id BIGINT;
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

  v_media_id := private.find_media_id(p_content_type, p_content_id);
  SELECT count(*) INTO v_project_count
  FROM public.dubbing_projects AS project
  WHERE project.media_id = v_media_id
    AND project.language = p_language;
  IF v_project_count <> 1 OR NOT EXISTS (
    SELECT 1 FROM public.dubbing_projects AS project
    WHERE project.id = v_project_id
      AND project.media_id = v_media_id
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
    AND work.game_character_id IS NULL
    AND public.work_role_identity_key(NULL::BIGINT, work.character_name) = v_role;
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
      AND work.game_character_id IS NULL
      AND public.work_role_identity_key(NULL::BIGINT, work.character_name) = v_role
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
$function$;

CREATE OR REPLACE FUNCTION public.create_voice_actor_work_link(p_user_id uuid, p_request_id uuid, p_voice_actor_id bigint, p_content_id bigint, p_content_type text, p_language text, p_actor_person_id bigint, p_game_character_id uuid, p_character_name text, p_performance text)
 RETURNS TABLE(work_id bigint, project_id bigint, audit_log_id uuid, replayed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_project_id BIGINT;
  v_media_id BIGINT;
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
    WHERE character.id = p_game_character_id
      AND character.media_id = private.find_media_id('video_game', p_content_id)
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

  v_media_id := private.find_media_id(p_content_type, p_content_id);
  SELECT count(*) INTO v_project_count
  FROM public.dubbing_projects AS project
  WHERE project.media_id = v_media_id
    AND project.language = p_language;
  IF v_project_count <> 1 OR NOT EXISTS (
    SELECT 1 FROM public.dubbing_projects AS project
    WHERE project.id = v_project_id
      AND project.media_id = v_media_id
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
    AND public.work_assignment_role_identity_key(work.game_character_id, NULL::BIGINT, work.character_name) = v_role;
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
      AND public.work_assignment_role_identity_key(work.game_character_id, NULL::BIGINT, work.character_name) = v_role
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
$function$;

CREATE OR REPLACE FUNCTION public.apply_extracted_credits(p_content_id bigint, p_content_type text, p_dubbing_language text, p_credits jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_project_id bigint;
  v_media_id bigint;
  v_inserted_actors integer := 0;
  v_inserted_works integer := 0;
  v_overlapped_works integer := 0;
  v_mismatched_works integer := 0;
BEGIN
  IF p_content_id IS NULL OR p_content_id <= 0
    OR p_content_type IS NULL OR p_content_type NOT IN ('movie', 'tv', 'video_game')
    OR p_dubbing_language IS NULL
    OR NOT public.is_valid_dubbing_language(p_dubbing_language) THEN
    RAISE EXCEPTION 'Invalid extracted credit batch' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_credits) IS DISTINCT FROM 'array' OR jsonb_array_length(p_credits) > 1000 THEN
    RAISE EXCEPTION 'Extracted credits must be a JSON array of at most 1000 items' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_credits) AS item(value)
    WHERE jsonb_typeof(item.value) IS DISTINCT FROM 'object'
      OR NULLIF(btrim(item.value->>'firstname'), '') IS NULL
      OR NULLIF(btrim(item.value->>'lastname'), '') IS NULL
      OR COALESCE(item.value->>'actor_id', '') !~ '^[0-9]+$'
      OR (item.value->>'actor_id')::numeric <= 0
  ) THEN
    RAISE EXCEPTION 'Malformed extracted credit' USING ERRCODE = '22023';
  END IF;

  v_media_id := private.resolve_media(p_content_type, p_content_id);
  INSERT INTO public.dubbing_projects(media_id, language)
  VALUES (v_media_id, p_dubbing_language)
  ON CONFLICT (media_id, language) DO NOTHING;
  SELECT project.id INTO STRICT v_project_id
  FROM public.dubbing_projects AS project
  WHERE project.media_id = v_media_id
    AND project.language = p_dubbing_language
  FOR UPDATE;

  PERFORM pg_advisory_xact_lock(hashtextextended(names.normalized_name, 0))
  FROM (
    SELECT DISTINCT lower(btrim(item.value->>'firstname')) || E'\x1f' ||
      lower(btrim(item.value->>'lastname')) AS normalized_name
    FROM jsonb_array_elements(p_credits) WITH ORDINALITY AS item(value, ordinal)
    ORDER BY normalized_name
  ) AS names;

  WITH names AS (
    SELECT DISTINCT ON (lower(btrim(item.value->>'firstname')),
                        lower(btrim(item.value->>'lastname')))
      btrim(item.value->>'firstname') AS firstname,
      btrim(item.value->>'lastname') AS lastname
    FROM jsonb_array_elements(p_credits) WITH ORDINALITY AS item(value, ordinal)
    ORDER BY lower(btrim(item.value->>'firstname')),
             lower(btrim(item.value->>'lastname')),
             btrim(item.value->>'firstname'), btrim(item.value->>'lastname')
  )
  INSERT INTO public.voice_actors(firstname, lastname)
  SELECT names.firstname, names.lastname FROM names
  WHERE NOT EXISTS (
    SELECT 1 FROM public.voice_actors AS actor
    WHERE lower(actor.firstname) = lower(names.firstname)
      AND lower(actor.lastname) = lower(names.lastname)
  )
  ON CONFLICT (firstname, lastname) DO NOTHING;
  GET DIAGNOSTICS v_inserted_actors = ROW_COUNT;

  WITH raw_credits AS (
    SELECT
      btrim(item.value->>'firstname') AS firstname,
      btrim(item.value->>'lastname') AS lastname,
      (item.value->>'actor_id')::bigint AS actor_id,
      NULLIF(item.value->>'character_name', '') AS character_name,
      NULLIF(item.value->>'performance', '') AS incoming_performance,
      COALESCE(NULLIF(item.value->>'performance', ''), 'dialogues') AS performance,
      item.ordinal,
      public.work_role_identity_key(NULL::bigint,
        NULLIF(item.value->>'character_name', '')) AS role_key
    FROM jsonb_array_elements(p_credits) WITH ORDINALITY AS item(value, ordinal)
  ), credits AS (
    SELECT DISTINCT ON (
      lower(firstname), lower(lastname), actor_id,
      COALESCE(role_key, 'ambiguous:' || ordinal::text)
    ) *
    FROM raw_credits
    ORDER BY lower(firstname), lower(lastname), actor_id,
      COALESCE(role_key, 'ambiguous:' || ordinal::text), ordinal DESC
  ), actor_resolved AS (
    SELECT credits.*, actor.id AS voice_actor_id,
      row_number() OVER (
        PARTITION BY actor.id, credits.actor_id, credits.role_key
        ORDER BY credits.ordinal
      ) AS match_ordinal
    FROM credits
    JOIN LATERAL (
      SELECT candidate.id FROM public.voice_actors AS candidate
      WHERE lower(candidate.firstname) = lower(credits.firstname)
        AND lower(candidate.lastname) = lower(credits.lastname)
      ORDER BY (candidate.firstname = credits.firstname AND candidate.lastname = credits.lastname) DESC,
        candidate.id
      LIMIT 1
    ) AS actor ON true
  ), resolved AS (
    SELECT credits.*, existing.id AS existing_work_id
    FROM actor_resolved AS credits
    LEFT JOIN LATERAL (
      SELECT candidate.id FROM public.work AS candidate
      WHERE candidate.dubbing_project_id = v_project_id
        AND candidate.game_character_id IS NULL
        AND candidate.voice_actor_id = credits.voice_actor_id
        AND candidate.actor_id = credits.actor_id
        AND public.work_role_identity_key(NULL::bigint, candidate.character_name)
          IS NOT DISTINCT FROM credits.role_key
      ORDER BY candidate.id
      OFFSET (credits.match_ordinal - 1)
      LIMIT 1
    ) AS existing ON true
  ), inserted AS (
    INSERT INTO public.work(
      dubbing_project_id, voice_actor_id, actor_id, character_name, performance
    )
    SELECT v_project_id, resolved.voice_actor_id, resolved.actor_id,
      resolved.character_name, resolved.performance
    FROM resolved
    WHERE resolved.existing_work_id IS NULL
    ORDER BY resolved.actor_id, resolved.voice_actor_id, resolved.role_key, resolved.match_ordinal
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  SELECT count(*) FILTER (WHERE resolved.existing_work_id IS NOT NULL),
    count(*) FILTER (
      WHERE existing.id IS NOT NULL
        AND (
          (resolved.incoming_performance IS NOT NULL AND existing.performance IS DISTINCT FROM resolved.incoming_performance)
          OR (resolved.character_name IS NOT NULL AND lower(btrim(existing.character_name)) IS DISTINCT FROM lower(btrim(resolved.character_name)))
        )
    ),
    (SELECT count(*) FROM inserted)
  INTO v_overlapped_works, v_mismatched_works, v_inserted_works
  FROM resolved
  LEFT JOIN public.work AS existing ON existing.id = resolved.existing_work_id;

  RETURN jsonb_build_object('new_voice_actors', v_inserted_actors,
    'credits_added', v_inserted_works,
    'credits_overlapped', v_overlapped_works,
    'credits_mismatched', v_mismatched_works);
END;
$function$;

CREATE OR REPLACE FUNCTION public.find_duplicate_work_groups(p_after_group_id bigint DEFAULT 0, p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  WITH duplicate_groups AS (
    SELECT
      w.dubbing_project_id,
      w.actor_id,
      w.voice_actor_id,
      public.work_assignment_role_identity_key(w.game_character_id, NULL::BIGINT, w.character_name) AS role_key,
      min(w.id) AS group_id,
      count(*) AS group_size
    FROM public.work AS w
    WHERE public.work_assignment_role_identity_key(w.game_character_id, NULL::BIGINT, w.character_name) IS NOT NULL
    GROUP BY w.dubbing_project_id, w.actor_id, w.voice_actor_id,
      public.work_assignment_role_identity_key(w.game_character_id, NULL::BIGINT, w.character_name)
    HAVING count(*) > 1
  ),
  page_groups AS (
    SELECT *
    FROM duplicate_groups
    WHERE group_id > GREATEST(COALESCE(p_after_group_id, 0), 0)
    ORDER BY group_id
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100) + 1
  ),
  page_items AS (
    SELECT
      g.*,
      jsonb_agg(
        to_jsonb(w) || jsonb_build_object(
          'voteCount', COALESCE(v.vote_count, 0),
          'upVotes', COALESCE(v.up_votes, 0),
          'downVotes', COALESCE(v.down_votes, 0),
          'voiceActor', CASE WHEN va.id IS NULL THEN NULL ELSE jsonb_build_object(
            'id', va.id, 'firstName', va.firstname, 'lastName', va.lastname
          ) END
        ) ORDER BY w.id
      ) AS works,
      jsonb_build_object(
        'id', dp.id,
        'contentId', media.content_id,
        'contentType', media.kind,
        'language', dp.language
      ) AS project
    FROM page_groups AS g
    JOIN public.work AS w
      ON w.dubbing_project_id IS NOT DISTINCT FROM g.dubbing_project_id
      AND w.actor_id IS NOT DISTINCT FROM g.actor_id
      AND w.voice_actor_id IS NOT DISTINCT FROM g.voice_actor_id
      AND public.work_assignment_role_identity_key(w.game_character_id, NULL::BIGINT, w.character_name) = g.role_key
    JOIN public.dubbing_projects AS dp ON dp.id = g.dubbing_project_id
    JOIN public.media AS media ON media.id = dp.media_id
    LEFT JOIN public.voice_actors AS va ON va.id = w.voice_actor_id
    LEFT JOIN LATERAL (
      SELECT
        count(*) AS vote_count,
        count(*) FILTER (WHERE vote_type = 'up') AS up_votes,
        count(*) FILTER (WHERE vote_type = 'down') AS down_votes
      FROM public.votes
      WHERE work_id = w.id
    ) AS v ON true
    GROUP BY g.dubbing_project_id, g.actor_id, g.voice_actor_id, g.role_key,
      g.group_id, g.group_size, dp.id, media.id, media.kind, media.content_id, dp.language
    ORDER BY g.group_id
  ),
  limited AS (
    SELECT * FROM page_items ORDER BY group_id
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100)
  )
  SELECT jsonb_build_object(
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'groupId', group_id,
        'groupSize', group_size,
        'identity', jsonb_build_object(
          'dubbingProjectId', dubbing_project_id,
          'actorId', actor_id,
          'voiceActorId', voice_actor_id,
          'roleKey', role_key
        ),
        'project', project,
        'works', works
      ) ORDER BY group_id)
      FROM limited
    ), '[]'::jsonb),
    'nextCursor', CASE
      WHEN (SELECT count(*) FROM page_items) > LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100)
      THEN (
        SELECT group_id FROM page_items
        ORDER BY group_id
        OFFSET GREATEST(LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100) - 1, 0) LIMIT 1
      )
      ELSE NULL
    END,
    'totalGroups', (SELECT count(*) FROM duplicate_groups)
  );
$function$;

CREATE OR REPLACE FUNCTION public.merge_voice_actor_duplicates_atomic(p_keep_id integer, p_other_ids integer[], p_updates jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_other_ids integer[];
  v_missing_count integer;
  v_bio public.voice_actors.bio%TYPE;
  v_nationality public.voice_actors.nationality%TYPE;
  v_date_of_birth public.voice_actors.date_of_birth%TYPE;
  v_tmdb_id public.voice_actors.tmdb_id%TYPE;
  v_wikidata_id public.voice_actors.wikidata_id%TYPE;
  v_awards public.voice_actors.awards%TYPE;
  v_years_active public.voice_actors.years_active%TYPE;
  v_social_media_links public.voice_actors.social_media_links%TYPE;
  v_profile_picture public.voice_actors.profile_picture%TYPE;
BEGIN
  v_other_ids := ARRAY(
    SELECT DISTINCT id
    FROM unnest(COALESCE(p_other_ids, ARRAY[]::integer[])) AS ids(id)
    WHERE id <> p_keep_id
    ORDER BY id
  );

  IF cardinality(v_other_ids) IS NULL OR cardinality(v_other_ids) = 0 THEN
    RAISE EXCEPTION 'No duplicate IDs to merge';
  END IF;

  -- Lock all actors in ID order so concurrent merges cannot interleave.
  PERFORM 1
  FROM public.voice_actors
  WHERE id = p_keep_id OR id = ANY(v_other_ids)
  ORDER BY id
  FOR UPDATE;

  PERFORM 1 FROM public.voice_actors WHERE id = p_keep_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Keep profile % does not exist', p_keep_id;
  END IF;

  SELECT count(*) INTO v_missing_count
  FROM public.voice_actors
  WHERE id = ANY(v_other_ids);

  IF v_missing_count <> cardinality(v_other_ids) THEN
    RAISE EXCEPTION 'One or more duplicate profiles do not exist';
  END IF;

  IF p_updates ? 'firstname' AND COALESCE(trim(p_updates->>'firstname'), '') = '' THEN
    RAISE EXCEPTION 'Final firstname cannot be empty';
  END IF;
  IF p_updates ? 'lastname' AND COALESCE(trim(p_updates->>'lastname'), '') = '' THEN
    RAISE EXCEPTION 'Final lastname cannot be empty';
  END IF;

  SELECT
    (array_agg(bio ORDER BY id) FILTER (WHERE bio IS NOT NULL))[1],
    (array_agg(nationality ORDER BY id) FILTER (WHERE nationality IS NOT NULL))[1],
    (array_agg(date_of_birth ORDER BY id) FILTER (WHERE date_of_birth IS NOT NULL))[1],
    (array_agg(tmdb_id ORDER BY id) FILTER (WHERE tmdb_id IS NOT NULL))[1],
    (array_agg(wikidata_id ORDER BY id) FILTER (WHERE wikidata_id IS NOT NULL))[1],
    (array_agg(awards ORDER BY id) FILTER (WHERE awards IS NOT NULL))[1],
    (array_agg(years_active ORDER BY id) FILTER (WHERE years_active IS NOT NULL))[1],
    (array_agg(social_media_links ORDER BY id) FILTER (WHERE social_media_links IS NOT NULL))[1],
    (array_agg(profile_picture ORDER BY id) FILTER (WHERE profile_picture IS NOT NULL))[1]
  INTO
    v_bio,
    v_nationality,
    v_date_of_birth,
    v_tmdb_id,
    v_wikidata_id,
    v_awards,
    v_years_active,
    v_social_media_links,
    v_profile_picture
  FROM public.voice_actors
  WHERE id = ANY(v_other_ids);

  -- Collapse only known identical roles and retain each user's newest vote.
  PERFORM 1
  FROM public.work
  WHERE voice_actor_id = p_keep_id OR voice_actor_id = ANY(v_other_ids)
  ORDER BY id
  FOR UPDATE;

  PERFORM 1
  FROM public.votes AS vote
  JOIN public.work AS work_row ON work_row.id = vote.work_id
  WHERE work_row.voice_actor_id = p_keep_id OR work_row.voice_actor_id = ANY(v_other_ids)
  ORDER BY vote.id
  FOR UPDATE OF vote;

  WITH duplicate_work AS (
    SELECT id, first_value(id) OVER (
      PARTITION BY dubbing_project_id, actor_id,
        public.work_assignment_role_identity_key(game_character_id, NULL::bigint, character_name)
      ORDER BY (voice_actor_id = p_keep_id) DESC, id
    ) AS keeper_id
    FROM public.work
    WHERE (voice_actor_id = p_keep_id OR voice_actor_id = ANY(v_other_ids))
      AND public.work_assignment_role_identity_key(game_character_id, NULL::bigint, character_name) IS NOT NULL
  ), ranked_votes AS (
    SELECT vote.id, duplicate_work.keeper_id,
      row_number() OVER (
        PARTITION BY duplicate_work.keeper_id, vote.user_id
        ORDER BY vote.created_at DESC NULLS LAST, vote.id DESC
      ) AS vote_rank
    FROM duplicate_work
    JOIN public.votes AS vote ON vote.work_id = duplicate_work.id
  )
  DELETE FROM public.votes AS vote
  USING ranked_votes
  WHERE vote.id = ranked_votes.id AND ranked_votes.vote_rank > 1;

  WITH duplicate_work AS (
    SELECT id, first_value(id) OVER (
      PARTITION BY dubbing_project_id, actor_id,
        public.work_assignment_role_identity_key(game_character_id, NULL::bigint, character_name)
      ORDER BY (voice_actor_id = p_keep_id) DESC, id
    ) AS keeper_id
    FROM public.work
    WHERE (voice_actor_id = p_keep_id OR voice_actor_id = ANY(v_other_ids))
      AND public.work_assignment_role_identity_key(game_character_id, NULL::bigint, character_name) IS NOT NULL
  ), ranked_votes AS (
    SELECT vote.id, duplicate_work.keeper_id,
      row_number() OVER (
        PARTITION BY duplicate_work.keeper_id, vote.user_id
        ORDER BY vote.created_at DESC NULLS LAST, vote.id DESC
      ) AS vote_rank
    FROM duplicate_work
    JOIN public.votes AS vote ON vote.work_id = duplicate_work.id
  )
  UPDATE public.votes AS vote
  SET work_id = ranked_votes.keeper_id
  FROM ranked_votes
  WHERE vote.id = ranked_votes.id
    AND ranked_votes.vote_rank = 1
    AND vote.work_id <> ranked_votes.keeper_id;

  WITH duplicate_work AS (
    SELECT id, first_value(id) OVER (
      PARTITION BY dubbing_project_id, actor_id,
        public.work_assignment_role_identity_key(game_character_id, NULL::bigint, character_name)
      ORDER BY (voice_actor_id = p_keep_id) DESC, id
    ) AS keeper_id
    FROM public.work
    WHERE (voice_actor_id = p_keep_id OR voice_actor_id = ANY(v_other_ids))
      AND public.work_assignment_role_identity_key(game_character_id, NULL::bigint, character_name) IS NOT NULL
  )
  DELETE FROM public.work AS duplicate
  USING duplicate_work
  WHERE duplicate.id = duplicate_work.id
    AND duplicate_work.id <> duplicate_work.keeper_id;

  UPDATE public.work
  SET voice_actor_id = p_keep_id
  WHERE voice_actor_id = ANY(v_other_ids);

  DELETE FROM public.user_voice_actor_links l1
  WHERE l1.voice_actor_id = ANY(v_other_ids)
    AND EXISTS (
      SELECT 1
      FROM public.user_voice_actor_links l2
      WHERE l2.user_id = l1.user_id
        AND l2.voice_actor_id = p_keep_id
    );

  UPDATE public.user_voice_actor_links
  SET voice_actor_id = p_keep_id
  WHERE voice_actor_id = ANY(v_other_ids);

  DELETE FROM public.voice_actor_subscriptions s1
  WHERE s1.voice_actor_id = ANY(v_other_ids)
    AND EXISTS (
      SELECT 1
      FROM public.voice_actor_subscriptions s2
      WHERE s2.user_id = s1.user_id
        AND s2.voice_actor_id = p_keep_id
    );

  UPDATE public.voice_actor_subscriptions
  SET voice_actor_id = p_keep_id
  WHERE voice_actor_id = ANY(v_other_ids);

  DELETE FROM public.dubbing_project_crew c1
  WHERE c1.person_id = ANY(v_other_ids)
    AND EXISTS (
      SELECT 1
      FROM public.dubbing_project_crew c2
      WHERE c2.dubbing_project_id = c1.dubbing_project_id
        AND c2.job_id = c1.job_id
        AND c2.person_id = p_keep_id
    );

  UPDATE public.dubbing_project_crew
  SET person_id = p_keep_id
  WHERE person_id = ANY(v_other_ids);

  DELETE FROM public.voice_actors
  WHERE id = ANY(v_other_ids);

  UPDATE public.voice_actors
  SET
    firstname = CASE WHEN p_updates ? 'firstname' THEN trim(p_updates->>'firstname') ELSE firstname END,
    lastname = CASE WHEN p_updates ? 'lastname' THEN trim(p_updates->>'lastname') ELSE lastname END,
    bio = CASE WHEN p_updates ? 'bio' THEN NULLIF(p_updates->>'bio', '') ELSE COALESCE(bio, v_bio) END,
    nationality = CASE WHEN p_updates ? 'nationality' THEN NULLIF(p_updates->>'nationality', '') ELSE COALESCE(nationality, v_nationality) END,
    date_of_birth = CASE WHEN p_updates ? 'date_of_birth' THEN NULLIF(p_updates->>'date_of_birth', '')::date ELSE COALESCE(date_of_birth, v_date_of_birth) END,
    tmdb_id = CASE WHEN p_updates ? 'tmdb_id' THEN NULLIF(p_updates->>'tmdb_id', '')::integer ELSE COALESCE(tmdb_id, v_tmdb_id) END,
    wikidata_id = CASE WHEN p_updates ? 'wikidata_id' THEN NULLIF(p_updates->>'wikidata_id', '') ELSE COALESCE(wikidata_id, v_wikidata_id) END,
    awards = COALESCE(awards, v_awards),
    years_active = COALESCE(years_active, v_years_active),
    social_media_links = COALESCE(social_media_links, v_social_media_links),
    profile_picture = COALESCE(profile_picture, v_profile_picture),
    updated_at = now()
  WHERE id = p_keep_id;

  RETURN jsonb_build_object(
    'keepId', p_keep_id,
    'mergedIds', to_jsonb(v_other_ids),
    'mergedCount', cardinality(v_other_ids)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.merge_work_duplicates_atomic(p_canonical_id bigint, p_work_ids bigint[], p_updates jsonb, p_admin_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_identity public.work%ROWTYPE;
  v_role_key text;
  v_lock_key bigint;
  v_supplied_ids bigint[];
  v_actual_ids bigint[];
  v_previous_values jsonb;
  v_vote_count bigint;
  v_collapsed_vote_count bigint;
BEGIN
  IF p_canonical_id IS NULL OR p_admin_id IS NULL OR p_updates IS NULL
     OR jsonb_typeof(p_updates) <> 'object' THEN
    RAISE EXCEPTION 'invalid duplicate merge input' USING ERRCODE = '22023';
  END IF;
  IF p_updates - ARRAY['performance','status','reviewed_status','note','highlight','character_name']::text[] <> '{}'::jsonb THEN
    RAISE EXCEPTION 'unsupported work fields' USING ERRCODE = '22023';
  END IF;

  SELECT array_agg(DISTINCT id ORDER BY id) INTO v_supplied_ids
  FROM unnest(COALESCE(p_work_ids, ARRAY[]::bigint[])) AS ids(id);
  IF cardinality(v_supplied_ids) < 2 OR p_canonical_id <> ALL(v_supplied_ids) THEN
    RAISE EXCEPTION 'invalid duplicate group' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_identity FROM public.work WHERE id = p_canonical_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'duplicate group changed' USING ERRCODE = 'PT409';
  END IF;
  v_role_key := public.work_assignment_role_identity_key(v_identity.game_character_id, NULL::BIGINT, v_identity.character_name);
  IF v_role_key IS NULL THEN
    RAISE EXCEPTION 'ambiguous work roles cannot be merged' USING ERRCODE = '22023';
  END IF;
  v_lock_key := pg_catalog.hashtextextended(pg_catalog.jsonb_build_array(
    v_identity.dubbing_project_id, v_identity.actor_id, v_identity.voice_actor_id, v_role_key
  )::text, 0);
  PERFORM pg_catalog.pg_advisory_xact_lock(v_lock_key);

  PERFORM 1 FROM public.work WHERE id = ANY(v_supplied_ids) ORDER BY id FOR UPDATE;
  SELECT array_agg(id ORDER BY id) INTO v_actual_ids
  FROM public.work
  WHERE dubbing_project_id IS NOT DISTINCT FROM v_identity.dubbing_project_id
    AND actor_id IS NOT DISTINCT FROM v_identity.actor_id
    AND voice_actor_id IS NOT DISTINCT FROM v_identity.voice_actor_id
    AND public.work_assignment_role_identity_key(game_character_id, NULL::BIGINT, character_name) = v_role_key;
  IF v_actual_ids IS DISTINCT FROM v_supplied_ids THEN
    RAISE EXCEPTION 'duplicate group changed' USING ERRCODE = 'PT409';
  END IF;

  IF p_updates ? 'character_name'
     AND v_identity.game_character_id IS NULL
     AND public.work_role_identity_key(NULL, p_updates->>'character_name') IS DISTINCT FROM v_role_key THEN
    RAISE EXCEPTION 'final role name cannot change merge identity' USING ERRCODE = '22023';
  END IF;

  SELECT jsonb_agg(to_jsonb(work_row) ORDER BY work_row.id) INTO v_previous_values
  FROM public.work AS work_row WHERE work_row.id = ANY(v_actual_ids);

  PERFORM 1 FROM public.votes WHERE work_id = ANY(v_actual_ids) ORDER BY id FOR UPDATE;
  SELECT count(*) INTO v_vote_count FROM public.votes WHERE work_id = ANY(v_actual_ids);
  WITH ranked_votes AS (
    SELECT id, row_number() OVER (
      PARTITION BY user_id ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS vote_rank
    FROM public.votes WHERE work_id = ANY(v_actual_ids)
  ), deleted_votes AS (
    DELETE FROM public.votes AS vote
    USING ranked_votes AS ranked
    WHERE vote.id = ranked.id AND ranked.vote_rank > 1
    RETURNING vote.id
  )
  SELECT count(*) INTO v_collapsed_vote_count FROM deleted_votes;

  WITH ranked_votes AS (
    SELECT id, row_number() OVER (
      PARTITION BY user_id ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS vote_rank
    FROM public.votes WHERE work_id = ANY(v_actual_ids)
  )
  UPDATE public.votes AS vote
  SET work_id = p_canonical_id
  FROM ranked_votes AS ranked
  WHERE vote.id = ranked.id AND ranked.vote_rank = 1 AND vote.work_id <> p_canonical_id;

  UPDATE public.work
  SET performance = CASE WHEN p_updates ? 'performance' THEN p_updates->>'performance' ELSE performance END,
      status = CASE WHEN p_updates ? 'status' THEN p_updates->>'status' ELSE status END,
      reviewed_status = CASE WHEN p_updates ? 'reviewed_status' THEN p_updates->>'reviewed_status' ELSE reviewed_status END,
      note = CASE WHEN p_updates ? 'note' THEN p_updates->>'note' ELSE note END,
      highlight = CASE WHEN p_updates ? 'highlight' THEN (p_updates->>'highlight')::boolean ELSE highlight END,
      character_name = CASE WHEN p_updates ? 'character_name' THEN p_updates->>'character_name' ELSE character_name END,
      updated_at = pg_catalog.now(),
      updated_by = p_admin_id
  WHERE id = p_canonical_id;

  DELETE FROM public.work WHERE id = ANY(v_actual_ids) AND id <> p_canonical_id;
  INSERT INTO public.audit_logs (action, entity_id, entity_type, new_value, previous_value, user_id)
  VALUES (
    'merge_duplicate', p_canonical_id::text, 'work',
    p_updates || jsonb_build_object('mergedIds', to_jsonb(array_remove(v_actual_ids, p_canonical_id))),
    jsonb_build_object('works', v_previous_values), p_admin_id
  );

  RETURN jsonb_build_object(
    'canonicalId', p_canonical_id,
    'mergedIds', to_jsonb(array_remove(v_actual_ids, p_canonical_id)),
    'preservedVotes', v_vote_count - v_collapsed_vote_count,
    'collapsedVotes', v_collapsed_vote_count
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_dubbing_project_editor(p_actor_id uuid, p_request_id uuid, p_project_id bigint, p_expected_updated_at timestamp without time zone, p_project jsonb, p_crew jsonb, p_cast jsonb)
 RETURNS TABLE(project_id bigint, updated_at timestamp without time zone, audit_log_id uuid, replayed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_actor_metadata JSONB;
  v_project public.dubbing_projects%ROWTYPE;
  v_existing_audit public.audit_logs%ROWTYPE;
  v_work public.work%ROWTYPE;
  v_crew public.dubbing_project_crew%ROWTYPE;
  v_media_type TEXT;
  v_content_id BIGINT;
  v_media_id BIGINT;
  v_studio_id BIGINT;
  v_language TEXT;
  v_status TEXT;
  v_managed_jobs BIGINT[];
  v_job_id BIGINT;
  v_person_id BIGINT;
  v_has_person BOOLEAN;
  v_before JSONB;
  v_after JSONB;
  v_before_project JSONB;
  v_before_crew JSONB;
  v_before_cast JSONB;
  v_after_crew JSONB;
  v_after_cast JSONB;
  v_fingerprint TEXT;
  v_audit_id UUID;
  v_updated_at TIMESTAMP WITHOUT TIME ZONE;
  v_expected_work_updated_at TIMESTAMPTZ;
  v_expected_work JSONB;
  v_item JSONB;
  v_key TEXT;
  v_lock_key BIGINT;
BEGIN
  IF p_actor_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'An authenticated administrator and request id are required'
      USING ERRCODE = '28000';
  END IF;

  SELECT users.raw_app_meta_data
  INTO v_actor_metadata
  FROM auth.users AS users
  WHERE users.id = p_actor_id;

  IF NOT FOUND OR COALESCE(v_actor_metadata ->> 'role', '') <> 'admin' THEN
    RAISE EXCEPTION 'Only an administrator can save dubbing projects'
      USING ERRCODE = '42501';
  END IF;

  IF p_project IS NULL OR jsonb_typeof(p_project) IS DISTINCT FROM 'object'
     OR p_project = '{}'::JSONB
     OR EXISTS (
       SELECT 1 FROM jsonb_object_keys(p_project) AS field_name(name)
       WHERE field_name.name <> ALL (ARRAY[
         'content_id', 'content_type', 'language', 'studio_id', 'status'
       ]::TEXT[])
     ) THEN
    RAISE EXCEPTION 'Project contains an unknown or protected field'
      USING ERRCODE = '22023';
  END IF;

  IF NOT (p_project ?& ARRAY['content_id', 'content_type', 'language', 'studio_id', 'status']::TEXT[])
     OR jsonb_typeof(p_project -> 'content_id') IS DISTINCT FROM 'number'
     OR (p_project ->> 'content_id') !~ '^-?[1-9][0-9]{0,17}$'
     OR jsonb_typeof(p_project -> 'content_type') IS DISTINCT FROM 'string'
     OR p_project ->> 'content_type' <> ALL (ARRAY[
       'movie', 'tv', 'video_game', 'audiobook', 'podcast', 'advertisement', 'toy'
     ]::TEXT[])
     OR ((p_project ->> 'content_id')::BIGINT < 0
       AND p_project ->> 'content_type' NOT IN ('advertisement', 'toy'))
     OR jsonb_typeof(p_project -> 'language') IS DISTINCT FROM 'string'
     OR NOT public.is_valid_dubbing_language(p_project ->> 'language')
     OR jsonb_typeof(p_project -> 'status') IS DISTINCT FROM 'string'
     OR p_project ->> 'status' <> ALL (ARRAY['validated', 'pending', 'draft']::TEXT[])
     OR (p_project -> 'studio_id' <> 'null'::JSONB AND (
       jsonb_typeof(p_project -> 'studio_id') IS DISTINCT FROM 'number'
       OR (p_project ->> 'studio_id') !~ '^[1-9][0-9]{0,17}$'
     )) THEN
    RAISE EXCEPTION 'Project fields or references are invalid'
      USING ERRCODE = '22023';
  END IF;

  v_content_id := (p_project ->> 'content_id')::BIGINT;
  v_media_type := p_project ->> 'content_type';
  v_language := p_project ->> 'language';
  v_status := p_project ->> 'status';
  v_studio_id := CASE WHEN p_project -> 'studio_id' = 'null'::JSONB
    THEN NULL ELSE (p_project ->> 'studio_id')::BIGINT END;

  IF v_studio_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.studios AS studio WHERE studio.id = v_studio_id
  ) THEN
    RAISE EXCEPTION 'Selected studio does not exist' USING ERRCODE = '23503';
  END IF;

  IF jsonb_typeof(p_crew) IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_cast) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Crew and cast must be arrays within the supported size limits'
      USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_crew) > 100 OR jsonb_array_length(p_cast) > 1000 THEN
    RAISE EXCEPTION 'Crew and cast must be arrays within the supported size limits'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_crew) AS item(value)
    WHERE jsonb_typeof(item.value) IS DISTINCT FROM 'object'
       OR EXISTS (
         SELECT 1 FROM jsonb_object_keys(item.value) AS field_name(name)
         WHERE field_name.name <> ALL (ARRAY['job_id', 'person_id']::TEXT[])
       )
       OR NOT (item.value ?& ARRAY['job_id', 'person_id']::TEXT[])
       OR jsonb_typeof(item.value -> 'job_id') IS DISTINCT FROM 'number'
       OR (item.value ->> 'job_id') !~ '^[1-9][0-9]{0,17}$'
       OR jsonb_typeof(item.value -> 'person_id') IS DISTINCT FROM 'number'
       OR (item.value ->> 'person_id') !~ '^[1-9][0-9]{0,17}$'
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_crew) AS crew(job_id BIGINT, person_id BIGINT)
    GROUP BY crew.job_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Crew contains an invalid or duplicate job assignment'
      USING ERRCODE = '22023';
  END IF;

  v_managed_jobs := CASE WHEN v_media_type IN ('movie', 'tv', 'video_game')
    THEN ARRAY[1, 2, 3, 4, 5, 6, 7]::BIGINT[]
    ELSE ARRAY[1, 3, 5]::BIGINT[] END;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_crew) AS crew(job_id BIGINT, person_id BIGINT)
    LEFT JOIN public.jobs AS job ON job.id = crew.job_id
    LEFT JOIN public.voice_actors AS person ON person.id = crew.person_id
    WHERE crew.job_id <> ALL (v_managed_jobs)
       OR job.id IS NULL
       OR person.id IS NULL
  ) THEN
    RAISE EXCEPTION 'A selected crew member or job does not exist or is not editable in this media editor'
      USING ERRCODE = '23503';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_cast) AS item(value)
    WHERE jsonb_typeof(item.value) IS DISTINCT FROM 'object'
       OR EXISTS (
         SELECT 1 FROM jsonb_object_keys(item.value) AS field_name(name)
         WHERE field_name.name <> ALL (ARRAY[
           'id', 'expected_updated_at', 'expected', 'actor_id', 'character_name',
           'game_character_id', 'voice_actor_id', 'performance', 'note', 'highlight', 'status'
         ]::TEXT[])
       )
       OR (item.value ? 'id' AND (
         jsonb_typeof(item.value -> 'id') IS DISTINCT FROM 'number'
         OR (item.value ->> 'id') !~ '^[1-9][0-9]{0,17}$'
         OR NOT (item.value ? 'expected_updated_at')
         OR NOT (item.value ? 'expected')
       ))
       OR (item.value ? 'expected' AND (
         jsonb_typeof(item.value -> 'expected') IS DISTINCT FROM 'object'
         OR NOT ((item.value -> 'expected') ?& ARRAY[
           'actor_id', 'character_name', 'voice_actor_id',
           'performance', 'note', 'highlight', 'status'
         ]::TEXT[])
         OR EXISTS (
           SELECT 1 FROM jsonb_object_keys(item.value -> 'expected') AS expected_field(name)
           WHERE expected_field.name <> ALL (ARRAY[
             'actor_id', 'character_name', 'game_character_id', 'voice_actor_id',
             'performance', 'note', 'highlight', 'status'
           ]::TEXT[])
         )
         OR jsonb_typeof(item.value -> 'expected' -> 'actor_id') NOT IN ('number', 'null')
         OR jsonb_typeof(item.value -> 'expected' -> 'voice_actor_id') NOT IN ('number', 'null')
         OR jsonb_typeof(item.value -> 'expected' -> 'character_name') NOT IN ('string', 'null')
         OR jsonb_typeof(item.value -> 'expected' -> 'performance') NOT IN ('string', 'null')
         OR jsonb_typeof(item.value -> 'expected' -> 'note') NOT IN ('string', 'null')
         OR jsonb_typeof(item.value -> 'expected' -> 'highlight') NOT IN ('boolean', 'null')
         OR jsonb_typeof(item.value -> 'expected' -> 'status') NOT IN ('string', 'null')
         OR ((item.value -> 'expected') ? 'game_character_id' AND
           jsonb_typeof(item.value -> 'expected' -> 'game_character_id') NOT IN ('string', 'null'))
         OR ((item.value -> 'expected' ->> 'game_character_id') IS NOT NULL AND
           (item.value -> 'expected' ->> 'game_character_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
       ))
       OR (NOT (item.value ? 'id') AND (item.value ? 'expected' OR item.value ? 'expected_updated_at'))
       OR (item.value ? 'expected_updated_at' AND
         jsonb_typeof(item.value -> 'expected_updated_at') NOT IN ('string', 'null'))
       OR (item.value ? 'actor_id' AND item.value -> 'actor_id' <> 'null'::JSONB AND (
         jsonb_typeof(item.value -> 'actor_id') IS DISTINCT FROM 'number'
         OR (item.value ->> 'actor_id') !~ '^[1-9][0-9]{0,17}$'
       ))
       OR (item.value ? 'game_character_id' AND item.value -> 'game_character_id' <> 'null'::JSONB AND (
         jsonb_typeof(item.value -> 'game_character_id') IS DISTINCT FROM 'string'
         OR (item.value ->> 'game_character_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       ))
       OR (item.value ? 'voice_actor_id' AND item.value -> 'voice_actor_id' <> 'null'::JSONB AND (
         jsonb_typeof(item.value -> 'voice_actor_id') IS DISTINCT FROM 'number'
         OR (item.value ->> 'voice_actor_id') !~ '^[1-9][0-9]{0,17}$'
       ))
       OR (item.value ? 'character_name' AND jsonb_typeof(item.value -> 'character_name') NOT IN ('string', 'null'))
       OR (item.value ? 'performance' AND jsonb_typeof(item.value -> 'performance') NOT IN ('string', 'null'))
       OR (item.value ? 'note' AND jsonb_typeof(item.value -> 'note') NOT IN ('string', 'null'))
       OR (item.value ? 'highlight' AND jsonb_typeof(item.value -> 'highlight') NOT IN ('boolean', 'null'))
       OR length(COALESCE(item.value ->> 'character_name', '')) > 500
       OR length(COALESCE(item.value ->> 'performance', '')) > 100
       OR length(COALESCE(item.value ->> 'note', '')) > 10000
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_cast) AS cast_row(id BIGINT)
    WHERE cast_row.id IS NOT NULL
    GROUP BY cast_row.id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cast contains invalid fields or duplicate work ids'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_cast) AS item(value)
    WHERE item.value ? 'game_character_id'
      AND item.value -> 'game_character_id' <> 'null'::JSONB
      AND v_media_type <> 'video_game'
  ) THEN
    RAISE EXCEPTION 'Local game characters can only be assigned to video games'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_cast) AS item(value)
    LEFT JOIN public.game_characters AS character
      ON character.id = (item.value ->> 'game_character_id')::UUID
     AND character.media_id = private.find_media_id('video_game', v_content_id)
    WHERE item.value ? 'game_character_id'
      AND item.value -> 'game_character_id' <> 'null'::JSONB
      AND character.id IS NULL
  ) THEN
    RAISE EXCEPTION 'A selected local character does not belong to this game'
      USING ERRCODE = '23503';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_cast) AS item(value)
    LEFT JOIN public.voice_actors AS voice_actor
      ON voice_actor.id = CASE WHEN item.value -> 'voice_actor_id' = 'null'::JSONB
        THEN NULL ELSE NULLIF(item.value ->> 'voice_actor_id', '')::BIGINT END
    WHERE item.value ? 'voice_actor_id'
      AND item.value -> 'voice_actor_id' <> 'null'::JSONB
      AND voice_actor.id IS NULL
  ) THEN
    RAISE EXCEPTION 'A selected voice actor does not exist' USING ERRCODE = '23503';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_actor_id::TEXT || ':' || p_request_id::TEXT, 0)
  );
  v_fingerprint := md5(jsonb_build_object(
    'project_id', p_project_id,
    'expected_updated_at', p_expected_updated_at,
    'project', p_project,
    'crew', p_crew,
    'cast', p_cast
  )::TEXT);

  SELECT audit.* INTO v_existing_audit
  FROM public.audit_logs AS audit
  WHERE audit.user_id = p_actor_id
    AND audit.request_id = p_request_id;

  IF FOUND THEN
    IF v_existing_audit.request_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'Request id was already used with different project data'
        USING ERRCODE = '23505';
    END IF;
    SELECT project.* INTO v_project
    FROM public.dubbing_projects AS project
    WHERE project.id = v_existing_audit.entity_id::BIGINT
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The project changed after this save; reload before retrying'
        USING ERRCODE = '55000';
    END IF;
    PERFORM 1
    FROM public.dubbing_project_crew AS crew
    WHERE crew.dubbing_project_id = v_project.id
    ORDER BY crew.id
    FOR UPDATE;
    PERFORM 1
    FROM public.work AS work
    WHERE work.dubbing_project_id = v_project.id
    ORDER BY work.id
    FOR UPDATE;
    SELECT COALESCE(jsonb_agg(to_jsonb(crew_row) ORDER BY crew_row.id), '[]'::JSONB)
    INTO v_after_crew
    FROM public.dubbing_project_crew AS crew_row
    WHERE crew_row.dubbing_project_id = v_project.id;
    SELECT COALESCE(jsonb_agg(to_jsonb(work_row) ORDER BY work_row.id), '[]'::JSONB)
    INTO v_after_cast
    FROM public.work AS work_row
    WHERE work_row.dubbing_project_id = v_project.id;
    IF v_project.updated_at IS DISTINCT FROM
         (v_existing_audit.new_value -> 'project' ->> 'updated_at')::TIMESTAMP WITHOUT TIME ZONE
       OR to_jsonb(v_project) IS DISTINCT FROM v_existing_audit.new_value -> 'project'
       OR v_after_crew IS DISTINCT FROM v_existing_audit.new_value -> 'crew'
       OR v_after_cast IS DISTINCT FROM (
         -- Snapshots stored before the legacy columns were dropped still carry them.
         SELECT COALESCE(jsonb_agg(entry.value - 'character_id' - 'suggestions' - 'source_id' ORDER BY entry.position), '[]'::JSONB)
         FROM jsonb_array_elements(
           CASE WHEN jsonb_typeof(v_existing_audit.new_value -> 'cast') = 'array'
             THEN v_existing_audit.new_value -> 'cast' ELSE '[]'::JSONB END
         ) WITH ORDINALITY AS entry(value, position)
       ) THEN
      RAISE EXCEPTION 'The project changed after this save; reload before retrying'
        USING ERRCODE = '55000';
    END IF;
    RETURN QUERY SELECT v_project.id, v_project.updated_at, v_existing_audit.id, TRUE;
    RETURN;
  END IF;

  IF p_project_id IS NULL THEN
    IF p_expected_updated_at IS NOT NULL THEN
      RAISE EXCEPTION 'New projects cannot have an expected update timestamp'
        USING ERRCODE = '22023';
    END IF;
    IF v_media_type IN ('advertisement', 'toy') AND NOT EXISTS (
      SELECT 1 FROM public.dubbing_projects AS internal_project
      WHERE internal_project.media_id = private.find_media_id(v_media_type, v_content_id)
    ) THEN
      RAISE EXCEPTION 'Internal media must be created before adding a language project'
        USING ERRCODE = '23503';
    END IF;
    v_media_id := private.resolve_media(v_media_type, v_content_id);
    INSERT INTO public.dubbing_projects (
      media_id, language, studio_id, status
    ) VALUES (
      v_media_id, v_language, v_studio_id, v_status
    ) RETURNING * INTO v_project;
    v_before_project := NULL;
  ELSE
    SELECT project.* INTO v_project
    FROM public.dubbing_projects AS project
    WHERE project.id = p_project_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Dubbing project does not exist' USING ERRCODE = '55000';
    END IF;
    IF v_project.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'The project changed since it was loaded; reload before saving'
        USING ERRCODE = '55000';
    END IF;
    IF v_project.media_id IS DISTINCT FROM private.find_media_id(v_media_type, v_content_id) THEN
      RAISE EXCEPTION 'A project cannot be moved to a different content record'
        USING ERRCODE = '22023';
    END IF;
    v_before_project := to_jsonb(v_project);
    UPDATE public.dubbing_projects AS project
    SET language = v_language,
        studio_id = v_studio_id,
        status = v_status
    WHERE project.id = p_project_id
    RETURNING * INTO v_project;
  END IF;

  PERFORM 1
  FROM public.dubbing_project_crew AS crew
  WHERE crew.dubbing_project_id = v_project.id
  ORDER BY crew.id
  FOR UPDATE;

  -- The duplicate-work merge RPC takes role advisory locks before row locks.
  -- Take the same locks in a stable order before locking cast rows so the two
  -- operations cannot form a row-lock/advisory-lock cycle.
  FOR v_lock_key IN
    SELECT lock_keys.lock_key
    FROM (
      SELECT DISTINCT identity_locks.lock_key
      FROM (
        SELECT pg_catalog.hashtextextended(
          pg_catalog.jsonb_build_array(
            work.dubbing_project_id,
            work.actor_id,
            work.voice_actor_id,
            public.work_assignment_role_identity_key(
              work.game_character_id, NULL::BIGINT, work.character_name
            )
          )::TEXT,
          0
        ) AS lock_key
        FROM public.work AS work
        WHERE work.dubbing_project_id = v_project.id
          AND public.work_assignment_role_identity_key(
            work.game_character_id, NULL::BIGINT, work.character_name
          ) IS NOT NULL

        UNION

        SELECT pg_catalog.hashtextextended(
          pg_catalog.jsonb_build_array(
            v_project.id,
            CASE WHEN item.value ? 'actor_id'
              THEN CASE WHEN item.value -> 'actor_id' = 'null'::JSONB
                THEN NULL ELSE (item.value ->> 'actor_id')::BIGINT END
              ELSE existing.actor_id END,
            CASE WHEN item.value ? 'voice_actor_id'
              THEN CASE WHEN item.value -> 'voice_actor_id' = 'null'::JSONB
                THEN NULL ELSE (item.value ->> 'voice_actor_id')::BIGINT END
              ELSE existing.voice_actor_id END,
            public.work_assignment_role_identity_key(
              CASE WHEN item.value ? 'game_character_id'
                THEN CASE WHEN item.value -> 'game_character_id' = 'null'::JSONB
                  THEN NULL ELSE (item.value ->> 'game_character_id')::UUID END
                ELSE existing.game_character_id END,
              NULL::BIGINT,
              CASE WHEN item.value ? 'character_name'
                THEN item.value ->> 'character_name'
                ELSE existing.character_name END
            )
          )::TEXT,
          0
        ) AS lock_key
        FROM jsonb_array_elements(p_cast) AS item(value)
        LEFT JOIN public.work AS existing
          ON existing.id = CASE WHEN item.value ? 'id'
            THEN (item.value ->> 'id')::BIGINT ELSE NULL END
         AND existing.dubbing_project_id = v_project.id
        WHERE public.work_assignment_role_identity_key(
          CASE WHEN item.value ? 'game_character_id'
            THEN CASE WHEN item.value -> 'game_character_id' = 'null'::JSONB
              THEN NULL ELSE (item.value ->> 'game_character_id')::UUID END
            ELSE existing.game_character_id END,
          NULL::BIGINT,
          CASE WHEN item.value ? 'character_name'
            THEN item.value ->> 'character_name'
            ELSE existing.character_name END
        ) IS NOT NULL
      ) AS identity_locks
    ) AS lock_keys
    ORDER BY lock_keys.lock_key
  LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(v_lock_key);
  END LOOP;

  PERFORM 1
  FROM public.work AS work
  WHERE work.dubbing_project_id = v_project.id
  ORDER BY work.id
  FOR UPDATE;

  SELECT COALESCE(jsonb_agg(to_jsonb(crew_row) ORDER BY crew_row.id), '[]'::JSONB)
  INTO v_before_crew
  FROM public.dubbing_project_crew AS crew_row
  WHERE crew_row.dubbing_project_id = v_project.id;
  SELECT COALESCE(jsonb_agg(to_jsonb(work_row) ORDER BY work_row.id), '[]'::JSONB)
  INTO v_before_cast
  FROM public.work AS work_row
  WHERE work_row.dubbing_project_id = v_project.id;

  IF EXISTS (
    SELECT 1
    FROM public.dubbing_project_crew AS existing
    WHERE existing.dubbing_project_id = v_project.id
      AND existing.job_id = ANY (v_managed_jobs)
    GROUP BY existing.job_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'This editor cannot represent multiple crew members for the same job; resolve the crew rows before saving'
      USING ERRCODE = '55000';
  END IF;

  FOREACH v_job_id IN ARRAY v_managed_jobs LOOP
    SELECT crew.* INTO v_crew
    FROM public.dubbing_project_crew AS crew
    WHERE crew.dubbing_project_id = v_project.id
      AND crew.job_id = v_job_id
    FOR UPDATE;
    v_has_person := FOUND;

    SELECT assignment.person_id INTO v_person_id
    FROM jsonb_to_recordset(p_crew) AS assignment(job_id BIGINT, person_id BIGINT)
    WHERE assignment.job_id = v_job_id;
    IF FOUND THEN
      IF v_has_person THEN
        IF v_crew.person_id IS DISTINCT FROM v_person_id THEN
          UPDATE public.dubbing_project_crew AS crew
          SET person_id = v_person_id
          WHERE crew.id = v_crew.id;
        END IF;
      ELSE
        INSERT INTO public.dubbing_project_crew(dubbing_project_id, job_id, person_id)
        VALUES (v_project.id, v_job_id, v_person_id);
      END IF;
    ELSIF v_has_person THEN
      DELETE FROM public.dubbing_project_crew AS crew WHERE crew.id = v_crew.id;
    END IF;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_cast) AS cast_item(value)
  LOOP
    IF v_item ? 'id' THEN
      SELECT work.* INTO v_work
      FROM public.work AS work
      WHERE work.id = (v_item ->> 'id')::BIGINT
        AND work.dubbing_project_id = v_project.id
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Work id % is stale or does not belong to this project', v_item ->> 'id'
          USING ERRCODE = '55000';
      END IF;
      v_expected_work_updated_at := CASE WHEN v_item -> 'expected_updated_at' = 'null'::JSONB
        THEN NULL ELSE (v_item ->> 'expected_updated_at')::TIMESTAMPTZ END;
      v_expected_work := v_item -> 'expected';
      IF v_work.updated_at IS DISTINCT FROM v_expected_work_updated_at THEN
        RAISE EXCEPTION 'Work id % changed since it was loaded; reload before saving', v_work.id
          USING ERRCODE = '55000';
      END IF;
      IF v_work.actor_id IS DISTINCT FROM (CASE WHEN v_expected_work -> 'actor_id' = 'null'::JSONB
           THEN NULL ELSE (v_expected_work ->> 'actor_id')::BIGINT END)
         OR v_work.game_character_id IS DISTINCT FROM (CASE
           WHEN v_expected_work ? 'game_character_id' AND v_expected_work -> 'game_character_id' <> 'null'::JSONB
             THEN (v_expected_work ->> 'game_character_id')::UUID ELSE NULL END)
         OR v_work.character_name IS DISTINCT FROM (CASE WHEN v_expected_work -> 'character_name' = 'null'::JSONB
           THEN NULL ELSE v_expected_work ->> 'character_name' END)
         OR v_work.voice_actor_id IS DISTINCT FROM (CASE WHEN v_expected_work -> 'voice_actor_id' = 'null'::JSONB
           THEN NULL ELSE (v_expected_work ->> 'voice_actor_id')::BIGINT END)
         OR v_work.performance IS DISTINCT FROM (CASE WHEN v_expected_work -> 'performance' = 'null'::JSONB
           THEN NULL ELSE v_expected_work ->> 'performance' END)
         OR v_work.note IS DISTINCT FROM (CASE WHEN v_expected_work -> 'note' = 'null'::JSONB
           THEN NULL ELSE v_expected_work ->> 'note' END)
         OR v_work.highlight IS DISTINCT FROM (CASE WHEN v_expected_work -> 'highlight' = 'null'::JSONB
           THEN NULL ELSE (v_expected_work ->> 'highlight')::BOOLEAN END)
         OR v_work.status IS DISTINCT FROM (CASE WHEN v_expected_work -> 'status' = 'null'::JSONB
           THEN NULL ELSE v_expected_work ->> 'status' END) THEN
        RAISE EXCEPTION 'Work id % changed since it was loaded; reload before saving', v_work.id
          USING ERRCODE = '55000';
      END IF;

      UPDATE public.work AS work
      SET game_character_id = CASE WHEN v_item ? 'game_character_id'
            THEN CASE WHEN v_item -> 'game_character_id' = 'null'::JSONB THEN NULL ELSE (v_item ->> 'game_character_id')::UUID END
            ELSE work.game_character_id END,
          actor_id = CASE WHEN v_item ? 'actor_id'
            THEN CASE WHEN v_item -> 'actor_id' = 'null'::JSONB THEN NULL ELSE (v_item ->> 'actor_id')::BIGINT END
            ELSE work.actor_id END,
          character_name = CASE WHEN v_item ? 'character_name' THEN v_item ->> 'character_name' ELSE work.character_name END,
          voice_actor_id = CASE WHEN v_item ? 'voice_actor_id'
            THEN CASE WHEN v_item -> 'voice_actor_id' = 'null'::JSONB THEN NULL ELSE (v_item ->> 'voice_actor_id')::BIGINT END
            ELSE work.voice_actor_id END,
          performance = CASE WHEN v_item ? 'performance' THEN v_item ->> 'performance' ELSE work.performance END,
          note = CASE WHEN v_item ? 'note' THEN v_item ->> 'note' ELSE work.note END,
          highlight = CASE WHEN v_item ? 'highlight'
            THEN CASE WHEN v_item -> 'highlight' = 'null'::JSONB THEN NULL ELSE (v_item ->> 'highlight')::BOOLEAN END
            ELSE work.highlight END,
          status = CASE WHEN v_media_type IN ('audiobook', 'podcast', 'advertisement', 'toy')
            THEN 'validated' ELSE work.status END,
          updated_at = clock_timestamp(),
          updated_by = p_actor_id
      WHERE work.id = v_work.id;
    ELSE
      INSERT INTO public.work (
        dubbing_project_id, game_character_id, actor_id, character_name,
        voice_actor_id, performance, note, highlight, status, created_by
      ) VALUES (
        v_project.id,
        CASE WHEN v_item -> 'game_character_id' IS NULL OR v_item -> 'game_character_id' = 'null'::JSONB
          THEN NULL ELSE (v_item ->> 'game_character_id')::UUID END,
        CASE WHEN v_item -> 'actor_id' IS NULL OR v_item -> 'actor_id' = 'null'::JSONB
          THEN NULL ELSE (v_item ->> 'actor_id')::BIGINT END,
        CASE WHEN v_item -> 'character_name' IS NULL THEN NULL ELSE v_item ->> 'character_name' END,
        CASE WHEN v_item -> 'voice_actor_id' IS NULL OR v_item -> 'voice_actor_id' = 'null'::JSONB
          THEN NULL ELSE (v_item ->> 'voice_actor_id')::BIGINT END,
        CASE WHEN v_item -> 'performance' IS NULL THEN 'dialogues' ELSE v_item ->> 'performance' END,
        CASE WHEN v_item -> 'note' IS NULL THEN NULL ELSE v_item ->> 'note' END,
        CASE WHEN v_item -> 'highlight' IS NULL THEN FALSE ELSE (v_item ->> 'highlight')::BOOLEAN END,
        'validated',
        p_actor_id
      );
    END IF;
  END LOOP;

  IF p_project_id IS NOT NULL THEN
    UPDATE public.dubbing_projects AS project
    SET updated_at = clock_timestamp()
    WHERE project.id = v_project.id
    RETURNING project.updated_at INTO v_updated_at;
    SELECT project.* INTO v_project FROM public.dubbing_projects AS project WHERE project.id = v_project.id;
  ELSE
    v_updated_at := v_project.updated_at;
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(crew_row) ORDER BY crew_row.id), '[]'::JSONB)
  INTO v_after_crew
  FROM public.dubbing_project_crew AS crew_row
  WHERE crew_row.dubbing_project_id = v_project.id;
  SELECT COALESCE(jsonb_agg(to_jsonb(work_row) ORDER BY work_row.id), '[]'::JSONB)
  INTO v_after_cast
  FROM public.work AS work_row
  WHERE work_row.dubbing_project_id = v_project.id;

  v_before := jsonb_build_object(
    'project', v_before_project,
    'crew', v_before_crew,
    'cast', v_before_cast
  );
  v_after := jsonb_build_object(
    'project', to_jsonb(v_project),
    'crew', v_after_crew,
    'cast', v_after_cast
  );
  v_audit_id := pg_catalog.gen_random_uuid();

  INSERT INTO public.audit_logs (
    id, user_id, entity_type, entity_id, action,
    previous_value, new_value, changed_fields,
    request_id, request_fingerprint, metadata
  ) VALUES (
    v_audit_id, p_actor_id, 'dubbing_project', v_project.id::TEXT,
    CASE WHEN p_project_id IS NULL THEN 'create' ELSE 'update' END,
    v_before, v_after, ARRAY[]::TEXT[],
    p_request_id, v_fingerprint,
    jsonb_build_object(
      'source', 'save_dubbing_project_editor',
      'media_type', v_media_type,
      'transaction_id', pg_catalog.pg_current_xact_id()::TEXT
    )
  );

  RETURN QUERY SELECT v_project.id, v_project.updated_at, v_audit_id, FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_dubbing_project_editor_with_characters(p_actor_id uuid, p_request_id uuid, p_project_id bigint, p_expected_updated_at timestamp without time zone, p_project jsonb, p_crew jsonb, p_cast jsonb, p_new_game_characters jsonb)
 RETURNS TABLE(project_id bigint, updated_at timestamp without time zone, audit_log_id uuid, replayed boolean)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_draft RECORD;
  v_character_id UUID;
  v_created_ids JSONB := '{}'::JSONB;
  v_cast JSONB;
BEGIN
  IF p_project ->> 'content_type' IS DISTINCT FROM 'video_game'
     OR jsonb_typeof(p_cast) IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_new_game_characters) IS DISTINCT FROM 'object'
     OR p_new_game_characters = '{}'::JSONB THEN
    RAISE EXCEPTION 'New game characters require a video game cast'
      USING ERRCODE = '22023';
  END IF;

  -- Stable draft IDs are creation request IDs. Acquire their audit locks in order
  -- and let both writers use their existing authorization and replay checks.
  FOR v_draft IN SELECT key AS id, value AS name FROM jsonb_each(p_new_game_characters) ORDER BY key
  LOOP
    IF v_draft.id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       OR v_draft.id = p_request_id::TEXT
       OR jsonb_typeof(v_draft.name) IS DISTINCT FROM 'string'
       OR NOT p_cast @> jsonb_build_array(jsonb_build_object('game_character_id', v_draft.id))
       OR EXISTS (
         SELECT 1 FROM jsonb_array_elements(p_cast) AS item(value)
         WHERE item.value ->> 'game_character_id' = v_draft.id
           AND item.value -> 'character_name' IS DISTINCT FROM v_draft.name
       ) THEN
      RAISE EXCEPTION 'Invalid assignment for a new game character'
        USING ERRCODE = '22023';
    END IF;

    SELECT created.game_character_id INTO STRICT v_character_id
    FROM public.create_game_character(
      p_actor_id, v_draft.id::UUID, (p_project ->> 'content_id')::BIGINT, v_draft.name #>> '{}'
    ) AS created;
    v_created_ids := v_created_ids || jsonb_build_object(v_draft.id, v_character_id);
  END LOOP;

  SELECT jsonb_agg(
    CASE WHEN v_created_ids ? (item.value ->> 'game_character_id')
      THEN jsonb_set(item.value, '{game_character_id}', v_created_ids -> (item.value ->> 'game_character_id'))
      ELSE item.value END
    ORDER BY item.position
  ) INTO v_cast
  FROM jsonb_array_elements(p_cast) WITH ORDINALITY AS item(value, position);

  -- A save error rolls back both the new characters and their audit entries.
  RETURN QUERY SELECT * FROM public.save_dubbing_project_editor(
    p_actor_id, p_request_id, p_project_id, p_expected_updated_at, p_project, p_crew, v_cast
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_admin_credit_import(p_admin_id uuid, p_request_id uuid, p_content_id bigint, p_content_type text, p_language text, p_voice_actor_id bigint, p_voice_actor_firstname text, p_voice_actor_lastname text, p_work_actor_id bigint, p_character_name text)
 RETURNS TABLE(work_id bigint, project_id bigint, voice_actor_id bigint, audit_log_id uuid, replayed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    -- The key stays (always null) so a request stored before the argument was dropped still replays.
    'character_id', NULL::BIGINT,
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
    NULL::BIGINT, p_character_name
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
      AND work.game_character_id IS NULL
      AND public.work_role_identity_key(NULL::BIGINT, work.character_name)
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
      AND work.game_character_id IS NULL
      AND public.work_role_identity_key(NULL::BIGINT, work.character_name)
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
      dubbing_project_id, actor_id, voice_actor_id,
      character_name, performance, status
    ) VALUES (
      v_project_id, p_work_actor_id, v_voice_actor_id,
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
$function$;

REVOKE ALL ON FUNCTION public.save_admin_credit_import(
  UUID, UUID, BIGINT, TEXT, TEXT, BIGINT, TEXT, TEXT, BIGINT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_admin_credit_import(
  UUID, UUID, BIGINT, TEXT, TEXT, BIGINT, TEXT, TEXT, BIGINT, TEXT
) TO service_role;

-- The CLI does not run a migration file as one transaction, so the locks, the final check and the
-- DDL share one block: the locks wait for in-flight writers, the check then sees every committed
-- row, and nothing can be written between the check and the drops.
DO $final$
BEGIN
  PERFORM pg_catalog.set_config('lock_timeout', '5s', TRUE);
  LOCK TABLE public.work, public.source IN ACCESS EXCLUSIVE MODE;

  -- The linked game character replaces the legacy id only when it carries that same IGDB id.
  IF EXISTS (
    SELECT 1 FROM public.work AS work
    WHERE work.character_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.game_characters AS character
        WHERE character.id = work.game_character_id
          AND character.igdb_character_id = work.character_id
      )
  ) THEN
    RAISE EXCEPTION 'work.character_id still holds an IGDB id that no linked game character carries'
      USING ERRCODE = '55000';
  END IF;
  IF EXISTS (SELECT 1 FROM public.work WHERE pg_catalog.btrim(COALESCE(suggestions, '')) <> '') THEN
    RAISE EXCEPTION 'work.suggestions still holds data' USING ERRCODE = '55000';
  END IF;
  IF EXISTS (SELECT 1 FROM public.work WHERE source_id IS NOT NULL) THEN
    RAISE EXCEPTION 'work.source_id still holds data' USING ERRCODE = '55000';
  END IF;
  IF EXISTS (SELECT 1 FROM public.source) THEN
    RAISE EXCEPTION 'public.source still holds data' USING ERRCODE = '55000';
  END IF;

  -- The duplicate-work trigger is declared on specific columns, one of them character_id.
  DROP TRIGGER prevent_duplicate_work_assignment_trigger ON public.work;
  CREATE TRIGGER prevent_duplicate_work_assignment_trigger
    BEFORE INSERT OR UPDATE OF dubbing_project_id, actor_id, game_character_id, character_name, voice_actor_id
    ON public.work
    FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_work_assignment();

  ALTER TABLE public.work
    DROP COLUMN character_id,
    DROP COLUMN suggestions,
    DROP COLUMN source_id;

  DROP TABLE public.source;
END
$final$;
