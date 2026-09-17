-- Duplicate work review and merge support.
-- Existing rows remain untouched; administrators resolve them through the review UI.

CREATE OR REPLACE FUNCTION public.prevent_duplicate_work_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_new_key bigint;
  v_old_key bigint;
BEGIN
  IF TG_OP = 'UPDATE'
     AND ROW(NEW.dubbing_project_id, NEW.actor_id, NEW.character_id, NEW.voice_actor_id)
         IS NOT DISTINCT FROM
         ROW(OLD.dubbing_project_id, OLD.actor_id, OLD.character_id, OLD.voice_actor_id) THEN
    RETURN NEW;
  END IF;

  v_new_key := pg_catalog.hashtextextended(
    pg_catalog.jsonb_build_array(NEW.dubbing_project_id, NEW.actor_id, NEW.character_id, NEW.voice_actor_id)::text,
    0
  );

  IF TG_OP = 'UPDATE' THEN
    v_old_key := pg_catalog.hashtextextended(
      pg_catalog.jsonb_build_array(OLD.dubbing_project_id, OLD.actor_id, OLD.character_id, OLD.voice_actor_id)::text,
      0
    );
    PERFORM pg_catalog.pg_advisory_xact_lock(LEAST(v_old_key, v_new_key));
    IF v_old_key <> v_new_key THEN
      PERFORM pg_catalog.pg_advisory_xact_lock(GREATEST(v_old_key, v_new_key));
    END IF;
  ELSE
    PERFORM pg_catalog.pg_advisory_xact_lock(v_new_key);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.work AS existing
    WHERE existing.dubbing_project_id IS NOT DISTINCT FROM NEW.dubbing_project_id
      AND existing.actor_id IS NOT DISTINCT FROM NEW.actor_id
      AND existing.character_id IS NOT DISTINCT FROM NEW.character_id
      AND existing.voice_actor_id IS NOT DISTINCT FROM NEW.voice_actor_id
      AND CASE WHEN TG_OP = 'UPDATE' THEN existing.id <> OLD.id ELSE true END
  ) THEN
    RAISE EXCEPTION 'duplicate work assignment already exists'
      USING ERRCODE = '23505', CONSTRAINT = 'work_unique_assignment_null_safe';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_duplicate_work_assignment() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS prevent_duplicate_work_assignment_trigger ON public.work;
CREATE TRIGGER prevent_duplicate_work_assignment_trigger
BEFORE INSERT OR UPDATE OF dubbing_project_id, actor_id, character_id, voice_actor_id
ON public.work
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_work_assignment();

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
      w.character_id,
      w.voice_actor_id,
      min(w.id) AS group_id,
      count(*) AS group_size
    FROM public.work AS w
    GROUP BY w.dubbing_project_id, w.actor_id, w.character_id, w.voice_actor_id
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
      ON w.dubbing_project_id = g.dubbing_project_id
      AND w.actor_id IS NOT DISTINCT FROM g.actor_id
      AND w.character_id IS NOT DISTINCT FROM g.character_id
      AND w.voice_actor_id IS NOT DISTINCT FROM g.voice_actor_id
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
    GROUP BY g.dubbing_project_id, g.actor_id, g.character_id, g.voice_actor_id,
      g.group_id, g.group_size, dp.id, dp.content_id, dp.content_type, dp.language
    ORDER BY g.group_id
  ),
  limited AS (
    SELECT * FROM page_items ORDER BY group_id LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100)
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
          'voiceActorId', voice_actor_id
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
  v_supplied_ids bigint[];
  v_actual_ids bigint[];
  v_vote_count integer;
  v_collapsed_vote_count integer;
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

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    pg_catalog.jsonb_build_array(v_identity.dubbing_project_id, v_identity.actor_id, v_identity.character_id, v_identity.voice_actor_id)::text,
    0
  ));

  PERFORM 1 FROM public.work
  WHERE id = ANY(v_supplied_ids)
  ORDER BY id
  FOR UPDATE;

  SELECT array_agg(id ORDER BY id) INTO v_actual_ids
  FROM public.work
  WHERE dubbing_project_id = v_identity.dubbing_project_id
    AND actor_id IS NOT DISTINCT FROM v_identity.actor_id
    AND character_id IS NOT DISTINCT FROM v_identity.character_id
    AND voice_actor_id IS NOT DISTINCT FROM v_identity.voice_actor_id;

  IF v_actual_ids IS DISTINCT FROM v_supplied_ids THEN
    RAISE EXCEPTION 'duplicate group changed' USING ERRCODE = '40001';
  END IF;

  IF p_updates ? 'source_id' AND NULLIF(p_updates->>'source_id', '') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.source WHERE id = (p_updates->>'source_id')::bigint) THEN
    RAISE EXCEPTION 'source not found' USING ERRCODE = '22023';
  END IF;

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
  SET
    performance = CASE WHEN p_updates ? 'performance' THEN p_updates->>'performance' ELSE performance END,
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
    to_jsonb(v_identity), p_admin_id
  );

  RETURN jsonb_build_object(
    'canonicalId', p_canonical_id,
    'mergedIds', to_jsonb(array_remove(v_actual_ids, p_canonical_id)),
    'preservedVotes', v_vote_count - v_collapsed_vote_count,
    'collapsedVotes', v_collapsed_vote_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.find_duplicate_work_groups(bigint, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_duplicate_work_groups(bigint, integer) TO service_role;
REVOKE ALL ON FUNCTION public.merge_work_duplicates_atomic(bigint, bigint[], jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_work_duplicates_atomic(bigint, bigint[], jsonb, uuid) TO service_role;
