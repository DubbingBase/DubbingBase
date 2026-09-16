CREATE OR REPLACE FUNCTION public.find_duplicate_voice_actors_rpc()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
WITH RECURSIVE duplicate_pairs AS (
  SELECT
    a.id AS id1,
    b.id AS id2
  FROM public.voice_actors a
  JOIN public.voice_actors b
    ON a.id < b.id
    AND a.duplicate_first_name_tokens && b.duplicate_first_name_tokens
    AND a.duplicate_last_name_tokens && b.duplicate_last_name_tokens
    AND (
      (
        a.duplicate_first_name_tokens <@ b.duplicate_first_name_tokens
        AND a.duplicate_last_name_tokens <@ b.duplicate_last_name_tokens
      )
      OR (
        b.duplicate_first_name_tokens <@ a.duplicate_first_name_tokens
        AND b.duplicate_last_name_tokens <@ a.duplicate_last_name_tokens
      )
    )
),
edges AS (
  SELECT id1 AS actor_id, id2 AS neighbor_id FROM duplicate_pairs
  UNION ALL
  SELECT id2 AS actor_id, id1 AS neighbor_id FROM duplicate_pairs
),
vertices AS (
  SELECT id1 AS actor_id FROM duplicate_pairs
  UNION
  SELECT id2 AS actor_id FROM duplicate_pairs
),
reachability(component_id, actor_id) AS (
  SELECT actor_id, actor_id FROM vertices
  UNION
  SELECT r.component_id, e.neighbor_id
  FROM reachability r
  JOIN edges e ON e.actor_id = r.actor_id
),
components AS (
  SELECT actor_id, min(component_id) AS component_id
  FROM reachability
  GROUP BY actor_id
),
grouped AS (
  SELECT component_id, array_agg(actor_id ORDER BY actor_id) AS actor_ids
  FROM components
  GROUP BY component_id
)
SELECT COALESCE(
  json_agg(
    json_build_object(
      'actors', (
        SELECT json_agg(
          json_build_object(
            'id', v.id,
            'firstname', v.firstname,
            'lastname', v.lastname,
            'bio', v.bio,
            'nationality', v.nationality,
            'date_of_birth', v.date_of_birth,
            'tmdb_id', v.tmdb_id,
            'wikidata_id', v.wikidata_id,
            'profile_picture', v.profile_picture
          )
          ORDER BY v.id
        )
        FROM public.voice_actors v
        WHERE v.id = ANY (g.actor_ids)
      )
    )
    ORDER BY g.component_id
  ),
  '[]'::json
)
FROM grouped g;
$$;

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

  DELETE FROM public.work w1
  WHERE w1.voice_actor_id = ANY(v_other_ids)
    AND EXISTS (
      SELECT 1
      FROM public.work w2
      WHERE w2.voice_actor_id = p_keep_id
        AND w1.dubbing_project_id IS NOT DISTINCT FROM w2.dubbing_project_id
        AND w1.actor_id IS NOT DISTINCT FROM w2.actor_id
        AND w1.character_id IS NOT DISTINCT FROM w2.character_id
    );

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

DROP FUNCTION IF EXISTS public.merge_voice_actors(integer, integer[]);

REVOKE EXECUTE ON FUNCTION public.merge_voice_actor_duplicates_atomic(integer, integer[], jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_voice_actor_duplicates_atomic(integer, integer[], jsonb) TO service_role;
