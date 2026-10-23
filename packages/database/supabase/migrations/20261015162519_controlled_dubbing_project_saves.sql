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
           'voice_actor_id', 'performance', 'note', 'highlight', 'status'
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
             'actor_id', 'character_id', 'character_name', 'voice_actor_id',
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
            public.work_role_identity_key(work.character_id, work.character_name)
          )::TEXT,
          0
        ) AS lock_key
        FROM public.work AS work
        WHERE work.dubbing_project_id = v_project.id
          AND public.work_role_identity_key(work.character_id, work.character_name) IS NOT NULL

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
            public.work_role_identity_key(
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
        WHERE public.work_role_identity_key(
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
      SET actor_id = CASE WHEN v_item ? 'actor_id'
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
        dubbing_project_id, actor_id, character_id, character_name,
        voice_actor_id, performance, note, highlight, status, created_by
      ) VALUES (
        v_project.id,
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

CREATE OR REPLACE FUNCTION public.guard_dubbing_project_controlled_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  RAISE EXCEPTION 'Dubbing project writes must use a controlled operation'
    USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.guard_dubbing_project_controlled_write() FROM PUBLIC, anon, authenticated, service_role;

-- Existing service-role RPC writers remain callable, but execute as their
-- postgres owner so controlled writes pass this guard through PostgREST.
DO $$
DECLARE
  v_function REGPROCEDURE;
  v_function_name TEXT;
  v_found_names TEXT[] := ARRAY[]::TEXT[];
BEGIN
  FOR v_function, v_function_name IN
    SELECT routine.oid::REGPROCEDURE, routine.proname
    FROM pg_catalog.pg_proc AS routine
    JOIN pg_catalog.pg_namespace AS schema ON schema.oid = routine.pronamespace
    WHERE schema.nspname = 'public'
      AND routine.proname IN (
        'save_regional_project_actor_assignments',
        'merge_voice_actor_duplicates_atomic'
      )
  LOOP
    EXECUTE pg_catalog.format('ALTER FUNCTION %s OWNER TO postgres', v_function);
    EXECUTE pg_catalog.format('ALTER FUNCTION %s SECURITY DEFINER', v_function);
    EXECUTE pg_catalog.format('ALTER FUNCTION %s SET search_path = %L', v_function, '');
    EXECUTE pg_catalog.format(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      v_function
    );
    EXECUTE pg_catalog.format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_function);
    v_found_names := pg_catalog.array_append(v_found_names, v_function_name);
  END LOOP;
  IF NOT ('save_regional_project_actor_assignments' = ANY(v_found_names))
     OR NOT ('merge_voice_actor_duplicates_atomic' = ANY(v_found_names)) THEN
    RAISE EXCEPTION 'A required controlled-write RPC was not found';
  END IF;
END;
$$;
DROP TRIGGER IF EXISTS guard_dubbing_projects_controlled_write ON public.dubbing_projects;
CREATE TRIGGER guard_dubbing_projects_controlled_write
  BEFORE INSERT OR UPDATE OR DELETE ON public.dubbing_projects
  FOR EACH ROW EXECUTE FUNCTION public.guard_dubbing_project_controlled_write();
DROP TRIGGER IF EXISTS guard_dubbing_project_crew_controlled_write ON public.dubbing_project_crew;
CREATE TRIGGER guard_dubbing_project_crew_controlled_write
  BEFORE INSERT OR UPDATE OR DELETE ON public.dubbing_project_crew
  FOR EACH ROW EXECUTE FUNCTION public.guard_dubbing_project_controlled_write();

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
DECLARE
  v_role TEXT;
  v_project public.dubbing_projects%ROWTYPE;
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
     OR length(COALESCE(p_description, '')) > 10000 THEN
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
    RETURN QUERY SELECT v_project.id, v_project.content_id, v_existing_audit.id, TRUE;
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

  RETURN QUERY SELECT v_project.id, v_project.content_id, v_audit_id, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.create_internal_dubbing_project(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_internal_dubbing_project(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  TO service_role;

CREATE OR REPLACE FUNCTION public.find_or_create_dubbing_project(
  p_actor_id UUID,
  p_voice_actor_id BIGINT,
  p_request_id UUID,
  p_content_id BIGINT,
  p_content_type TEXT,
  p_language TEXT
)
RETURNS TABLE(project_id BIGINT, audit_log_id UUID, replayed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_role TEXT;
  v_project public.dubbing_projects%ROWTYPE;
  v_existing_audit public.audit_logs%ROWTYPE;
  v_fingerprint TEXT;
  v_audit_id UUID;
BEGIN
  SELECT users.raw_app_meta_data ->> 'role'
  INTO v_actor_role
  FROM auth.users AS users
  WHERE users.id = p_actor_id;
  IF p_actor_id IS NULL OR p_request_id IS NULL
     OR p_content_id IS NULL OR p_content_id = 0
     OR p_content_type NOT IN ('movie', 'tv', 'video_game', 'audiobook', 'podcast', 'advertisement', 'toy')
     OR (p_content_id < 0 AND p_content_type NOT IN ('advertisement', 'toy'))
     OR p_language IS NULL OR NOT public.is_valid_dubbing_language(p_language) THEN
    RAISE EXCEPTION 'Dubbing project references are invalid' USING ERRCODE = '22023';
  END IF;
  IF v_actor_role IS DISTINCT FROM 'admin' AND (
    p_voice_actor_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.user_voice_actor_links AS link
      WHERE link.user_id = p_actor_id AND link.voice_actor_id = p_voice_actor_id
    )
  ) THEN
    RAISE EXCEPTION 'The actor does not own the selected voice actor'
      USING ERRCODE = '42501';
  END IF;
  IF p_voice_actor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.voice_actors AS voice_actor WHERE voice_actor.id = p_voice_actor_id
  ) THEN
    RAISE EXCEPTION 'Selected voice actor does not exist' USING ERRCODE = '23503';
  END IF;
  IF p_content_type IN ('advertisement', 'toy') AND NOT EXISTS (
    SELECT 1 FROM public.dubbing_projects AS internal_project
    WHERE internal_project.content_id = p_content_id
      AND internal_project.content_type = p_content_type
  ) THEN
    RAISE EXCEPTION 'Internal media must be created before a voice actor can link it'
      USING ERRCODE = '23503';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_actor_id::TEXT || ':' || p_request_id::TEXT, 0)
  );
  v_fingerprint := md5(jsonb_build_object(
    'voice_actor_id', p_voice_actor_id,
    'content_id', p_content_id,
    'content_type', p_content_type,
    'language', p_language
  )::TEXT);
  SELECT audit.* INTO v_existing_audit
  FROM public.audit_logs AS audit
  WHERE audit.user_id = p_actor_id AND audit.request_id = p_request_id;
  IF FOUND THEN
    IF v_existing_audit.request_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'Request id was already used with different project data'
        USING ERRCODE = '23505';
    END IF;
    SELECT project.* INTO v_project
    FROM public.dubbing_projects AS project
    WHERE project.id = v_existing_audit.entity_id::BIGINT;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The project created by this request no longer exists'
        USING ERRCODE = '55000';
    END IF;
    RETURN QUERY SELECT v_project.id, v_existing_audit.id, TRUE;
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_content_type || ':' || p_content_id::TEXT || ':' || p_language, 0
    )
  );
  SELECT project.* INTO v_project
  FROM public.dubbing_projects AS project
  WHERE project.content_id = p_content_id
    AND project.content_type = p_content_type
    AND project.language = p_language
  FOR UPDATE;
  IF FOUND THEN
    RETURN QUERY SELECT v_project.id, NULL::UUID, FALSE;
    RETURN;
  END IF;

  INSERT INTO public.dubbing_projects(content_id, content_type, language)
  VALUES (p_content_id, p_content_type, p_language)
  RETURNING * INTO v_project;
  v_audit_id := pg_catalog.gen_random_uuid();
  INSERT INTO public.audit_logs (
    id, user_id, entity_type, entity_id, action,
    previous_value, new_value, changed_fields,
    request_id, request_fingerprint, metadata
  ) VALUES (
    v_audit_id, p_actor_id, 'dubbing_project', v_project.id::TEXT, 'create',
    jsonb_build_object('project', NULL, 'crew', '[]'::JSONB, 'cast', '[]'::JSONB),
    jsonb_build_object('project', to_jsonb(v_project), 'crew', '[]'::JSONB, 'cast', '[]'::JSONB),
    ARRAY[]::TEXT[], p_request_id, v_fingerprint,
    jsonb_build_object(
      'source', 'find_or_create_dubbing_project',
      'voice_actor_id', p_voice_actor_id,
      'transaction_id', pg_catalog.pg_current_xact_id()::TEXT
    )
  );
  RETURN QUERY SELECT v_project.id, v_audit_id, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.find_or_create_dubbing_project(UUID, BIGINT, UUID, BIGINT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_or_create_dubbing_project(UUID, BIGINT, UUID, BIGINT, TEXT, TEXT)
  TO service_role;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.dubbing_projects FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.dubbing_project_crew FROM PUBLIC, anon, authenticated;
REVOKE TRUNCATE ON public.dubbing_projects, public.dubbing_project_crew FROM service_role;
