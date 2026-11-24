-- Finer public API token scopes (resource:read|create|update), plus audited API writes for game
-- characters and voice actors. Existing tokens keep exactly the abilities they have today.

-- 1. Scopes -------------------------------------------------------------------------------
ALTER TABLE public.api_tokens DROP CONSTRAINT api_tokens_scopes_check;

-- credits:write -> credits:create + credits:update; voice-actors:write -> voice-actors:update
-- (voice actors could not be created through the API before, so no token gains that);
-- credits:read -> also characters:read, because the characters listing used to need credits:read.
UPDATE public.api_tokens AS token
SET scopes = ARRAY(
  SELECT DISTINCT expanded.scope
  FROM pg_catalog.unnest(token.scopes) AS held(scope),
  LATERAL pg_catalog.unnest(
    CASE held.scope
      WHEN 'credits:write' THEN ARRAY['credits:create', 'credits:update']
      WHEN 'voice-actors:write' THEN ARRAY['voice-actors:update']
      WHEN 'credits:read' THEN ARRAY['credits:read', 'characters:read']
      ELSE ARRAY[held.scope]
    END
  ) AS expanded(scope)
  ORDER BY expanded.scope
);

ALTER TABLE public.api_tokens ADD CONSTRAINT api_tokens_scopes_check CHECK (
  cardinality(scopes) > 0
  AND scopes <@ ARRAY[
    'voice-actors:read', 'voice-actors:create', 'voice-actors:update',
    'credits:read', 'credits:create', 'credits:update',
    'characters:read', 'characters:create', 'characters:update'
  ]::TEXT[]
);

