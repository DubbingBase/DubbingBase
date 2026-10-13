-- Use the same role identity for duplicate scans, write protection, and merges.
-- A real character ID is authoritative; otherwise a trimmed, lowercased
-- non-empty name identifies the role. Trim semantics match JavaScript String.trim.
-- Rows without either value remain intentionally ambiguous.
CREATE OR REPLACE FUNCTION public.work_role_identity_key(
  p_character_id bigint,
  p_character_name text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  WITH normalized AS (
    SELECT pg_catalog.lower(pg_catalog.btrim(
      p_character_name,
      pg_catalog.chr(9) || pg_catalog.chr(10) || pg_catalog.chr(11) ||
      pg_catalog.chr(12) || pg_catalog.chr(13) || pg_catalog.chr(32) ||
      pg_catalog.chr(160) || pg_catalog.chr(5760) ||
      pg_catalog.chr(8192) || pg_catalog.chr(8193) || pg_catalog.chr(8194) ||
      pg_catalog.chr(8195) || pg_catalog.chr(8196) || pg_catalog.chr(8197) ||
      pg_catalog.chr(8198) || pg_catalog.chr(8199) || pg_catalog.chr(8200) ||
      pg_catalog.chr(8201) || pg_catalog.chr(8202) || pg_catalog.chr(8232) ||
      pg_catalog.chr(8233) || pg_catalog.chr(8239) || pg_catalog.chr(8287) ||
      pg_catalog.chr(12288) || pg_catalog.chr(65279)
    )) AS name
  )
  SELECT CASE
    WHEN p_character_id IS NOT NULL THEN 'id:' || p_character_id::text
    WHEN NULLIF(normalized.name, '') IS NOT NULL THEN 'name:' || normalized.name
    ELSE NULL
  END
  FROM normalized;
$$;

CREATE OR REPLACE FUNCTION public.prevent_duplicate_work_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_new_role_key text;
  v_old_role_key text;
  v_new_lock_key bigint;
  v_old_lock_key bigint;
BEGIN
  v_new_role_key := public.work_role_identity_key(NEW.character_id, NEW.character_name);

  IF TG_OP = 'UPDATE' THEN
    v_old_role_key := public.work_role_identity_key(OLD.character_id, OLD.character_name);
    IF ROW(NEW.dubbing_project_id, NEW.actor_id, NEW.voice_actor_id, v_new_role_key)
       IS NOT DISTINCT FROM
       ROW(OLD.dubbing_project_id, OLD.actor_id, OLD.voice_actor_id, v_old_role_key) THEN
      RETURN NEW;
    END IF;

    IF v_old_role_key IS NOT NULL THEN
      v_old_lock_key := pg_catalog.hashtextextended(
        pg_catalog.jsonb_build_array(OLD.dubbing_project_id, OLD.actor_id, OLD.voice_actor_id, v_old_role_key)::text,
        0
      );
    END IF;
  END IF;

  IF v_new_role_key IS NOT NULL THEN
    v_new_lock_key := pg_catalog.hashtextextended(
      pg_catalog.jsonb_build_array(NEW.dubbing_project_id, NEW.actor_id, NEW.voice_actor_id, v_new_role_key)::text,
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

  -- An absent role is not a known identity, so do not block or auto-merge it.
  IF v_new_role_key IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.work AS existing
    WHERE existing.dubbing_project_id IS NOT DISTINCT FROM NEW.dubbing_project_id
      AND existing.actor_id IS NOT DISTINCT FROM NEW.actor_id
      AND existing.voice_actor_id IS NOT DISTINCT FROM NEW.voice_actor_id
      AND public.work_role_identity_key(existing.character_id, existing.character_name) = v_new_role_key
      AND (TG_OP <> 'UPDATE' OR existing.id <> OLD.id)
  ) THEN
    RAISE EXCEPTION 'duplicate work assignment already exists'
      USING ERRCODE = '23505', CONSTRAINT = 'work_unique_assignment_role_aware';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_duplicate_work_assignment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.work_role_identity_key(bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.work_role_identity_key(bigint, text) TO service_role;

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
    AND public.work_role_identity_key(p_character_id, p_character_name) IS NOT NULL
    AND public.work_role_identity_key(work.character_id, work.character_name)
      = public.work_role_identity_key(p_character_id, p_character_name);
$$;

REVOKE ALL ON FUNCTION public.find_work_role_identity_matches(bigint[], bigint, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_work_role_identity_matches(bigint[], bigint, text)
  TO service_role;

DROP TRIGGER IF EXISTS prevent_duplicate_work_assignment_trigger ON public.work;
CREATE TRIGGER prevent_duplicate_work_assignment_trigger
BEFORE INSERT OR UPDATE OF dubbing_project_id, actor_id, character_id, character_name, voice_actor_id
ON public.work
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_work_assignment();

-- Keep work_unique_assignment in place. It still protects ID-based identities;
-- the trigger handles normalized free-text roles and NULL-safe tuples.
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
      public.work_role_identity_key(w.character_id, w.character_name) AS role_key,
      min(w.character_id) AS character_id,
      min(w.id) AS group_id,
      count(*) AS group_size
    FROM public.work AS w
    WHERE public.work_role_identity_key(w.character_id, w.character_name) IS NOT NULL
    GROUP BY w.dubbing_project_id, w.actor_id, w.voice_actor_id,
      public.work_role_identity_key(w.character_id, w.character_name)
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
      AND public.work_role_identity_key(w.character_id, w.character_name) = g.role_key
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
  v_role_key := public.work_role_identity_key(v_identity.character_id, v_identity.character_name);
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
    AND public.work_role_identity_key(character_id, character_name) = v_role_key;
  IF v_actual_ids IS DISTINCT FROM v_supplied_ids THEN
    RAISE EXCEPTION 'duplicate group changed' USING ERRCODE = '40001';
  END IF;

  IF p_updates ? 'character_name' AND v_identity.character_id IS NULL
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

REVOKE ALL ON FUNCTION public.find_duplicate_work_groups(bigint, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_duplicate_work_groups(bigint, integer) TO service_role;
REVOKE ALL ON FUNCTION public.merge_work_duplicates_atomic(bigint, bigint[], jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_work_duplicates_atomic(bigint, bigint[], jsonb, uuid) TO service_role;

-- Match extracted credits by the same role identity used by scans and guards.
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

REVOKE ALL ON FUNCTION public.apply_extracted_credits(bigint, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_extracted_credits(bigint, text, text, jsonb)
  TO service_role;


-- Voice actor consolidation must use the same identity and preserve vote winners.
CREATE OR REPLACE FUNCTION public.merge_voice_actor_duplicates_atomic(
  p_keep_id integer,
  p_other_ids integer[],
  p_updates jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
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
        public.work_role_identity_key(character_id, character_name)
      ORDER BY (voice_actor_id = p_keep_id) DESC, id
    ) AS keeper_id
    FROM public.work
    WHERE (voice_actor_id = p_keep_id OR voice_actor_id = ANY(v_other_ids))
      AND public.work_role_identity_key(character_id, character_name) IS NOT NULL
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
        public.work_role_identity_key(character_id, character_name)
      ORDER BY (voice_actor_id = p_keep_id) DESC, id
    ) AS keeper_id
    FROM public.work
    WHERE (voice_actor_id = p_keep_id OR voice_actor_id = ANY(v_other_ids))
      AND public.work_role_identity_key(character_id, character_name) IS NOT NULL
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
        public.work_role_identity_key(character_id, character_name)
      ORDER BY (voice_actor_id = p_keep_id) DESC, id
    ) AS keeper_id
    FROM public.work
    WHERE (voice_actor_id = p_keep_id OR voice_actor_id = ANY(v_other_ids))
      AND public.work_role_identity_key(character_id, character_name) IS NOT NULL
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
$$;
REVOKE ALL ON FUNCTION public.merge_voice_actor_duplicates_atomic(integer, integer[], jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_voice_actor_duplicates_atomic(integer, integer[], jsonb)
  TO service_role;

NOTIFY pgrst, 'reload schema';
