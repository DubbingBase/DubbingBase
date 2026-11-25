-- Completes the nine The Witcher 3 (IGDB game 1942) credits that had no character name.
--
-- Each credit held only the legacy IGDB character id in work.character_id, so the API and the
-- character pages saw a credit with no character. The IGDB names below were read from IGDB
-- (/v4/characters) when this migration was written. For each credit the migration:
--   * registers the IGDB character as a game_characters row of the game when it is missing;
--   * sets game_character_id and character_name on the existing credit, in place: id, history,
--     review status are untouched (updated_at follows the table trigger), and work.character_id is kept.
--
-- It only touches a credit that is still nameless, unlinked and carries the expected legacy id,
-- so rerunning it, or running it where the rows do not exist (fresh local databases), changes
-- nothing. The duplicate-work trigger still applies: a collision with an existing credit of the
-- same voice actor aborts the migration instead of merging anything.
--
-- 27 other nameless game credits (games 25076 and 87622) carry ids that IGDB does not know; they
-- are deliberately left alone. Movie and TV credits are identified by their TMDB person id and
-- stay nameless by design.
--
-- Rollback: UPDATE public.work SET game_character_id = NULL, character_name = NULL
-- WHERE id IN (62171, 75110, 75407, 77237, 77241, 77242, 77243, 77244, 77245);
-- the registered characters can stay, or be deleted once nothing references them.
DO $migration$
DECLARE
  v_actor UUID;
  v_media_id BIGINT;
  v_completed INTEGER;
BEGIN
  SELECT media.id INTO v_media_id
  FROM public.media AS media
  WHERE media.kind = 'video_game' AND media.content_id = 1942;
  IF v_media_id IS NULL THEN
    RAISE NOTICE 'Game 1942 has no media row; nothing to complete';
    RETURN;
  END IF;

  CREATE TEMP TABLE pending_credit (
    work_id BIGINT PRIMARY KEY,
    igdb_id BIGINT NOT NULL,
    name TEXT NOT NULL
  ) ON COMMIT DROP;
  INSERT INTO pending_credit (work_id, igdb_id, name)
  SELECT credit.work_id, credit.igdb_id, credit.name
  FROM (VALUES
    (62171, 1453, 'Geralt of Rivia'),
    (75110, 4889, 'Ciri'),
    (75407, 4889, 'Ciri'),
    (77237, 4888, 'Yennefer'),
    (77241, 4900, 'Emhyr Var Emreis'),
    (77242, 4898, 'Vesemir'),
    (77243, 1458, 'Triss Merigold'),
    (77244, 1454, 'Zoltan'),
    (77245, 1460, 'Dandelion')
  ) AS credit(work_id, igdb_id, name)
  WHERE EXISTS (
    SELECT 1
    FROM public.work AS work
    JOIN public.dubbing_projects AS project ON project.id = work.dubbing_project_id
    WHERE work.id = credit.work_id
      AND project.media_id = v_media_id
      AND work.character_id = credit.igdb_id
      AND work.game_character_id IS NULL
      AND pg_catalog.btrim(COALESCE(work.character_name, '')) = ''
  );
  IF NOT EXISTS (SELECT 1 FROM pending_credit) THEN
    RAISE NOTICE 'No nameless Witcher 3 credit left to complete';
    RETURN;
  END IF;

  -- Attribute the new characters to whoever created the credits, else to an admin.
  SELECT COALESCE(
    (SELECT work.created_by FROM public.work AS work
     WHERE work.id IN (SELECT pending.work_id FROM pending_credit AS pending)
       AND work.created_by IS NOT NULL
     ORDER BY work.id LIMIT 1),
    (SELECT users.id FROM auth.users AS users
     WHERE users.raw_app_meta_data ->> 'role' = 'admin'
     ORDER BY users.created_at LIMIT 1)
  ) INTO v_actor;
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'No user to attribute the game characters to' USING ERRCODE = '55000';
  END IF;

  INSERT INTO public.game_characters (media_id, igdb_character_id, name, created_by, updated_by)
  SELECT DISTINCT v_media_id, pending.igdb_id, pending.name, v_actor, v_actor
  FROM pending_credit AS pending
  ON CONFLICT (media_id, igdb_character_id) WHERE igdb_character_id IS NOT NULL DO NOTHING;

  UPDATE public.work AS work
  SET game_character_id = character.id,
      character_name = pending.name
  FROM pending_credit AS pending
  JOIN public.game_characters AS character
    ON character.media_id = v_media_id AND character.igdb_character_id = pending.igdb_id
  WHERE work.id = pending.work_id;
  GET DIAGNOSTICS v_completed = ROW_COUNT;
  RAISE NOTICE 'Completed % Witcher 3 credit(s)', v_completed;
END
$migration$;
