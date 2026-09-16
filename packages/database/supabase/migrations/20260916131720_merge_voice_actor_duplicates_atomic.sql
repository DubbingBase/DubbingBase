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
  );

  IF cardinality(v_other_ids) IS NULL OR cardinality(v_other_ids) = 0 THEN
    RAISE EXCEPTION 'No duplicate IDs to merge';
  END IF;

  PERFORM 1 FROM public.voice_actors WHERE id = p_keep_id FOR UPDATE;
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
    (array_agg(bio) FILTER (WHERE bio IS NOT NULL))[1],
    (array_agg(nationality) FILTER (WHERE nationality IS NOT NULL))[1],
    (array_agg(date_of_birth) FILTER (WHERE date_of_birth IS NOT NULL))[1],
    (array_agg(tmdb_id) FILTER (WHERE tmdb_id IS NOT NULL))[1],
    (array_agg(wikidata_id) FILTER (WHERE wikidata_id IS NOT NULL))[1],
    (array_agg(awards) FILTER (WHERE awards IS NOT NULL))[1],
    (array_agg(years_active) FILTER (WHERE years_active IS NOT NULL))[1],
    (array_agg(social_media_links) FILTER (WHERE social_media_links IS NOT NULL))[1],
    (array_agg(profile_picture) FILTER (WHERE profile_picture IS NOT NULL))[1]
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
    );

  UPDATE public.work
  SET voice_actor_id = p_keep_id
  WHERE voice_actor_id = ANY(v_other_ids);

  DELETE FROM public.voice_actors
  WHERE id = ANY(v_other_ids);

  UPDATE public.voice_actors
  SET
    firstname = CASE WHEN p_updates ? 'firstname' THEN p_updates->>'firstname' ELSE firstname END,
    lastname = CASE WHEN p_updates ? 'lastname' THEN p_updates->>'lastname' ELSE lastname END,
    bio = CASE WHEN p_updates ? 'bio' THEN p_updates->>'bio' ELSE COALESCE(bio, v_bio) END,
    nationality = CASE WHEN p_updates ? 'nationality' THEN p_updates->>'nationality' ELSE COALESCE(nationality, v_nationality) END,
    date_of_birth = CASE WHEN p_updates ? 'date_of_birth' THEN NULLIF(p_updates->>'date_of_birth', '')::date ELSE COALESCE(date_of_birth, v_date_of_birth) END,
    tmdb_id = CASE WHEN p_updates ? 'tmdb_id' THEN NULLIF(p_updates->>'tmdb_id', '')::integer ELSE COALESCE(tmdb_id, v_tmdb_id) END,
    wikidata_id = CASE WHEN p_updates ? 'wikidata_id' THEN p_updates->>'wikidata_id' ELSE COALESCE(wikidata_id, v_wikidata_id) END,
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

REVOKE EXECUTE ON FUNCTION public.merge_voice_actors(integer, integer[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.merge_voice_actor_duplicates_atomic(integer, integer[], jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_voice_actor_duplicates_atomic(integer, integer[], jsonb) TO service_role;
