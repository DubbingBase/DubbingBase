-- Save voice-cast edits only when the assignment still matches the value the
-- admin originally loaded, and expose queue requesters from their payloads.

CREATE OR REPLACE FUNCTION public.save_regional_project_actor_assignments(
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
  v_current_work public.work%ROWTYPE;
BEGIN
  IF p_content_id IS NULL
    OR p_content_type IS NULL
    OR p_content_type NOT IN ('movie', 'tv', 'video_game', 'audiobook', 'podcast', 'advertisement', 'toy')
    OR p_dubbing_language IS NULL
    OR NOT public.is_valid_dubbing_language(p_dubbing_language) THEN
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
    FROM jsonb_array_elements(p_operations) AS item(value)
    WHERE NOT (item.value ? 'expected_voice_actor_id')
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_operations) AS operation(
      actor_id bigint,
      work_id bigint,
      expected_voice_actor_id bigint,
      voice_actor_id bigint
    )
    WHERE operation.actor_id IS NULL
      OR operation.actor_id <= 0
      OR (operation.work_id IS NOT NULL AND operation.work_id <= 0)
      OR (operation.expected_voice_actor_id IS NOT NULL AND operation.expected_voice_actor_id <= 0)
      OR (operation.voice_actor_id IS NOT NULL AND operation.voice_actor_id <= 0)
      OR (operation.work_id IS NULL AND operation.voice_actor_id IS NULL)
      OR (operation.work_id IS NULL AND operation.expected_voice_actor_id IS NOT NULL)
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_operations) AS operation(
      actor_id bigint,
      work_id bigint,
      expected_voice_actor_id bigint,
      voice_actor_id bigint
    )
    GROUP BY operation.actor_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Each assignment operation must identify one actor and its expected assignment state'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_operations) AS operation(
      actor_id bigint,
      work_id bigint,
      expected_voice_actor_id bigint,
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
    SELECT operation.actor_id,
           operation.work_id,
           operation.expected_voice_actor_id,
           operation.voice_actor_id
    FROM jsonb_to_recordset(p_operations) AS operation(
      actor_id bigint,
      work_id bigint,
      expected_voice_actor_id bigint,
      voice_actor_id bigint
    )
    ORDER BY operation.actor_id
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

    SELECT work.* INTO v_current_work
    FROM public.work AS work
    WHERE work.id = v_operation.work_id
      AND work.dubbing_project_id = v_project_id
      AND work.actor_id = v_operation.actor_id
    FOR UPDATE;

    IF NOT FOUND OR NOT (
      v_current_work.voice_actor_id IS NOT DISTINCT FROM v_operation.expected_voice_actor_id
    ) THEN
      RAISE EXCEPTION 'Assignment changed since it was loaded; reload before saving'
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