-- 2. Game characters, audited with origin 'api' ----------------------------------------------
-- Creates a character for a game DubbingBase already knows. A character with the same name
-- (case-insensitive) on that game is returned instead of duplicated. `p_igdb_character_id`
-- links it to an IGDB character in the same transaction; it is stored as given.
CREATE OR REPLACE FUNCTION public.api_create_game_character(
  p_actor_id UUID, p_request_id UUID, p_igdb_game_id BIGINT, p_name TEXT, p_igdb_character_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_media_id BIGINT;
  v_character public.game_characters%ROWTYPE;
  v_created BOOLEAN := FALSE;
  v_new_id UUID;
BEGIN
  PERFORM pg_catalog.set_config('app.mutation_origin', 'api', TRUE);
  IF p_name IS NULL OR pg_catalog.length(pg_catalog.btrim(p_name)) NOT BETWEEN 1 AND 300
     OR p_igdb_game_id IS NULL OR p_igdb_game_id <= 0
     OR (p_igdb_character_id IS NOT NULL AND p_igdb_character_id <= 0) THEN
    RAISE EXCEPTION 'Game character fields are invalid' USING ERRCODE = '22023';
  END IF;

  SELECT media.id INTO v_media_id FROM public.media AS media
  WHERE media.kind = 'video_game' AND media.content_id = p_igdb_game_id;
  IF v_media_id IS NULL THEN
    RAISE EXCEPTION 'Game not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT character.* INTO v_character FROM public.game_characters AS character
  WHERE character.media_id = v_media_id
    AND pg_catalog.lower(character.name) = pg_catalog.lower(pg_catalog.btrim(p_name))
  ORDER BY character.created_at
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT created.game_character_id INTO v_new_id
    FROM public.create_game_character(p_actor_id, p_request_id, p_igdb_game_id, p_name) AS created;
    SELECT character.* INTO v_character FROM public.game_characters AS character
    WHERE character.id = v_new_id;
    v_created := TRUE;
    IF p_igdb_character_id IS NOT NULL THEN
      PERFORM public.update_game_character_references(
        p_actor_id, pg_catalog.gen_random_uuid(), v_character.id, v_character.updated_at,
        pg_catalog.jsonb_build_object('igdb_character_id', p_igdb_character_id)
      );
      SELECT character.* INTO v_character FROM public.game_characters AS character
      WHERE character.id = v_new_id;
    END IF;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'game_character_id', v_character.id,
    'created', v_created,
    'name', v_character.name,
    'igdb_character_id', v_character.igdb_character_id,
    'wikidata_qid', v_character.wikidata_qid,
    'updated_at', v_character.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.api_create_game_character(UUID, UUID, BIGINT, TEXT, BIGINT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_create_game_character(UUID, UUID, BIGINT, TEXT, BIGINT) TO service_role;

-- Sets or clears a character's IGDB and Wikidata references as the API.
CREATE OR REPLACE FUNCTION public.api_update_game_character_references(
  p_actor_id UUID, p_request_id UUID, p_game_character_id UUID,
  p_expected_updated_at TIMESTAMPTZ, p_references JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_character public.game_characters%ROWTYPE;
BEGIN
  PERFORM pg_catalog.set_config('app.mutation_origin', 'api', TRUE);
  PERFORM public.update_game_character_references(
    p_actor_id, p_request_id, p_game_character_id, p_expected_updated_at, p_references
  );
  SELECT character.* INTO v_character FROM public.game_characters AS character
  WHERE character.id = p_game_character_id;
  RETURN pg_catalog.jsonb_build_object(
    'game_character_id', v_character.id,
    'name', v_character.name,
    'igdb_character_id', v_character.igdb_character_id,
    'wikidata_qid', v_character.wikidata_qid,
    'updated_at', v_character.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.api_update_game_character_references(UUID, UUID, UUID, TIMESTAMPTZ, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_update_game_character_references(UUID, UUID, UUID, TIMESTAMPTZ, JSONB) TO service_role;

-- 3. Voice actors, audited with origin 'api' --------------------------------------------------
-- Creates a voice actor. Homonyms are real people, so a name that matches an existing actor
-- ignoring case, accents and hyphens is only created when the request proves it is another
-- person: for every such actor, a tmdb_id, wikidata_id or date_of_birth that both sides have
-- and that differs. An id shared with a match means the same person. Otherwise nothing is
-- written and the matches come back as `duplicates`. An identical (firstname, lastname) pair
-- is always refused while the unique constraint stands.
CREATE OR REPLACE FUNCTION public.api_create_voice_actor(
  p_actor_id UUID, p_request_id UUID, p_firstname TEXT, p_lastname TEXT,
  p_tmdb_id BIGINT, p_wikidata_id TEXT, p_date_of_birth DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role TEXT;
  v_first TEXT := pg_catalog.btrim(p_firstname);
  v_last TEXT := pg_catalog.btrim(p_lastname);
  v_fingerprint TEXT;
  v_existing_audit public.audit_logs%ROWTYPE;
  v_actor public.voice_actors%ROWTYPE;
  v_duplicates JSONB;
  v_exact BOOLEAN;
  v_blocking BOOLEAN;
BEGIN
  SELECT users.raw_app_meta_data ->> 'role' INTO v_role FROM auth.users AS users
  WHERE users.id = p_actor_id;
  IF p_actor_id IS NULL OR v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only an administrator can create a voice actor' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL
     OR v_first IS NULL OR pg_catalog.length(v_first) NOT BETWEEN 1 AND 100
     OR v_last IS NULL OR pg_catalog.length(v_last) NOT BETWEEN 1 AND 100
     OR (p_tmdb_id IS NOT NULL AND p_tmdb_id <= 0)
     OR (p_wikidata_id IS NOT NULL AND p_wikidata_id !~ '^Q[1-9][0-9]*$') THEN
    RAISE EXCEPTION 'Voice actor fields are invalid' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.set_config('app.mutation_origin', 'api', TRUE);

  v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'firstname', v_first, 'lastname', v_last, 'tmdb_id', p_tmdb_id,
    'wikidata_id', p_wikidata_id, 'date_of_birth', p_date_of_birth
  )::TEXT);
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_actor_id::TEXT || ':' || p_request_id::TEXT, 0)
  );

  SELECT audit.* INTO v_existing_audit FROM public.audit_logs AS audit
  WHERE audit.user_id = p_actor_id AND audit.request_id = p_request_id;
  IF FOUND THEN
    IF v_existing_audit.entity_type IS DISTINCT FROM 'voice_actor'
       OR v_existing_audit.action IS DISTINCT FROM 'create'
       OR v_existing_audit.request_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'Request id was already used for a different operation' USING ERRCODE = '23505';
    END IF;
    RETURN pg_catalog.jsonb_build_object(
      'created', FALSE, 'replayed', TRUE,
      'voice_actor_id', v_existing_audit.entity_id::BIGINT, 'duplicates', '[]'::JSONB
    );
  END IF;

  -- Matches the name ignoring case, accents and hyphens; `distinct_person` is true only when
  -- an identifier both sides have proves they differ and none is shared.
  WITH matches AS (
    SELECT match.id, match.firstname, match.lastname, match.tmdb_id, match.wikidata_id,
           match.date_of_birth,
           (match.firstname = v_first AND match.lastname = v_last) AS exact,
           (
             (p_tmdb_id IS NOT NULL AND match.tmdb_id = p_tmdb_id)
             OR (p_wikidata_id IS NOT NULL AND match.wikidata_id = p_wikidata_id)
           ) AS same_person,
           (
             (p_tmdb_id IS NOT NULL AND match.tmdb_id IS NOT NULL AND match.tmdb_id <> p_tmdb_id)
             OR (p_wikidata_id IS NOT NULL AND match.wikidata_id IS NOT NULL AND match.wikidata_id <> p_wikidata_id)
             OR (p_date_of_birth IS NOT NULL AND match.date_of_birth IS NOT NULL AND match.date_of_birth <> p_date_of_birth)
           ) AS differs
    FROM public.voice_actors AS match
    WHERE public.unaccent(pg_catalog.lower(pg_catalog.replace(match.firstname, '-', ' ')))
          = public.unaccent(pg_catalog.lower(pg_catalog.replace(v_first, '-', ' ')))
      AND public.unaccent(pg_catalog.lower(pg_catalog.replace(match.lastname, '-', ' ')))
          = public.unaccent(pg_catalog.lower(pg_catalog.replace(v_last, '-', ' ')))
  )
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'id', matches.id, 'firstname', matches.firstname, 'lastname', matches.lastname,
           'tmdb_id', matches.tmdb_id, 'wikidata_id', matches.wikidata_id,
           'date_of_birth', matches.date_of_birth
         ) ORDER BY matches.id) FILTER (WHERE matches.same_person OR NOT matches.differs OR matches.exact), '[]'::JSONB),
         COALESCE(pg_catalog.bool_or(matches.exact), FALSE),
         COALESCE(pg_catalog.bool_or(matches.same_person OR NOT matches.differs), FALSE)
  INTO v_duplicates, v_exact, v_blocking
  FROM matches;

  IF v_exact OR v_blocking THEN
    RETURN pg_catalog.jsonb_build_object(
      'created', FALSE, 'replayed', FALSE, 'voice_actor_id', NULL,
      'duplicates', v_duplicates, 'exact', v_exact
    );
  END IF;

  INSERT INTO public.voice_actors (firstname, lastname, tmdb_id, wikidata_id, date_of_birth)
  VALUES (v_first, v_last, p_tmdb_id, p_wikidata_id, p_date_of_birth)
  RETURNING * INTO v_actor;

  INSERT INTO public.audit_logs (
    id, user_id, entity_type, entity_id, action, previous_value, new_value, changed_fields,
    request_id, request_fingerprint, metadata
  ) VALUES (
    pg_catalog.gen_random_uuid(), p_actor_id, 'voice_actor', v_actor.id::TEXT, 'create',
    NULL, pg_catalog.to_jsonb(v_actor), ARRAY['firstname', 'lastname', 'tmdb_id', 'wikidata_id', 'date_of_birth']::TEXT[],
    p_request_id, v_fingerprint,
    pg_catalog.jsonb_build_object(
      'source', 'api_create_voice_actor',
      'transaction_id', pg_catalog.pg_current_xact_id()::TEXT
    )
  );

  RETURN pg_catalog.jsonb_build_object(
    'created', TRUE, 'replayed', FALSE, 'voice_actor_id', v_actor.id, 'duplicates', '[]'::JSONB
  );
END;
$$;

REVOKE ALL ON FUNCTION public.api_create_voice_actor(UUID, UUID, TEXT, TEXT, BIGINT, TEXT, DATE)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_create_voice_actor(UUID, UUID, TEXT, TEXT, BIGINT, TEXT, DATE) TO service_role;
