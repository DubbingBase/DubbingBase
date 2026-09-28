CREATE OR REPLACE FUNCTION public.replace_regional_project_actor_assignments(
  p_dubbing_project_id bigint,
  p_actor_ids bigint[],
  p_assignments jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF p_dubbing_project_id IS NULL THEN
    RAISE EXCEPTION 'A dubbing project is required';
  END IF;
  IF p_actor_ids IS NULL OR array_position(p_actor_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Selected actor IDs must be provided';
  END IF;
  IF jsonb_typeof(p_assignments) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Assignments must be a JSON array';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_assignments) AS assignment(actor_id bigint, voice_actor_id bigint)
    WHERE assignment.actor_id IS NULL
      OR assignment.voice_actor_id IS NULL
      OR NOT (assignment.actor_id = ANY(p_actor_ids))
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_assignments) AS assignment(actor_id bigint, voice_actor_id bigint)
    GROUP BY assignment.actor_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Assignments must contain one valid voice actor per selected actor';
  END IF;

  PERFORM 1
  FROM public.dubbing_projects
  WHERE id = p_dubbing_project_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dubbing project % does not exist', p_dubbing_project_id;
  END IF;

  DELETE FROM public.work
  WHERE dubbing_project_id = p_dubbing_project_id
    AND actor_id = ANY(p_actor_ids);

  INSERT INTO public.work(
    dubbing_project_id,
    actor_id,
    voice_actor_id,
    performance,
    status
  )
  SELECT
    p_dubbing_project_id,
    assignment.actor_id,
    assignment.voice_actor_id,
    'voice',
    'validated'
  FROM jsonb_to_recordset(p_assignments) AS assignment(actor_id bigint, voice_actor_id bigint);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.replace_regional_project_actor_assignments(bigint, bigint[], jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_regional_project_actor_assignments(bigint, bigint[], jsonb)
  TO service_role;
