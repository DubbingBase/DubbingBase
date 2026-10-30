CREATE TABLE public.game_characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  igdb_game_id BIGINT NOT NULL CHECK (igdb_game_id > 0),
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 300),
  igdb_character_id BIGINT CHECK (igdb_character_id IS NULL OR igdb_character_id > 0),
  wikidata_qid TEXT CHECK (
    wikidata_qid IS NULL OR wikidata_qid ~ '^Q[1-9][0-9]*$'
  ),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  updated_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX game_characters_igdb_reference_key
  ON public.game_characters (igdb_game_id, igdb_character_id)
  WHERE igdb_character_id IS NOT NULL;

CREATE UNIQUE INDEX game_characters_wikidata_reference_key
  ON public.game_characters (igdb_game_id, wikidata_qid)
  WHERE wikidata_qid IS NOT NULL;

CREATE INDEX game_characters_game_name_idx
  ON public.game_characters (igdb_game_id, lower(name), id);

ALTER TABLE public.game_characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read game characters"
  ON public.game_characters FOR SELECT TO anon, authenticated
  USING (true);

REVOKE ALL ON TABLE public.game_characters FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.game_characters TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_game_character(
  p_actor_id UUID,
  p_request_id UUID,
  p_igdb_game_id BIGINT,
  p_name TEXT
)
RETURNS TABLE(game_character_id UUID, audit_log_id UUID, replayed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role TEXT;
  v_character public.game_characters%ROWTYPE;
  v_existing_audit public.audit_logs%ROWTYPE;
  v_fingerprint TEXT;
  v_audit_id UUID;
BEGIN
  SELECT users.raw_app_meta_data ->> 'role'
  INTO v_role
  FROM auth.users AS users
  WHERE users.id = p_actor_id;

  IF p_actor_id IS NULL OR v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only an administrator can create a game character'
      USING ERRCODE = '42501';
  END IF;

  IF p_request_id IS NULL OR p_igdb_game_id IS NULL OR p_igdb_game_id <= 0
     OR p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 300 THEN
    RAISE EXCEPTION 'Game character fields are invalid'
      USING ERRCODE = '22023';
  END IF;

  v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'igdb_game_id', p_igdb_game_id,
    'name', pg_catalog.btrim(p_name)
  )::TEXT);

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_actor_id::TEXT || ':' || p_request_id::TEXT, 0)
  );

  SELECT audit.* INTO v_existing_audit
  FROM public.audit_logs AS audit
  WHERE audit.user_id = p_actor_id AND audit.request_id = p_request_id;
  IF FOUND THEN
    IF v_existing_audit.entity_type IS DISTINCT FROM 'game_character'
       OR v_existing_audit.action IS DISTINCT FROM 'create'
       OR v_existing_audit.request_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'Request id was already used for a different operation'
        USING ERRCODE = '23505';
    END IF;

    SELECT character.* INTO v_character
    FROM public.game_characters AS character
    WHERE character.id = v_existing_audit.entity_id::UUID;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The character created by this request no longer exists'
        USING ERRCODE = '55000';
    END IF;

    RETURN QUERY SELECT v_character.id, v_existing_audit.id, TRUE;
    RETURN;
  END IF;

  INSERT INTO public.game_characters (
    igdb_game_id, name, created_by, updated_by
  ) VALUES (
    p_igdb_game_id, pg_catalog.btrim(p_name), p_actor_id, p_actor_id
  ) RETURNING * INTO v_character;

  v_audit_id := pg_catalog.gen_random_uuid();
  INSERT INTO public.audit_logs (
    id, user_id, entity_type, entity_id, action,
    previous_value, new_value, changed_fields,
    request_id, request_fingerprint, metadata
  ) VALUES (
    v_audit_id, p_actor_id, 'game_character', v_character.id::TEXT, 'create',
    NULL, pg_catalog.to_jsonb(v_character),
    ARRAY['igdb_game_id', 'name']::TEXT[],
    p_request_id, v_fingerprint,
    pg_catalog.jsonb_build_object(
      'source', 'create_game_character',
      'provenance', 'dubbing_project_editor',
      'igdb_game_id', p_igdb_game_id,
      'transaction_id', pg_catalog.pg_current_xact_id()::TEXT
    )
  );

  RETURN QUERY SELECT v_character.id, v_audit_id, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.create_game_character(UUID, UUID, BIGINT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_game_character(UUID, UUID, BIGINT, TEXT)
  TO service_role;

COMMENT ON TABLE public.game_characters IS
  'Minimal local identities for game characters missing from IGDB; external game catalog data remains authoritative.';

-- Local game identity is additive; legacy numeric provider ids remain unchanged.
ALTER TABLE public.work
  ADD COLUMN game_character_id UUID REFERENCES public.game_characters(id) ON DELETE RESTRICT;

CREATE INDEX work_game_character_id_idx ON public.work (game_character_id)
  WHERE game_character_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.work_assignment_role_identity_key(
  p_game_character_id UUID,
  p_character_id BIGINT,
  p_character_name TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT CASE WHEN p_game_character_id IS NOT NULL
    THEN 'game_character:' || p_game_character_id::TEXT
    ELSE public.work_role_identity_key(p_character_id, p_character_name)
  END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_duplicate_work_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_new_role_key TEXT;
  v_old_role_key TEXT;
  v_new_lock_key BIGINT;
  v_old_lock_key BIGINT;
BEGIN
  v_new_role_key := public.work_assignment_role_identity_key(
    NEW.game_character_id, NEW.character_id, NEW.character_name
  );

  IF TG_OP = 'UPDATE' THEN
    v_old_role_key := public.work_assignment_role_identity_key(
      OLD.game_character_id, OLD.character_id, OLD.character_name
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
        existing.game_character_id, existing.character_id, existing.character_name
      ) = v_new_role_key
      AND (TG_OP <> 'UPDATE' OR existing.id <> OLD.id)
  ) THEN
    RAISE EXCEPTION 'duplicate work assignment already exists'
      USING ERRCODE = '23505', CONSTRAINT = 'work_unique_assignment_role_aware';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.work_assignment_role_identity_key(UUID, BIGINT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.work_assignment_role_identity_key(UUID, BIGINT, TEXT)
  TO service_role;
REVOKE ALL ON FUNCTION public.prevent_duplicate_work_assignment()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS prevent_duplicate_work_assignment_trigger ON public.work;
CREATE TRIGGER prevent_duplicate_work_assignment_trigger
BEFORE INSERT OR UPDATE OF dubbing_project_id, actor_id, character_id, game_character_id, character_name, voice_actor_id
ON public.work
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_work_assignment();

CREATE OR REPLACE FUNCTION public.save_dubbing_project_editor(
  p_actor_id UUID,
  p_request_id UUID,
  p_project_id BIGINT,
  p_expected_updated_at TIMESTAMP WITHOUT TIME ZONE,
  p_project JSONB,
  p_crew JSONB,
  p_cast JSONB
)
RETURNS TABLE(project_id BIGINT, updated_at TIMESTAMP WITHOUT TIME ZONE, audit_log_id UUID, replayed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_metadata JSONB;
  v_project public.dubbing_projects%ROWTYPE;
  v_existing_audit public.audit_logs%ROWTYPE;
  v_work public.work%ROWTYPE;
  v_crew public.dubbing_project_crew%ROWTYPE;
  v_media_type TEXT;
  v_content_id BIGINT;
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
           'id', 'expected_updated_at', 'expected', 'actor_id', 'character_id', 'character_name',
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
           'actor_id', 'character_id', 'character_name', 'voice_actor_id',
           'performance', 'note', 'highlight', 'status'
         ]::TEXT[])
         OR EXISTS (
           SELECT 1 FROM jsonb_object_keys(item.value -> 'expected') AS expected_field(name)
           WHERE expected_field.name <> ALL (ARRAY[
             'actor_id', 'character_id', 'character_name', 'game_character_id', 'voice_actor_id',
             'performance', 'note', 'highlight', 'status'
           ]::TEXT[])
         )
         OR jsonb_typeof(item.value -> 'expected' -> 'actor_id') NOT IN ('number', 'null')
         OR jsonb_typeof(item.value -> 'expected' -> 'character_id') NOT IN ('number', 'null')
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
       OR (item.value ? 'character_id' AND item.value -> 'character_id' <> 'null'::JSONB AND (
         jsonb_typeof(item.value -> 'character_id') IS DISTINCT FROM 'number'
         OR (item.value ->> 'character_id') !~ '^[1-9][0-9]{0,17}$'
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
     AND character.igdb_game_id = v_content_id
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
       OR v_after_cast IS DISTINCT FROM v_existing_audit.new_value -> 'cast' THEN
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
      WHERE internal_project.content_id = v_content_id
        AND internal_project.content_type = v_media_type
    ) THEN
      RAISE EXCEPTION 'Internal media must be created before adding a language project'
        USING ERRCODE = '23503';
    END IF;
    INSERT INTO public.dubbing_projects (
      content_id, content_type, language, studio_id, status
    ) VALUES (
      v_content_id, v_media_type, v_language, v_studio_id, v_status
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
    IF v_project.content_id IS DISTINCT FROM v_content_id
       OR v_project.content_type IS DISTINCT FROM v_media_type THEN
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
              work.game_character_id, work.character_id, work.character_name
            )
          )::TEXT,
          0
        ) AS lock_key
        FROM public.work AS work
        WHERE work.dubbing_project_id = v_project.id
          AND public.work_assignment_role_identity_key(
            work.game_character_id, work.character_id, work.character_name
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
              CASE WHEN item.value ? 'character_id'
                THEN CASE WHEN item.value -> 'character_id' = 'null'::JSONB
                  THEN NULL ELSE (item.value ->> 'character_id')::BIGINT END
                ELSE existing.character_id END,
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
          CASE WHEN item.value ? 'character_id'
            THEN CASE WHEN item.value -> 'character_id' = 'null'::JSONB
              THEN NULL ELSE (item.value ->> 'character_id')::BIGINT END
            ELSE existing.character_id END,
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
         OR v_work.character_id IS DISTINCT FROM (CASE WHEN v_expected_work -> 'character_id' = 'null'::JSONB
           THEN NULL ELSE (v_expected_work ->> 'character_id')::BIGINT END)
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
          character_id = CASE WHEN v_item ? 'character_id'
            THEN CASE WHEN v_item -> 'character_id' = 'null'::JSONB THEN NULL ELSE (v_item ->> 'character_id')::BIGINT END
            ELSE work.character_id END,
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
        dubbing_project_id, game_character_id, actor_id, character_id, character_name,
        voice_actor_id, performance, note, highlight, status, created_by
      ) VALUES (
        v_project.id,
        CASE WHEN v_item -> 'game_character_id' IS NULL OR v_item -> 'game_character_id' = 'null'::JSONB
          THEN NULL ELSE (v_item ->> 'game_character_id')::UUID END,
        CASE WHEN v_item -> 'actor_id' IS NULL OR v_item -> 'actor_id' = 'null'::JSONB
          THEN NULL ELSE (v_item ->> 'actor_id')::BIGINT END,
        CASE WHEN v_item -> 'character_id' IS NULL OR v_item -> 'character_id' = 'null'::JSONB
          THEN NULL ELSE (v_item ->> 'character_id')::BIGINT END,
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
$$;

REVOKE ALL ON FUNCTION public.save_dubbing_project_editor(UUID, UUID, BIGINT, TIMESTAMP WITHOUT TIME ZONE, JSONB, JSONB, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_dubbing_project_editor(UUID, UUID, BIGINT, TIMESTAMP WITHOUT TIME ZONE, JSONB, JSONB, JSONB)
  TO service_role;

CREATE OR REPLACE FUNCTION public.update_game_character_references(
  p_actor_id UUID,
  p_request_id UUID,
  p_game_character_id UUID,
  p_expected_updated_at TIMESTAMPTZ,
  p_references JSONB
)
RETURNS TABLE(game_character_id UUID, updated_at TIMESTAMPTZ, audit_log_id UUID, replayed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_character public.game_characters%ROWTYPE;
  v_existing_audit public.audit_logs%ROWTYPE;
  v_role TEXT;
  v_fingerprint TEXT;
  v_audit_id UUID;
  v_before JSONB;
  v_after JSONB;
BEGIN
  SELECT users.raw_app_meta_data ->> 'role'
  INTO v_role
  FROM auth.users AS users
  WHERE users.id = p_actor_id;
  IF p_actor_id IS NULL OR v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only an administrator can update game character references'
      USING ERRCODE = '42501';
  END IF;

  IF p_request_id IS NULL OR p_game_character_id IS NULL OR p_expected_updated_at IS NULL
     OR jsonb_typeof(p_references) IS DISTINCT FROM 'object'
     OR p_references = '{}'::JSONB
     OR EXISTS (
       SELECT 1 FROM jsonb_object_keys(p_references) AS field_name(name)
       WHERE field_name.name <> ALL (ARRAY['igdb_character_id', 'wikidata_qid']::TEXT[])
     )
     OR (p_references ? 'igdb_character_id' AND
       p_references -> 'igdb_character_id' <> 'null'::JSONB AND (
         jsonb_typeof(p_references -> 'igdb_character_id') IS DISTINCT FROM 'number'
         OR (p_references ->> 'igdb_character_id') !~ '^[1-9][0-9]{0,17}$'
       ))
     OR (p_references ? 'wikidata_qid' AND
       p_references -> 'wikidata_qid' <> 'null'::JSONB AND (
         jsonb_typeof(p_references -> 'wikidata_qid') IS DISTINCT FROM 'string'
         OR (p_references ->> 'wikidata_qid') !~ '^Q[1-9][0-9]*$'
       )) THEN
    RAISE EXCEPTION 'Game character references are invalid'
      USING ERRCODE = '22023';
  END IF;

  v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'game_character_id', p_game_character_id,
    'expected_updated_at', p_expected_updated_at,
    'references', p_references
  )::TEXT);
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_actor_id::TEXT || ':' || p_request_id::TEXT, 0)
  );

  SELECT audit.* INTO v_existing_audit
  FROM public.audit_logs AS audit
  WHERE audit.user_id = p_actor_id AND audit.request_id = p_request_id;
  IF FOUND THEN
    IF v_existing_audit.entity_type IS DISTINCT FROM 'game_character'
       OR v_existing_audit.entity_id IS DISTINCT FROM p_game_character_id::TEXT
       OR v_existing_audit.action IS DISTINCT FROM 'update'
       OR v_existing_audit.request_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'Request id was already used for a different operation'
        USING ERRCODE = '23505';
    END IF;

    SELECT character.* INTO v_character
    FROM public.game_characters AS character
    WHERE character.id = p_game_character_id;
    IF NOT FOUND OR to_jsonb(v_character) IS DISTINCT FROM v_existing_audit.new_value THEN
      RAISE EXCEPTION 'The character changed after this reference update; reload before retrying'
        USING ERRCODE = '55000';
    END IF;
    RETURN QUERY SELECT v_character.id, v_character.updated_at, v_existing_audit.id, TRUE;
    RETURN;
  END IF;

  SELECT character.* INTO v_character
  FROM public.game_characters AS character
  WHERE character.id = p_game_character_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game character does not exist' USING ERRCODE = '23503';
  END IF;
  IF v_character.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Game character references changed; reload before saving'
      USING ERRCODE = '55000';
  END IF;

  v_before := pg_catalog.to_jsonb(v_character);
  UPDATE public.game_characters AS character
  SET igdb_character_id = CASE WHEN p_references ? 'igdb_character_id'
        THEN CASE WHEN p_references -> 'igdb_character_id' = 'null'::JSONB
          THEN NULL ELSE (p_references ->> 'igdb_character_id')::BIGINT END
        ELSE character.igdb_character_id END,
      wikidata_qid = CASE WHEN p_references ? 'wikidata_qid'
        THEN p_references ->> 'wikidata_qid' ELSE character.wikidata_qid END,
      updated_by = p_actor_id,
      updated_at = pg_catalog.clock_timestamp()
  WHERE character.id = p_game_character_id
  RETURNING character.* INTO v_character;
  v_after := pg_catalog.to_jsonb(v_character);

  v_audit_id := pg_catalog.gen_random_uuid();
  INSERT INTO public.audit_logs (
    id, user_id, entity_type, entity_id, action,
    previous_value, new_value, changed_fields,
    request_id, request_fingerprint, metadata
  ) VALUES (
    v_audit_id, p_actor_id, 'game_character', v_character.id::TEXT, 'update',
    v_before, v_after, ARRAY(SELECT jsonb_object_keys(p_references))::TEXT[],
    p_request_id, v_fingerprint,
    pg_catalog.jsonb_build_object(
      'source', 'update_game_character_references',
      'provenance', 'manual_confirmation',
      'igdb_game_id', v_character.igdb_game_id,
      'transaction_id', pg_catalog.pg_current_xact_id()::TEXT
    )
  );

  RETURN QUERY SELECT v_character.id, v_character.updated_at, v_audit_id, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.update_game_character_references(UUID, UUID, UUID, TIMESTAMPTZ, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_game_character_references(UUID, UUID, UUID, TIMESTAMPTZ, JSONB)
  TO service_role;



-- Duplicate moderation must use the same UUID identity as editor saves.
CREATE OR REPLACE FUNCTION public.find_duplicate_work_groups(
  p_after_group_id bigint DEFAULT 0,
  p_limit integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH duplicate_groups AS (
    SELECT
      w.dubbing_project_id,
      w.actor_id,
      w.voice_actor_id,
      public.work_assignment_role_identity_key(w.game_character_id, w.character_id, w.character_name) AS role_key,
      min(w.character_id) AS character_id,
      min(w.id) AS group_id,
      count(*) AS group_size
    FROM public.work AS w
    WHERE public.work_assignment_role_identity_key(w.game_character_id, w.character_id, w.character_name) IS NOT NULL
    GROUP BY w.dubbing_project_id, w.actor_id, w.voice_actor_id,
      public.work_assignment_role_identity_key(w.game_character_id, w.character_id, w.character_name)
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
          'sourceName', src.name,
          'voiceActor', CASE WHEN va.id IS NULL THEN NULL ELSE jsonb_build_object(
            'id', va.id, 'firstName', va.firstname, 'lastName', va.lastname
          ) END
        ) ORDER BY w.id
      ) AS works,
      jsonb_build_object(
        'id', dp.id,
        'contentId', dp.content_id,
        'contentType', dp.content_type,
        'language', dp.language
      ) AS project
    FROM page_groups AS g
    JOIN public.work AS w
      ON w.dubbing_project_id IS NOT DISTINCT FROM g.dubbing_project_id
      AND w.actor_id IS NOT DISTINCT FROM g.actor_id
      AND w.voice_actor_id IS NOT DISTINCT FROM g.voice_actor_id
      AND public.work_assignment_role_identity_key(w.game_character_id, w.character_id, w.character_name) = g.role_key
    JOIN public.dubbing_projects AS dp ON dp.id = g.dubbing_project_id
    LEFT JOIN public.voice_actors AS va ON va.id = w.voice_actor_id
    LEFT JOIN public.source AS src ON src.id = w.source_id
    LEFT JOIN LATERAL (
      SELECT
        count(*) AS vote_count,
        count(*) FILTER (WHERE vote_type = 'up') AS up_votes,
        count(*) FILTER (WHERE vote_type = 'down') AS down_votes
      FROM public.votes
      WHERE work_id = w.id
    ) AS v ON true
    GROUP BY g.dubbing_project_id, g.actor_id, g.voice_actor_id, g.role_key,
      g.character_id, g.group_id, g.group_size, dp.id, dp.content_id, dp.content_type, dp.language
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
          'characterId', character_id,
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
$$;

REVOKE ALL ON FUNCTION public.find_duplicate_work_groups(BIGINT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_duplicate_work_groups(BIGINT, INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.merge_work_duplicates_atomic(
  p_canonical_id bigint,
  p_work_ids bigint[],
  p_updates jsonb,
  p_admin_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
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
  IF p_updates - ARRAY['performance','status','reviewed_status','note','highlight','source_id','suggestions','character_name']::text[] <> '{}'::jsonb THEN
    RAISE EXCEPTION 'unsupported work fields' USING ERRCODE = '22023';
  END IF;

  SELECT array_agg(DISTINCT id ORDER BY id) INTO v_supplied_ids
  FROM unnest(COALESCE(p_work_ids, ARRAY[]::bigint[])) AS ids(id);
  IF cardinality(v_supplied_ids) < 2 OR p_canonical_id <> ALL(v_supplied_ids) THEN
    RAISE EXCEPTION 'invalid duplicate group' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_identity FROM public.work WHERE id = p_canonical_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'duplicate group changed' USING ERRCODE = '40001';
  END IF;
  v_role_key := public.work_assignment_role_identity_key(v_identity.game_character_id, v_identity.character_id, v_identity.character_name);
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
    AND public.work_assignment_role_identity_key(game_character_id, character_id, character_name) = v_role_key;
  IF v_actual_ids IS DISTINCT FROM v_supplied_ids THEN
    RAISE EXCEPTION 'duplicate group changed' USING ERRCODE = '40001';
  END IF;

  IF p_updates ? 'character_name' AND v_identity.character_id IS NULL
     AND v_identity.game_character_id IS NULL
     AND public.work_role_identity_key(NULL, p_updates->>'character_name') IS DISTINCT FROM v_role_key THEN
    RAISE EXCEPTION 'final role name cannot change merge identity' USING ERRCODE = '22023';
  END IF;
  IF p_updates ? 'source_id' AND NULLIF(p_updates->>'source_id', '') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.source WHERE id = (p_updates->>'source_id')::bigint) THEN
    RAISE EXCEPTION 'source not found' USING ERRCODE = '22023';
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
      source_id = CASE WHEN p_updates ? 'source_id' THEN NULLIF(p_updates->>'source_id', '')::bigint ELSE source_id END,
      suggestions = CASE WHEN p_updates ? 'suggestions' THEN p_updates->>'suggestions' ELSE suggestions END,
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
$$;

REVOKE ALL ON FUNCTION public.merge_work_duplicates_atomic(BIGINT, BIGINT[], JSONB, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_work_duplicates_atomic(BIGINT, BIGINT[], JSONB, UUID) TO service_role;


-- Voice actor linking must preserve local game character UUIDs and keep legacy name matching away from local identities.
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
    AND work.game_character_id IS NULL
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
      AND work.game_character_id IS NULL
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


CREATE OR REPLACE FUNCTION public.create_voice_actor_work_link(
  p_user_id UUID,
  p_request_id UUID,
  p_voice_actor_id BIGINT,
  p_content_id BIGINT,
  p_content_type TEXT,
  p_language TEXT,
  p_actor_person_id BIGINT,
  p_game_character_id UUID,
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
  PERFORM public.require_voice_actor_work_permission(p_user_id, p_voice_actor_id);
  IF NOT EXISTS (
    SELECT 1 FROM public.voice_actors AS voice_actor WHERE voice_actor.id = p_voice_actor_id
  ) THEN
    RAISE EXCEPTION 'Voice actor does not exist' USING ERRCODE = '23503';
  END IF;
  IF p_game_character_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.game_characters AS character
    WHERE character.id = p_game_character_id AND character.igdb_game_id = p_content_id
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
    AND public.work_assignment_role_identity_key(work.game_character_id, work.character_id, work.character_name) = v_role;
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
      AND public.work_assignment_role_identity_key(work.game_character_id, work.character_id, work.character_name) = v_role
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
    performance, status, created_by
  ) VALUES (
    v_project_id, p_game_character_id, p_actor_person_id, p_voice_actor_id, p_character_name,
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

REVOKE ALL ON FUNCTION public.create_voice_actor_work_link(UUID, UUID, BIGINT, BIGINT, TEXT, TEXT, BIGINT, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_voice_actor_work_link(UUID, UUID, BIGINT, BIGINT, TEXT, TEXT, BIGINT, UUID, TEXT, TEXT)
  TO service_role;



-- Legacy name-based imports and lookup cannot capture UUID-owned character credits.
CREATE OR REPLACE FUNCTION public.find_work_role_identity_matches(
  p_work_ids bigint[],
  p_character_id bigint,
  p_character_name text
)
RETURNS bigint[]
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(pg_catalog.array_agg(work.id), ARRAY[]::bigint[])
  FROM public.work
  WHERE work.id = ANY(p_work_ids)
    AND work.game_character_id IS NULL
    AND public.work_role_identity_key(p_character_id, p_character_name) IS NOT NULL
    AND public.work_role_identity_key(work.character_id, work.character_name)
      = public.work_role_identity_key(p_character_id, p_character_name);
$$;

REVOKE ALL ON FUNCTION public.find_work_role_identity_matches(BIGINT[], BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_work_role_identity_matches(BIGINT[], BIGINT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.apply_extracted_credits(
  p_content_id bigint,
  p_content_type text,
  p_dubbing_language text,
  p_credits jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project_id bigint;
  v_inserted_actors integer := 0;
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
      OR (item.value ? 'character_id' AND item.value->>'character_id' IS NOT NULL
          AND (item.value->>'character_id' !~ '^[0-9]+$'
            OR (item.value->>'character_id')::numeric <= 0))
  ) THEN
    RAISE EXCEPTION 'Malformed extracted credit' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.dubbing_projects(content_id, content_type, language)
  VALUES (p_content_id, p_content_type, p_dubbing_language)
  ON CONFLICT (content_id, content_type, language) DO NOTHING;
  SELECT project.id INTO STRICT v_project_id
  FROM public.dubbing_projects AS project
  WHERE project.content_id = p_content_id
    AND project.content_type = p_content_type
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
      NULLIF(item.value->>'character_id', '')::bigint AS character_id,
      NULLIF(item.value->>'character_name', '') AS character_name,
      NULLIF(item.value->>'performance', '') AS performance,
      item.ordinal,
      public.work_role_identity_key(NULLIF(item.value->>'character_id', '')::bigint,
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
    -- Keep ambiguous credits distinct, while matching each occurrence on replay.
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
        AND public.work_role_identity_key(candidate.character_id, candidate.character_name)
          IS NOT DISTINCT FROM credits.role_key
      ORDER BY candidate.id
      OFFSET (credits.match_ordinal - 1)
      LIMIT 1
    ) AS existing ON true
  )
  UPDATE public.work AS work
  SET performance = resolved.performance,
      character_name = COALESCE(resolved.character_name, work.character_name)
  FROM resolved
  WHERE work.id = resolved.existing_work_id AND work.status = 'suggestion';

  WITH raw_credits AS (
    SELECT
      btrim(item.value->>'firstname') AS firstname,
      btrim(item.value->>'lastname') AS lastname,
      (item.value->>'actor_id')::bigint AS actor_id,
      NULLIF(item.value->>'character_id', '')::bigint AS character_id,
      NULLIF(item.value->>'character_name', '') AS character_name,
      COALESCE(NULLIF(item.value->>'performance', ''), 'dialogues') AS performance,
      item.ordinal,
      public.work_role_identity_key(NULLIF(item.value->>'character_id', '')::bigint,
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
        AND public.work_role_identity_key(candidate.character_id, candidate.character_name)
          IS NOT DISTINCT FROM credits.role_key
      ORDER BY candidate.id
      OFFSET (credits.match_ordinal - 1)
      LIMIT 1
    ) AS existing ON true
  )
  INSERT INTO public.work(
    dubbing_project_id, voice_actor_id, actor_id, character_id, character_name, performance
  )
  SELECT v_project_id, resolved.voice_actor_id, resolved.actor_id, resolved.character_id,
    resolved.character_name, resolved.performance
  FROM resolved
  WHERE resolved.existing_work_id IS NULL
  ORDER BY resolved.actor_id, resolved.voice_actor_id, resolved.role_key, resolved.match_ordinal
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('new_voice_actors', v_inserted_actors,
    'credits_added', jsonb_array_length(p_credits));
END;
$$;

REVOKE ALL ON FUNCTION public.apply_extracted_credits(BIGINT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_extracted_credits(BIGINT, TEXT, TEXT, JSONB) TO service_role;

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
      AND work.game_character_id IS NULL
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
      AND work.game_character_id IS NULL
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

REVOKE ALL ON FUNCTION public.save_admin_credit_import(UUID, UUID, BIGINT, TEXT, TEXT, BIGINT, TEXT, TEXT, BIGINT, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_admin_credit_import(UUID, UUID, BIGINT, TEXT, TEXT, BIGINT, TEXT, TEXT, BIGINT, BIGINT, TEXT) TO service_role;
