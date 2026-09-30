DROP FUNCTION IF EXISTS public.replace_regional_project_actor_assignments(bigint, bigint[], jsonb);

CREATE FUNCTION public.save_regional_project_actor_assignments(
  p_content_id bigint,
  p_content_type text,
  p_dubbing_language text,
  p_operations jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_project_id bigint;
  v_operation record;
  v_work_ids bigint[];
  v_work_count integer;
  v_affected_rows integer;
BEGIN
  IF p_content_id IS NULL
    OR p_content_type IS NULL
    OR p_content_type NOT IN ('movie', 'tv', 'video_game', 'audiobook', 'podcast', 'advertisement', 'toy')
    OR p_dubbing_language IS NULL
    OR p_dubbing_language !~ '^[a-z]{2,3}-[A-Z]{2}$' THEN
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
    FROM jsonb_to_recordset(p_operations) AS operation(
      actor_id bigint,
      work_id bigint,
      voice_actor_id bigint
    )
    WHERE operation.actor_id IS NULL
      OR operation.actor_id <= 0
      OR (operation.work_id IS NOT NULL AND operation.work_id <= 0)
      OR (operation.work_id IS NULL AND operation.voice_actor_id IS NULL)
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_operations) AS operation(
      actor_id bigint,
      work_id bigint,
      voice_actor_id bigint
    )
    GROUP BY operation.actor_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Each assignment operation must identify one actor and an existing work or a new voice actor'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_operations) AS operation(
      actor_id bigint,
      work_id bigint,
      voice_actor_id bigint
    )
    LEFT JOIN public.voice_actors AS voice_actor
      ON voice_actor.id = operation.voice_actor_id
    WHERE operation.voice_actor_id IS NOT NULL
      AND voice_actor.id IS NULL
  ) THEN
    RAISE EXCEPTION 'A selected voice actor does not exist'
      USING ERRCODE = '23503';
  END IF;

  -- The unique media+region key makes creation race safe. A conflict leaves
  -- the existing project's status untouched; a new project starts validated.
  INSERT INTO public.dubbing_projects(content_id, content_type, language, status)
  VALUES (p_content_id, p_content_type, p_dubbing_language, 'validated')
  ON CONFLICT (content_id, content_type, language) DO NOTHING
  RETURNING id INTO v_project_id;

  IF v_project_id IS NULL THEN
    SELECT project.id INTO v_project_id
    FROM public.dubbing_projects AS project
    WHERE project.content_id = p_content_id
      AND project.content_type = p_content_type
      AND project.language = p_dubbing_language
    FOR UPDATE;
  END IF;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Unable to lock the regional dubbing project';
  END IF;

  FOR v_operation IN
    SELECT operation.actor_id, operation.work_id, operation.voice_actor_id
    FROM jsonb_to_recordset(p_operations) AS operation(
      actor_id bigint,
      work_id bigint,
      voice_actor_id bigint
    )
  LOOP
    SELECT coalesce(array_agg(locked_work.id ORDER BY locked_work.id), ARRAY[]::bigint[])
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
        status
      ) VALUES (
        v_project_id,
        v_operation.actor_id,
        v_operation.voice_actor_id,
        'voice',
        'validated'
      );
      CONTINUE;
    END IF;

    IF v_work_count <> 1 OR v_work_ids[1] IS DISTINCT FROM v_operation.work_id THEN
      RAISE EXCEPTION 'Work % is stale or does not belong to actor % in this regional project',
        v_operation.work_id, v_operation.actor_id
        USING ERRCODE = '40001';
    END IF;

    IF v_operation.voice_actor_id IS NULL THEN
      DELETE FROM public.work
      WHERE id = v_operation.work_id
        AND dubbing_project_id = v_project_id
        AND actor_id = v_operation.actor_id;
    ELSE
      UPDATE public.work
      SET voice_actor_id = v_operation.voice_actor_id
      WHERE id = v_operation.work_id
        AND dubbing_project_id = v_project_id
        AND actor_id = v_operation.actor_id;
    END IF;

    GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
    IF v_affected_rows <> 1 THEN
      RAISE EXCEPTION 'Work % changed while the assignment was being saved', v_operation.work_id
        USING ERRCODE = '40001';
    END IF;
  END LOOP;

  RETURN v_project_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_regional_project_actor_assignments(bigint, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_regional_project_actor_assignments(bigint, text, text, jsonb)
  TO service_role;
