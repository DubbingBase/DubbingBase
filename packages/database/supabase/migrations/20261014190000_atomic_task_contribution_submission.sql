CREATE OR REPLACE FUNCTION public.submit_gamification_task_contribution(
  p_claim_id UUID,
  p_user_id UUID,
  p_updates JSONB,
  p_is_admin BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(status TEXT, points_awarded INTEGER)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_claim public.gamification_task_locks%ROWTYPE;
  v_actor public.voice_actors%ROWTYPE;
  v_studio public.studios%ROWTYPE;
  v_actor_json JSONB;
  v_studio_json JSONB;
  v_social_updates JSONB;
  v_merged_social JSONB;
  v_previous JSONB := '{}'::JSONB;
  v_new JSONB := '{}'::JSONB;
  v_key TEXT;
  v_social_key TEXT;
  v_value TEXT;
  v_action TEXT := '';
  v_entity_type TEXT;
  v_points INTEGER := 0;
  v_released_claim_id UUID;
BEGIN
  IF p_claim_id IS NULL OR p_user_id IS NULL THEN
    RETURN QUERY SELECT 'invalid_claim'::TEXT, 0;
    RETURN;
  END IF;

  SELECT * INTO v_claim
  FROM public.gamification_task_locks AS task_claim
  WHERE task_claim.claim_id = p_claim_id
  FOR UPDATE;

  IF NOT FOUND
    OR v_claim.user_id IS DISTINCT FROM p_user_id
    OR v_claim.expires_at <= clock_timestamp()
    OR v_claim.consumed_at IS NOT NULL THEN
    RETURN QUERY SELECT 'invalid_claim'::TEXT, 0;
    RETURN;
  END IF;

  IF jsonb_typeof(p_updates) IS DISTINCT FROM 'object'
    OR p_updates = '{}'::JSONB THEN
    RETURN QUERY SELECT 'stale_task'::TEXT, 0;
    RETURN;
  END IF;

  IF v_claim.category = 'enrich_voice_actor' THEN
    IF v_claim.entity_id !~ '^[1-9][0-9]*$' THEN
      RETURN QUERY SELECT 'stale_task'::TEXT, 0;
      RETURN;
    END IF;

    SELECT * INTO v_actor
    FROM public.voice_actors AS actor
    WHERE actor.id = v_claim.entity_id::BIGINT
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN QUERY SELECT 'stale_task'::TEXT, 0;
      RETURN;
    END IF;

    v_actor_json := to_jsonb(v_actor);
    FOR v_key IN SELECT jsonb_object_keys(p_updates)
    LOOP
      IF v_key NOT IN (
        'profile_picture', 'nationality', 'date_of_birth', 'bio',
        'tmdb_id', 'wikidata_id', 'social_media_links'
      ) THEN
        RETURN QUERY SELECT 'stale_task'::TEXT, 0;
        RETURN;
      END IF;

      IF v_key = 'social_media_links' THEN
        v_social_updates := p_updates -> v_key;
        IF jsonb_typeof(v_social_updates) IS DISTINCT FROM 'object'
          OR v_social_updates = '{}'::JSONB
          OR (v_actor.social_media_links IS NOT NULL
            AND jsonb_typeof(v_actor.social_media_links) IS DISTINCT FROM 'object') THEN
          RETURN QUERY SELECT 'stale_task'::TEXT, 0;
          RETURN;
        END IF;

        FOR v_social_key IN SELECT jsonb_object_keys(v_social_updates)
        LOOP
          v_value := v_social_updates ->> v_social_key;
          IF v_social_key NOT IN ('twitter', 'instagram', 'tiktok', 'facebook')
            OR jsonb_typeof(v_social_updates -> v_social_key) IS DISTINCT FROM 'string'
            OR btrim(v_value) = '' OR length(v_value) > 2048 THEN
            RETURN QUERY SELECT 'stale_task'::TEXT, 0;
            RETURN;
          END IF;
          IF NULLIF(v_actor.social_media_links ->> v_social_key, '') IS NOT NULL THEN
            RETURN QUERY SELECT 'stale_task'::TEXT, 0;
            RETURN;
          END IF;
        END LOOP;

        v_merged_social := COALESCE(v_actor.social_media_links, '{}'::JSONB) || v_social_updates;
        v_previous := v_previous || jsonb_build_object('social_media_links', v_actor.social_media_links);
        v_new := v_new || jsonb_build_object('social_media_links', v_merged_social);
        v_points := v_points + 5;
        v_action := concat_ws(' ', NULLIF(v_action, ''), 'added_social_links');
      ELSE
        IF (v_actor_json -> v_key) IS NOT NULL
          AND (v_actor_json -> v_key) <> 'null'::JSONB
          AND (v_actor_json -> v_key) <> '""'::JSONB THEN
          IF v_key = 'profile_picture' AND p_is_admin IS TRUE THEN
            NULL;
          ELSIF v_key = 'profile_picture' THEN
            RETURN QUERY SELECT 'forbidden'::TEXT, 0;
            RETURN;
          ELSE
            RETURN QUERY SELECT 'stale_task'::TEXT, 0;
            RETURN;
          END IF;
        END IF;

        v_value := p_updates ->> v_key;
        IF v_key IN ('profile_picture', 'nationality', 'date_of_birth', 'bio', 'wikidata_id')
          AND (jsonb_typeof(p_updates -> v_key) IS DISTINCT FROM 'string'
            OR btrim(v_value) = '' OR length(v_value) > 10000) THEN
          RETURN QUERY SELECT 'stale_task'::TEXT, 0;
          RETURN;
        END IF;

        IF v_key = 'profile_picture'
          AND v_value !~ ('^' || v_claim.entity_id || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|png|webp)$') THEN
          RETURN QUERY SELECT 'stale_task'::TEXT, 0;
          RETURN;
        END IF;

        IF v_key = 'date_of_birth' THEN
          IF v_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
            RETURN QUERY SELECT 'stale_task'::TEXT, 0;
            RETURN;
          END IF;
          BEGIN
            IF to_char(v_value::DATE, 'YYYY-MM-DD') <> v_value THEN
              RETURN QUERY SELECT 'stale_task'::TEXT, 0;
              RETURN;
            END IF;
          EXCEPTION WHEN OTHERS THEN
            RETURN QUERY SELECT 'stale_task'::TEXT, 0;
            RETURN;
          END;
        END IF;

        IF v_key = 'tmdb_id' THEN
          IF jsonb_typeof(p_updates -> v_key) IS DISTINCT FROM 'number'
            OR v_value !~ '^[1-9][0-9]*$'
            OR v_value::NUMERIC > 9007199254740991 THEN
            RETURN QUERY SELECT 'stale_task'::TEXT, 0;
            RETURN;
          END IF;
        END IF;

        IF v_key = 'wikidata_id' AND v_value !~ '^Q[1-9][0-9]*$' THEN
          RETURN QUERY SELECT 'stale_task'::TEXT, 0;
          RETURN;
        END IF;

        v_previous := v_previous || jsonb_build_object(v_key, v_actor_json -> v_key);
        v_new := v_new || jsonb_build_object(v_key, p_updates -> v_key);
        CASE v_key
          WHEN 'profile_picture' THEN
            v_points := v_points + 10;
            v_action := concat_ws(' ', NULLIF(v_action, ''), 'added_profile_picture');
          WHEN 'nationality' THEN
            v_points := v_points + 5;
            v_action := concat_ws(' ', NULLIF(v_action, ''), 'added_nationality');
          WHEN 'date_of_birth' THEN
            v_points := v_points + 5;
            v_action := concat_ws(' ', NULLIF(v_action, ''), 'added_dob');
          WHEN 'bio' THEN
            v_points := v_points + 10;
            v_action := concat_ws(' ', NULLIF(v_action, ''), 'added_bio');
          WHEN 'tmdb_id' THEN
            v_points := v_points + 5;
            v_action := concat_ws(' ', NULLIF(v_action, ''), 'added_tmdb_id');
          WHEN 'wikidata_id' THEN
            v_points := v_points + 5;
            v_action := concat_ws(' ', NULLIF(v_action, ''), 'added_wikidata_id');
        END CASE;
      END IF;
    END LOOP;

    PERFORM 1
    FROM public.consume_gamification_task_claim(p_claim_id, p_user_id);
    IF NOT FOUND THEN
      RETURN QUERY SELECT 'invalid_claim'::TEXT, 0;
      RETURN;
    END IF;

    -- The existing voice_actors update trigger derives updated_by from auth.uid().
    -- This RPC runs as service_role, so set the verified contributor for this transaction.
    PERFORM set_config('request.jwt.claim.sub', p_user_id::TEXT, TRUE);

    UPDATE public.voice_actors AS actor
    SET profile_picture = CASE WHEN p_updates ? 'profile_picture' THEN p_updates ->> 'profile_picture' ELSE actor.profile_picture END,
        nationality = CASE WHEN p_updates ? 'nationality' THEN p_updates ->> 'nationality' ELSE actor.nationality END,
        date_of_birth = CASE WHEN p_updates ? 'date_of_birth' THEN (p_updates ->> 'date_of_birth')::DATE ELSE actor.date_of_birth END,
        bio = CASE WHEN p_updates ? 'bio' THEN p_updates ->> 'bio' ELSE actor.bio END,
        tmdb_id = CASE WHEN p_updates ? 'tmdb_id' THEN (p_updates ->> 'tmdb_id')::BIGINT ELSE actor.tmdb_id END,
        wikidata_id = CASE WHEN p_updates ? 'wikidata_id' THEN p_updates ->> 'wikidata_id' ELSE actor.wikidata_id END,
        social_media_links = CASE WHEN p_updates ? 'social_media_links' THEN COALESCE(actor.social_media_links, '{}'::JSONB) || (p_updates -> 'social_media_links') ELSE actor.social_media_links END,
        updated_by = p_user_id,
        updated_at = clock_timestamp()
    WHERE actor.id = v_claim.entity_id::BIGINT;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Task submission could not update its target';
    END IF;
    v_entity_type := 'voice_actor';
  ELSIF v_claim.category = 'enrich_studio' THEN
    IF v_claim.entity_id !~ '^[1-9][0-9]*$' THEN
      RETURN QUERY SELECT 'stale_task'::TEXT, 0;
      RETURN;
    END IF;

    SELECT * INTO v_studio
    FROM public.studios AS studio
    WHERE studio.id = v_claim.entity_id::BIGINT
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN QUERY SELECT 'stale_task'::TEXT, 0;
      RETURN;
    END IF;

    v_studio_json := to_jsonb(v_studio);
    FOR v_key IN SELECT jsonb_object_keys(p_updates)
    LOOP
      IF v_key NOT IN ('logo_url', 'country', 'city', 'website_url', 'social_media_links') THEN
        RETURN QUERY SELECT 'stale_task'::TEXT, 0;
        RETURN;
      END IF;

      IF v_key = 'social_media_links' THEN
        v_social_updates := p_updates -> v_key;
        IF jsonb_typeof(v_social_updates) IS DISTINCT FROM 'object'
          OR v_social_updates = '{}'::JSONB
          OR (v_studio.social_media_links IS NOT NULL
            AND jsonb_typeof(v_studio.social_media_links) IS DISTINCT FROM 'object') THEN
          RETURN QUERY SELECT 'stale_task'::TEXT, 0;
          RETURN;
        END IF;

        FOR v_social_key IN SELECT jsonb_object_keys(v_social_updates)
        LOOP
          v_value := v_social_updates ->> v_social_key;
          IF v_social_key NOT IN ('twitter', 'instagram', 'tiktok', 'facebook')
            OR jsonb_typeof(v_social_updates -> v_social_key) IS DISTINCT FROM 'string'
            OR btrim(v_value) = '' OR length(v_value) > 2048 THEN
            RETURN QUERY SELECT 'stale_task'::TEXT, 0;
            RETURN;
          END IF;
          IF NULLIF(v_studio.social_media_links ->> v_social_key, '') IS NOT NULL THEN
            RETURN QUERY SELECT 'stale_task'::TEXT, 0;
            RETURN;
          END IF;
        END LOOP;

        v_merged_social := COALESCE(v_studio.social_media_links, '{}'::JSONB) || v_social_updates;
        v_previous := v_previous || jsonb_build_object('social_media_links', v_studio.social_media_links);
        v_new := v_new || jsonb_build_object('social_media_links', v_merged_social);
        v_points := v_points + 5;
        v_action := concat_ws(' ', NULLIF(v_action, ''), 'added_social_links');
      ELSE
        IF (v_studio_json -> v_key) IS NOT NULL
          AND (v_studio_json -> v_key) <> 'null'::JSONB
          AND (v_studio_json -> v_key) <> '""'::JSONB THEN
          RETURN QUERY SELECT 'stale_task'::TEXT, 0;
          RETURN;
        END IF;

        v_value := p_updates ->> v_key;
        IF jsonb_typeof(p_updates -> v_key) IS DISTINCT FROM 'string'
          OR btrim(v_value) = '' OR length(v_value) > 10000 THEN
          RETURN QUERY SELECT 'stale_task'::TEXT, 0;
          RETURN;
        END IF;
        IF v_key = 'logo_url'
          AND v_value !~ ('^' || v_claim.entity_id || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|png|webp)$') THEN
          RETURN QUERY SELECT 'stale_task'::TEXT, 0;
          RETURN;
        END IF;
        IF v_key = 'website_url'
          AND length(v_value) > 2048 THEN
          RETURN QUERY SELECT 'stale_task'::TEXT, 0;
          RETURN;
        END IF;

        v_previous := v_previous || jsonb_build_object(v_key, v_studio_json -> v_key);
        v_new := v_new || jsonb_build_object(v_key, p_updates -> v_key);
        CASE v_key
          WHEN 'logo_url' THEN
            v_points := v_points + 10;
            v_action := concat_ws(' ', NULLIF(v_action, ''), 'added_logo');
          WHEN 'country' THEN
            v_points := v_points + 5;
            v_action := concat_ws(' ', NULLIF(v_action, ''), 'added_country');
          WHEN 'city' THEN
            v_points := v_points + 5;
            v_action := concat_ws(' ', NULLIF(v_action, ''), 'added_city');
          WHEN 'website_url' THEN
            v_points := v_points + 5;
            v_action := concat_ws(' ', NULLIF(v_action, ''), 'added_website');
        END CASE;
      END IF;
    END LOOP;

    PERFORM 1
    FROM public.consume_gamification_task_claim(p_claim_id, p_user_id);
    IF NOT FOUND THEN
      RETURN QUERY SELECT 'invalid_claim'::TEXT, 0;
      RETURN;
    END IF;

    UPDATE public.studios AS studio
    SET logo_url = CASE WHEN p_updates ? 'logo_url' THEN p_updates ->> 'logo_url' ELSE studio.logo_url END,
        country = CASE WHEN p_updates ? 'country' THEN p_updates ->> 'country' ELSE studio.country END,
        city = CASE WHEN p_updates ? 'city' THEN p_updates ->> 'city' ELSE studio.city END,
        website_url = CASE WHEN p_updates ? 'website_url' THEN p_updates ->> 'website_url' ELSE studio.website_url END,
        social_media_links = CASE WHEN p_updates ? 'social_media_links' THEN COALESCE(studio.social_media_links, '{}'::JSONB) || (p_updates -> 'social_media_links') ELSE studio.social_media_links END,
        updated_at = clock_timestamp()
    WHERE studio.id = v_claim.entity_id::BIGINT;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Task submission could not update its target';
    END IF;
    v_entity_type := 'studio';
  ELSE
    RETURN QUERY SELECT 'stale_task'::TEXT, 0;
    RETURN;
  END IF;

  INSERT INTO public.audit_logs (
    user_id, entity_type, entity_id, action,
    previous_value, new_value, points_awarded
  ) VALUES (
    p_user_id, v_entity_type, v_claim.entity_id, btrim(v_action),
    v_previous, v_new, v_points
  );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task submission could not write its audit record';
  END IF;

  UPDATE public.gamification_task_locks AS task_claim
  SET expires_at = clock_timestamp()
  WHERE task_claim.claim_id = p_claim_id
    AND task_claim.user_id = p_user_id
    AND task_claim.consumed_at IS NOT NULL
  RETURNING task_claim.claim_id INTO v_released_claim_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task submission could not release its claim';
  END IF;

  RETURN QUERY SELECT 'submitted'::TEXT, v_points;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_gamification_task_contribution(UUID, UUID, JSONB, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_gamification_task_contribution(UUID, UUID, JSONB, BOOLEAN)
  TO service_role;

COMMENT ON FUNCTION public.submit_gamification_task_contribution(UUID, UUID, JSONB, BOOLEAN) IS
  'Atomically consumes an authenticated contribution claim, writes only still-empty whitelisted entity fields, and inserts the matching audit and points record. Call with the trusted authenticated user id and already validated, normalized updates.';