-- The output row shape changes, so replace the previous function signature.
DROP FUNCTION IF EXISTS public.get_media_queue_items(text, text, int, int);
CREATE FUNCTION public.get_media_queue_items(
  p_queue_name text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id bigint,
  queue_name text,
  tmdb_id bigint,
  media_type text,
  language text,
  wikipedia_language text,
  dubbing_language text,
  season_number int,
  episode_number int,
  status text,
  error_message text,
  created_at timestamptz,
  read_ct int,
  is_manual boolean,
  requested_by uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_status_filter text := lower(trim(coalesce(p_status, '')));
  v_include_active boolean;
  v_include_archive boolean;
BEGIN
  IF v_status_filter IN ('archived', 'completed', 'error', 'failed') THEN
    v_include_active := FALSE;
    v_include_archive := TRUE;
  ELSIF v_status_filter IN ('active', 'pending', 'processing') THEN
    v_include_active := TRUE;
    v_include_archive := FALSE;
  ELSE
    v_include_active := TRUE;
    v_include_archive := TRUE;
  END IF;

  RETURN QUERY
  WITH all_items AS (
    SELECT
      q.msg_id AS id,
      'wiki_extract'::text AS queue_name,
      (q.message->>'tmdb_id')::bigint AS tmdb_id,
      q.message->>'media_type' AS media_type,
      COALESCE(q.message->>'wikipedia_language',q.message->>'language') AS language,
      COALESCE(q.message->>'wikipedia_language',q.message->>'language') AS wikipedia_language,
      q.message->>'dubbing_language' AS dubbing_language,
      (q.message->>'season_number')::int AS season_number,
      (q.message->>'episode_number')::int AS episode_number,
      CASE WHEN q.vt > now() THEN 'processing' ELSE 'pending' END AS status,
      q.message->>'error_message' AS error_message,
      q.enqueued_at AS created_at,
      q.read_ct,
      COALESCE((q.message->>'is_manual')::boolean, false) AS is_manual,
      nullif(q.message->>'requested_by', '')::uuid AS requested_by
    FROM pgmq.q_wiki_extract q
    WHERE v_include_active = TRUE
      AND (p_queue_name IS NULL OR p_queue_name = 'wiki_extract')
      AND (
        v_status_filter = '' OR v_status_filter = 'all' OR v_status_filter = 'active'
        OR (v_status_filter = 'pending' AND q.vt <= now())
        OR (v_status_filter = 'processing' AND q.vt > now())
      )

    UNION ALL

    SELECT
      q.msg_id AS id,
      'wiki_check'::text AS queue_name,
      (q.message->>'tmdb_id')::bigint AS tmdb_id,
      q.message->>'media_type' AS media_type,
      COALESCE(q.message->>'wikipedia_language',q.message->>'language') AS language,
      COALESCE(q.message->>'wikipedia_language',q.message->>'language') AS wikipedia_language,
      q.message->>'dubbing_language' AS dubbing_language,
      (q.message->>'season_number')::int AS season_number,
      (q.message->>'episode_number')::int AS episode_number,
      CASE WHEN q.vt > now() THEN 'processing' ELSE 'pending' END AS status,
      q.message->>'error_message' AS error_message,
      q.enqueued_at AS created_at,
      q.read_ct,
      COALESCE((q.message->>'is_manual')::boolean, false) AS is_manual,
      nullif(q.message->>'requested_by', '')::uuid AS requested_by
    FROM pgmq.q_wiki_check q
    WHERE v_include_active = TRUE
      AND (p_queue_name IS NULL OR p_queue_name = 'wiki_check')
      AND (
        v_status_filter = '' OR v_status_filter = 'all' OR v_status_filter = 'active'
        OR (v_status_filter = 'pending' AND q.vt <= now())
        OR (v_status_filter = 'processing' AND q.vt > now())
      )

    UNION ALL

    SELECT
      q.msg_id AS id,
      'wiki_discovery'::text AS queue_name,
      (q.message->>'tmdb_id')::bigint AS tmdb_id,
      q.message->>'media_type' AS media_type,
      COALESCE(q.message->>'wikipedia_language',q.message->>'language') AS language,
      COALESCE(q.message->>'wikipedia_language',q.message->>'language') AS wikipedia_language,
      q.message->>'dubbing_language' AS dubbing_language,
      (q.message->>'season_number')::int AS season_number,
      (q.message->>'episode_number')::int AS episode_number,
      CASE WHEN q.vt > now() THEN 'processing' ELSE 'pending' END AS status,
      q.message->>'error_message' AS error_message,
      q.enqueued_at AS created_at,
      q.read_ct,
      COALESCE((q.message->>'is_manual')::boolean, false) AS is_manual,
      nullif(q.message->>'requested_by', '')::uuid AS requested_by
    FROM pgmq.q_wiki_discovery q
    WHERE v_include_active = TRUE
      AND (p_queue_name IS NULL OR p_queue_name = 'wiki_discovery')
      AND (
        v_status_filter = '' OR v_status_filter = 'all' OR v_status_filter = 'active'
        OR (v_status_filter = 'pending' AND q.vt <= now())
        OR (v_status_filter = 'processing' AND q.vt > now())
      )

    UNION ALL

    SELECT
      a.msg_id AS id,
      'wiki_extract'::text AS queue_name,
      (a.message->>'tmdb_id')::bigint AS tmdb_id,
      a.message->>'media_type' AS media_type,
      COALESCE(a.message->>'wikipedia_language',a.message->>'language') AS language,
      COALESCE(a.message->>'wikipedia_language',a.message->>'language') AS wikipedia_language,
      a.message->>'dubbing_language' AS dubbing_language,
      (a.message->>'season_number')::int AS season_number,
      (a.message->>'episode_number')::int AS episode_number,
      CASE WHEN (a.message->>'error_message') IS NOT NULL AND (a.message->>'error_message') != '' THEN 'failed' ELSE 'completed' END AS status,
      a.message->>'error_message' AS error_message,
      a.enqueued_at AS created_at,
      a.read_ct,
      COALESCE((a.message->>'is_manual')::boolean, false) AS is_manual,
      nullif(a.message->>'requested_by', '')::uuid AS requested_by
    FROM pgmq.a_wiki_extract a
    WHERE v_include_archive = TRUE
      AND (p_queue_name IS NULL OR p_queue_name = 'wiki_extract')
      AND (
        v_status_filter = '' OR v_status_filter = 'all' OR v_status_filter = 'archived'
        OR (v_status_filter IN ('failed', 'error') AND (a.message->>'error_message') IS NOT NULL AND (a.message->>'error_message') != '')
        OR (v_status_filter = 'completed' AND ((a.message->>'error_message') IS NULL OR (a.message->>'error_message') = ''))
      )

    UNION ALL

    SELECT
      a.msg_id AS id,
      'wiki_check'::text AS queue_name,
      (a.message->>'tmdb_id')::bigint AS tmdb_id,
      a.message->>'media_type' AS media_type,
      COALESCE(a.message->>'wikipedia_language',a.message->>'language') AS language,
      COALESCE(a.message->>'wikipedia_language',a.message->>'language') AS wikipedia_language,
      a.message->>'dubbing_language' AS dubbing_language,
      (a.message->>'season_number')::int AS season_number,
      (a.message->>'episode_number')::int AS episode_number,
      CASE WHEN (a.message->>'error_message') IS NOT NULL AND (a.message->>'error_message') != '' THEN 'failed' ELSE 'completed' END AS status,
      a.message->>'error_message' AS error_message,
      a.enqueued_at AS created_at,
      a.read_ct,
      COALESCE((a.message->>'is_manual')::boolean, false) AS is_manual,
      nullif(a.message->>'requested_by', '')::uuid AS requested_by
    FROM pgmq.a_wiki_check a
    WHERE v_include_archive = TRUE
      AND (p_queue_name IS NULL OR p_queue_name = 'wiki_check')
      AND (
        v_status_filter = '' OR v_status_filter = 'all' OR v_status_filter = 'archived'
        OR (v_status_filter IN ('failed', 'error') AND (a.message->>'error_message') IS NOT NULL AND (a.message->>'error_message') != '')
        OR (v_status_filter = 'completed' AND ((a.message->>'error_message') IS NULL OR (a.message->>'error_message') = ''))
      )

    UNION ALL

    SELECT
      a.msg_id AS id,
      'wiki_discovery'::text AS queue_name,
      (a.message->>'tmdb_id')::bigint AS tmdb_id,
      a.message->>'media_type' AS media_type,
      COALESCE(a.message->>'wikipedia_language',a.message->>'language') AS language,
      COALESCE(a.message->>'wikipedia_language',a.message->>'language') AS wikipedia_language,
      a.message->>'dubbing_language' AS dubbing_language,
      (a.message->>'season_number')::int AS season_number,
      (a.message->>'episode_number')::int AS episode_number,
      CASE WHEN (a.message->>'error_message') IS NOT NULL AND (a.message->>'error_message') != '' THEN 'failed' ELSE 'completed' END AS status,
      a.message->>'error_message' AS error_message,
      a.enqueued_at AS created_at,
      a.read_ct,
      COALESCE((a.message->>'is_manual')::boolean, false) AS is_manual,
      nullif(a.message->>'requested_by', '')::uuid AS requested_by
    FROM pgmq.a_wiki_discovery a
    WHERE v_include_archive = TRUE
      AND (p_queue_name IS NULL OR p_queue_name = 'wiki_discovery')
      AND (
        v_status_filter = '' OR v_status_filter = 'all' OR v_status_filter = 'archived'
        OR (v_status_filter IN ('failed', 'error') AND (a.message->>'error_message') IS NOT NULL AND (a.message->>'error_message') != '')
        OR (v_status_filter = 'completed' AND ((a.message->>'error_message') IS NULL OR (a.message->>'error_message') = ''))
      )
  )
  SELECT
    all_items.id,
    all_items.queue_name,
    all_items.tmdb_id,
    all_items.media_type,
    all_items.language,
    all_items.wikipedia_language,
    all_items.dubbing_language,
    all_items.season_number,
    all_items.episode_number,
    all_items.status,
    all_items.error_message,
    all_items.created_at,
    all_items.read_ct,
    all_items.is_manual,
    all_items.requested_by
  FROM all_items
  ORDER BY
    CASE
      WHEN v_status_filter IN ('archived', 'completed', 'error', 'failed') THEN 0
      WHEN all_items.status = 'pending' AND all_items.is_manual = TRUE THEN 1
      WHEN all_items.status = 'processing' THEN 2
      WHEN all_items.status = 'pending' THEN 3
      ELSE 4
    END ASC,
    all_items.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_media_queue_items(text, text, int, int)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_media_queue_items(text, text, int, int)
  TO authenticated, anon, service_role;

DROP FUNCTION IF EXISTS public.get_regional_review_queue_items(int);
CREATE FUNCTION public.get_regional_review_queue_items(
  p_limit int DEFAULT 100
)
RETURNS TABLE (
  id bigint,
  queue_name text,
  tmdb_id bigint,
  media_type text,
  wikipedia_language text,
  dubbing_language text,
  season_number int,
  episode_number int,
  status text,
  error_message text,
  created_at timestamptz,
  read_ct int,
  is_manual boolean,
  review_note text,
  requested_by uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    a.msg_id,
    'wiki_check'::text,
    (a.message->>'tmdb_id')::bigint,
    a.message->>'media_type',
    COALESCE(a.message->>'wikipedia_language', a.message->>'language'),
    a.message->>'dubbing_language',
    nullif(a.message->>'season_number', '')::int,
    nullif(a.message->>'episode_number', '')::int,
    'review_needed'::text,
    nullif(a.message->>'error_message', ''),
    a.enqueued_at,
    a.read_ct,
    COALESCE((a.message->>'is_manual')::boolean, false),
    a.message->>'review_note',
    nullif(a.message->>'requested_by', '')::uuid
  FROM pgmq.a_wiki_check AS a
  WHERE a.message->>'review_needed' = 'true'
  ORDER BY a.enqueued_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 500));
$$;

REVOKE EXECUTE ON FUNCTION public.get_regional_review_queue_items(int)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_regional_review_queue_items(int)
  TO authenticated, service_role;
