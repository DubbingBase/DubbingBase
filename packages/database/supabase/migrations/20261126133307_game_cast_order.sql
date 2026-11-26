-- Explicit cast order of a game: one ordered list per game, shared by every language.
--
-- `game_cast_orders` holds the list's version; `game_cast_order_entries` its characters at positions
-- 1..n. The database guarantees the list is consistent: one position per character, no ties (unique
-- position) and no gaps (checked at commit). Characters that are not in the list are unranked, and
-- nothing is ever added to it implicitly: new IGDB or DubbingBase characters stay unranked until an
-- editor places them, and existing positions never move on their own.
--
-- Writers (administrators only, all audited as `game_cast_order` updates):
--   * `set_game_cast_order` replaces the whole list, checked against the version the caller read
--     (`PT412` when it changed), used by the website editor and `PUT /games/{id}/cast-order`.
--   * `api_mutate_credits` items may carry `cast_rank`: the credit's game character is placed at that
--     position and the others shift, again checked against `cast_order_version`.
CREATE TABLE public.game_cast_orders (
  media_id BIGINT PRIMARY KEY REFERENCES public.media (id) ON DELETE RESTRICT,
  version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
  updated_by UUID REFERENCES auth.users (id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A character can only be ordered in its own game.
ALTER TABLE public.game_characters
  ADD CONSTRAINT game_characters_id_media_key UNIQUE (id, media_id);

CREATE TABLE public.game_cast_order_entries (
  game_character_id UUID NOT NULL,
  media_id BIGINT NOT NULL REFERENCES public.game_cast_orders (media_id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 10000),
  PRIMARY KEY (game_character_id, media_id),
  CONSTRAINT game_cast_order_entries_position_key UNIQUE (media_id, position)
    DEFERRABLE INITIALLY DEFERRED,
  -- An ordered character cannot be deleted without being taken out of the order first.
  CONSTRAINT game_cast_order_entries_character_fkey FOREIGN KEY (game_character_id, media_id)
    REFERENCES public.game_characters (id, media_id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.game_cast_orders IS
  'Version of the explicit cast order of a game (shared by every language).';
COMMENT ON TABLE public.game_cast_order_entries IS
  'Characters of a game cast order at positions 1..n: no ties, no gaps. Unlisted characters are unranked.';

-- Positions of a game are exactly 1..n when the transaction commits.
CREATE OR REPLACE FUNCTION private.check_game_cast_order_contiguous()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_media_id BIGINT := CASE WHEN TG_OP = 'DELETE' THEN OLD.media_id ELSE NEW.media_id END;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.game_cast_order_entries AS entry
    WHERE entry.media_id = v_media_id
    HAVING count(*) <> max(entry.position)
  ) THEN
    RAISE EXCEPTION 'A game cast order must use positions 1 to n without gaps'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER game_cast_order_entries_contiguous
  AFTER INSERT OR UPDATE OR DELETE ON public.game_cast_order_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION private.check_game_cast_order_contiguous();

ALTER TABLE public.game_cast_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_cast_order_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read game cast orders"
  ON public.game_cast_orders FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public can read game cast order entries"
  ON public.game_cast_order_entries FOR SELECT TO anon, authenticated USING (true);
REVOKE ALL ON TABLE public.game_cast_orders, public.game_cast_order_entries
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.game_cast_orders, public.game_cast_order_entries
  TO anon, authenticated, service_role;

-- Replaces the cast order of a game with `p_character_ids` (first = position 1), audited. With
-- `p_expected_version` the write is refused with PT412 when the order changed since it was read;
-- writing the order it already has is a no-op that always succeeds, so a retried write is safe.
-- Returns the order's version.
CREATE OR REPLACE FUNCTION private.write_game_cast_order(
  p_user_id UUID,
  p_media_id BIGINT,
  p_character_ids UUID[],
  p_expected_version BIGINT,
  p_source TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role TEXT;
  v_kind TEXT;
  v_order public.game_cast_orders%ROWTYPE;
  v_before UUID[];
BEGIN
  PERFORM private.assert_contributor(p_user_id);
  SELECT users.raw_app_meta_data ->> 'role' INTO v_role FROM auth.users AS users WHERE users.id = p_user_id;
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only an administrator can order a game cast' USING ERRCODE = '42501';
  END IF;

  SELECT media.kind INTO v_kind FROM public.media AS media WHERE media.id = p_media_id;
  IF v_kind IS DISTINCT FROM 'video_game' THEN
    RAISE EXCEPTION 'Only games have a cast order' USING ERRCODE = '22023';
  END IF;
  IF p_character_ids IS NULL
     OR pg_catalog.cardinality(p_character_ids) > 10000
     OR pg_catalog.array_position(p_character_ids, NULL) IS NOT NULL
     OR (SELECT count(DISTINCT id) FROM pg_catalog.unnest(p_character_ids) AS id)
        <> pg_catalog.cardinality(p_character_ids) THEN
    RAISE EXCEPTION 'A cast order lists distinct characters' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM public.game_characters AS character
      WHERE character.media_id = p_media_id AND character.id = ANY (p_character_ids))
     <> pg_catalog.cardinality(p_character_ids) THEN
    RAISE EXCEPTION 'Every character of a cast order must belong to the game' USING ERRCODE = '23503';
  END IF;

  INSERT INTO public.game_cast_orders (media_id) VALUES (p_media_id) ON CONFLICT (media_id) DO NOTHING;
  SELECT cast_order.* INTO v_order
  FROM public.game_cast_orders AS cast_order WHERE cast_order.media_id = p_media_id FOR UPDATE;
  SELECT COALESCE(pg_catalog.array_agg(entry.game_character_id ORDER BY entry.position), '{}')
  INTO v_before
  FROM public.game_cast_order_entries AS entry WHERE entry.media_id = p_media_id;

  IF v_before = p_character_ids THEN
    RETURN v_order.version;
  END IF;
  IF p_expected_version IS NOT NULL AND p_expected_version <> v_order.version THEN
    RAISE EXCEPTION 'The cast order changed since it was read' USING ERRCODE = 'PT412';
  END IF;

  DELETE FROM public.game_cast_order_entries AS entry WHERE entry.media_id = p_media_id;
  INSERT INTO public.game_cast_order_entries (game_character_id, media_id, position)
  SELECT item.id, p_media_id, item.position::INTEGER
  FROM pg_catalog.unnest(p_character_ids) WITH ORDINALITY AS item(id, position);
  UPDATE public.game_cast_orders AS cast_order
  SET version = cast_order.version + 1,
      updated_by = p_user_id,
      updated_at = pg_catalog.clock_timestamp()
  WHERE cast_order.media_id = p_media_id
  RETURNING cast_order.* INTO v_order;

  INSERT INTO public.audit_logs (
    id, user_id, entity_type, entity_id, action,
    previous_value, new_value, changed_fields, metadata
  ) VALUES (
    pg_catalog.gen_random_uuid(), p_user_id, 'game_cast_order', p_media_id::TEXT, 'update',
    pg_catalog.jsonb_build_object('version', v_order.version - 1, 'characters', pg_catalog.to_jsonb(v_before)),
    pg_catalog.jsonb_build_object('version', v_order.version, 'characters', pg_catalog.to_jsonb(p_character_ids)),
    ARRAY['characters']::TEXT[],
    pg_catalog.jsonb_build_object(
      'source', p_source,
      'origin', pg_catalog.current_setting('app.mutation_origin', TRUE),
      'igdb_game_id', private.media_content_id(p_media_id),
      'transaction_id', pg_catalog.pg_current_xact_id()::TEXT
    )
  );
  RETURN v_order.version;
END;
$$;

-- Places characters at the given positions and shifts the others. `p_placements` is an array of
-- {game_character_id, cast_rank} (cast_rank null takes the character out of the order). All placed
-- characters are taken out first, then inserted by ascending rank, so each one ends exactly at its
-- rank; a rank past the end of the list is refused rather than moved. The website mirrors this in
-- `applyCastPlacements` for dry runs. Returns the order's version.
CREATE OR REPLACE FUNCTION private.place_game_cast_characters(
  p_user_id UUID,
  p_media_id BIGINT,
  p_placements JSONB,
  p_expected_version BIGINT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_list UUID[];
  v_placement RECORD;
BEGIN
  IF pg_catalog.jsonb_typeof(p_placements) IS DISTINCT FROM 'array' OR EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_array_elements(p_placements) AS item(value)
    WHERE (item.value ->> 'game_character_id') IS NULL
       OR (item.value -> 'cast_rank' <> 'null'::JSONB AND (
         pg_catalog.jsonb_typeof(item.value -> 'cast_rank') IS DISTINCT FROM 'number'
         OR (item.value ->> 'cast_rank') !~ '^[1-9][0-9]{0,4}$'
         OR (item.value ->> 'cast_rank')::INTEGER > 10000))
  ) THEN
    RAISE EXCEPTION 'Cast ranks must be null or integers from 1 to 10000' USING ERRCODE = '22023';
  END IF;
  -- One placement per character, and two characters never share a rank.
  IF EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_array_elements(p_placements) AS item(value)
    GROUP BY item.value ->> 'game_character_id' HAVING count(*) > 1
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_array_elements(p_placements) AS item(value)
    WHERE item.value -> 'cast_rank' <> 'null'::JSONB
    GROUP BY item.value ->> 'cast_rank' HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Each character takes one rank and each rank one character' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(pg_catalog.array_agg(entry.game_character_id ORDER BY entry.position), '{}')
  INTO v_list
  FROM public.game_cast_order_entries AS entry
  WHERE entry.media_id = p_media_id
    AND entry.game_character_id NOT IN (
      SELECT (item.value ->> 'game_character_id')::UUID
      FROM pg_catalog.jsonb_array_elements(p_placements) AS item(value)
    );

  FOR v_placement IN
    SELECT (item.value ->> 'game_character_id')::UUID AS id, (item.value ->> 'cast_rank')::INTEGER AS rank
    FROM pg_catalog.jsonb_array_elements(p_placements) AS item(value)
    WHERE item.value -> 'cast_rank' <> 'null'::JSONB
    ORDER BY 2
  LOOP
    IF v_placement.rank > pg_catalog.cardinality(v_list) + 1 THEN
      RAISE EXCEPTION 'Cast rank % is past the end of the order', v_placement.rank USING ERRCODE = '22023';
    END IF;
    v_list := v_list[1:v_placement.rank - 1] || v_placement.id || v_list[v_placement.rank:];
  END LOOP;

  RETURN private.write_game_cast_order(
    p_user_id, p_media_id, v_list, p_expected_version, 'place_game_cast_characters'
  );
END;
$$;

REVOKE ALL ON FUNCTION private.check_game_cast_order_contiguous() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.write_game_cast_order(UUID, BIGINT, UUID[], BIGINT, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.place_game_cast_characters(UUID, BIGINT, JSONB, BIGINT)
  FROM PUBLIC, anon, authenticated;

-- The cast order of a game as {version, characters: [{game_character_id, name, position}]}.
CREATE OR REPLACE FUNCTION private.game_cast_order_json(p_media_id BIGINT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'version', COALESCE((SELECT cast_order.version FROM public.game_cast_orders AS cast_order
                         WHERE cast_order.media_id = p_media_id), 0),
    'characters', COALESCE((
      SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'game_character_id', entry.game_character_id,
          'name', character.name,
          'position', entry.position
        ) ORDER BY entry.position)
      FROM public.game_cast_order_entries AS entry
      JOIN public.game_characters AS character ON character.id = entry.game_character_id
      WHERE entry.media_id = p_media_id
    ), '[]'::JSONB)
  );
$$;
REVOKE ALL ON FUNCTION private.game_cast_order_json(BIGINT) FROM PUBLIC, anon, authenticated;

-- Replaces a game's cast order for the website editor (`p_origin` 'website') or the API ('api').
CREATE OR REPLACE FUNCTION public.set_game_cast_order(
  p_actor_id UUID,
  p_igdb_game_id BIGINT,
  p_character_ids UUID[],
  p_expected_version BIGINT,
  p_origin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_media_id BIGINT;
BEGIN
  IF p_origin IS NULL OR p_origin NOT IN ('website', 'api') OR p_expected_version IS NULL THEN
    RAISE EXCEPTION 'Cast order request is invalid' USING ERRCODE = '22023';
  END IF;
  IF p_origin = 'api' THEN
    PERFORM pg_catalog.set_config('app.mutation_origin', 'api', TRUE);
  END IF;
  v_media_id := private.find_media_id('video_game', p_igdb_game_id);
  IF v_media_id IS NULL THEN
    RAISE EXCEPTION 'Game not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM private.write_game_cast_order(
    p_actor_id, v_media_id, p_character_ids, p_expected_version, 'set_game_cast_order'
  );
  RETURN private.game_cast_order_json(v_media_id);
END;
$$;
REVOKE ALL ON FUNCTION public.set_game_cast_order(UUID, BIGINT, UUID[], BIGINT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_game_cast_order(UUID, BIGINT, UUID[], BIGINT, TEXT) TO service_role;

-- api_mutate_credits: items may carry `cast_rank` (with the `cast_order_version` the caller read).
-- The credit must be linked to a game character: ranking never guesses a link. Placements of one
-- game are applied together after the other writes of the request, so the request is one
-- transaction. `after` is the credit row plus its `cast_rank`; each item also returns its game's
-- resulting `cast_order` when the request placed characters in it.
CREATE OR REPLACE FUNCTION public.api_mutate_credits(p_user_id UUID, p_operation TEXT, p_items JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item JSONB;
  v_changes JSONB;
  v_index INTEGER := 0;
  v_row RECORD;
  v_created BOOLEAN;
  v_work_id BIGINT;
  v_current_updated_at TIMESTAMPTZ;
  v_character_id UUID;
  v_media_id BIGINT;
  v_written JSONB := '[]'::JSONB;
  -- media id -> {version, placements: [...]}
  v_placements JSONB := '{}'::JSONB;
  v_game RECORD;
  v_orders JSONB := '{}'::JSONB;
  v_results JSONB := '[]'::JSONB;
BEGIN
  IF p_user_id IS NULL
     OR p_operation IS NULL OR p_operation NOT IN ('create', 'update', 'sync')
     OR p_items IS NULL OR pg_catalog.jsonb_typeof(p_items) <> 'array'
     OR pg_catalog.jsonb_array_length(p_items) NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'Credit mutation request is invalid' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.set_config('app.mutation_origin', 'api', TRUE);

  FOR v_item IN SELECT item.value FROM pg_catalog.jsonb_array_elements(p_items) AS item(value) LOOP
    BEGIN
      v_created := FALSE;
      -- `sync` items are creates, or updates when they carry a work_id, in one transaction.
      IF p_operation = 'create' OR (p_operation = 'sync' AND NOT v_item ? 'work_id') THEN
        SELECT * INTO v_row FROM public.create_voice_actor_work_link(
          p_user_id, pg_catalog.gen_random_uuid(),
          (v_item ->> 'voice_actor_id')::BIGINT,
          (v_item ->> 'content_id')::BIGINT,
          v_item ->> 'content_type',
          v_item ->> 'language',
          (v_item ->> 'actor_person_id')::BIGINT,
          (v_item ->> 'game_character_id')::UUID,
          v_item ->> 'character_name',
          v_item ->> 'performance'
        );
        v_work_id := v_row.work_id;
        SELECT audit.action = 'create' INTO v_created
        FROM public.audit_logs AS audit WHERE audit.id = v_row.audit_log_id;
        -- A credit created with highlight = true is flagged right after, as its own audited
        -- update in the same transaction. A credit that already existed is left alone: use
        -- the update operation to change it.
        IF v_created AND COALESCE((v_item ->> 'highlight')::BOOLEAN, FALSE) THEN
          PERFORM public.update_voice_actor_work_credit(
            p_user_id, pg_catalog.gen_random_uuid(),
            v_work_id,
            (SELECT work.updated_at FROM public.work AS work WHERE work.id = v_work_id),
            pg_catalog.jsonb_build_object('highlight', TRUE)
          );
        END IF;
      ELSE
        v_work_id := (v_item ->> 'work_id')::BIGINT;
        v_changes := v_item - 'work_id' - 'expected_updated_at' - 'cast_rank' - 'cast_order_version';
        IF v_changes <> '{}'::JSONB THEN
          PERFORM public.update_voice_actor_work_credit(
            p_user_id, pg_catalog.gen_random_uuid(),
            v_work_id,
            (v_item ->> 'expected_updated_at')::TIMESTAMPTZ,
            v_changes
          );
        ELSIF v_item ? 'cast_rank' THEN
          -- Rank only: the credit row is not written, so check its version here.
          SELECT work.updated_at INTO v_current_updated_at
          FROM public.work AS work WHERE work.id = v_work_id FOR UPDATE;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'Work not found' USING ERRCODE = 'P0002';
          END IF;
          IF v_current_updated_at IS DISTINCT FROM (v_item ->> 'expected_updated_at')::TIMESTAMPTZ THEN
            RAISE EXCEPTION 'Work changed since it was loaded' USING ERRCODE = 'PT409';
          END IF;
        ELSE
          RAISE EXCEPTION 'Voice actor work update fields are invalid' USING ERRCODE = '22023';
        END IF;
      END IF;

      IF v_item ? 'cast_rank' THEN
        SELECT work.game_character_id, project.media_id INTO v_character_id, v_media_id
        FROM public.work AS work
        JOIN public.dubbing_projects AS project ON project.id = work.dubbing_project_id
        WHERE work.id = v_work_id;
        IF v_character_id IS NULL THEN
          RAISE EXCEPTION 'Link the credit to a game character before ranking it' USING ERRCODE = '22023';
        END IF;
        IF pg_catalog.jsonb_typeof(v_item -> 'cast_order_version') IS DISTINCT FROM 'number'
           OR (v_placements ? v_media_id::TEXT
             AND v_placements -> v_media_id::TEXT -> 'version' <> v_item -> 'cast_order_version') THEN
          RAISE EXCEPTION 'A ranked credit needs the cast order version it was read from' USING ERRCODE = '22023';
        END IF;
        -- The same character may be ranked through several credits (languages) of one request,
        -- as long as they agree.
        IF EXISTS (
          SELECT 1 FROM pg_catalog.jsonb_array_elements(v_placements -> v_media_id::TEXT -> 'placements') AS placed(value)
          WHERE placed.value ->> 'game_character_id' = v_character_id::TEXT
            AND placed.value -> 'cast_rank' IS DISTINCT FROM v_item -> 'cast_rank'
        ) THEN
          RAISE EXCEPTION 'Credits of one character were given different ranks' USING ERRCODE = '22023';
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_catalog.jsonb_array_elements(v_placements -> v_media_id::TEXT -> 'placements') AS placed(value)
          WHERE placed.value ->> 'game_character_id' = v_character_id::TEXT
        ) THEN
          v_placements := v_placements || pg_catalog.jsonb_build_object(
            v_media_id::TEXT, pg_catalog.jsonb_build_object(
              'version', v_item -> 'cast_order_version',
              'placements', COALESCE(v_placements -> v_media_id::TEXT -> 'placements', '[]'::JSONB)
                || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
                  'game_character_id', v_character_id, 'cast_rank', v_item -> 'cast_rank'))
            )
          );
        END IF;
      END IF;
      v_written := v_written || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object('work_id', v_work_id, 'created', v_created)
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Credit % was rejected', v_index
        USING ERRCODE = SQLSTATE, HINT = v_index::TEXT;
    END;
    v_index := v_index + 1;
  END LOOP;

  -- No HINT here: a placement error concerns the request's ranks together, not one item.
  FOR v_game IN SELECT key AS media_id, value AS placement FROM pg_catalog.jsonb_each(v_placements) LOOP
    PERFORM private.place_game_cast_characters(
      p_user_id, v_game.media_id::BIGINT, v_game.placement -> 'placements',
      (v_game.placement ->> 'version')::BIGINT
    );
    v_orders := v_orders || pg_catalog.jsonb_build_object(
      v_game.media_id, private.game_cast_order_json(v_game.media_id::BIGINT)
    );
  END LOOP;

  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'work_id', work.id,
      'created', (written.value ->> 'created')::BOOLEAN,
      'after', pg_catalog.to_jsonb(work) || pg_catalog.jsonb_build_object('cast_rank', entry.position),
      'cast_order', v_orders -> project.media_id::TEXT
    ) ORDER BY written.position), '[]'::JSONB)
  INTO v_results
  FROM pg_catalog.jsonb_array_elements(v_written) WITH ORDINALITY AS written(value, position)
  JOIN public.work AS work ON work.id = (written.value ->> 'work_id')::BIGINT
  JOIN public.dubbing_projects AS project ON project.id = work.dubbing_project_id
  LEFT JOIN public.game_cast_order_entries AS entry
    ON entry.game_character_id = work.game_character_id AND entry.media_id = project.media_id;
  RETURN v_results;
END;
$$;
