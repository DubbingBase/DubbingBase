-- Run in a disposable local database after the game-character fallback migration.
-- The transaction leaves no fixtures behind.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout = '30s';

INSERT INTO auth.users (id, raw_app_meta_data) VALUES
  ('00000000-0000-0000-0000-000000563691', '{"role":"admin"}'::JSONB),
  ('00000000-0000-0000-0000-000000563692', '{"role":"editor"}'::JSONB);

INSERT INTO public.voice_actors (id, firstname, lastname)
VALUES (563691101, 'Game Character', 'Fixture');

SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_admin UUID := '00000000-0000-0000-0000-000000563691';
  v_editor UUID := '00000000-0000-0000-0000-000000563692';
  v_request UUID := '10000000-0000-4000-8000-000000563691';
  v_character_id UUID;
  v_retry_character_id UUID;
  v_audit_id UUID;
  v_retry_audit_id UUID;
  v_replayed BOOLEAN;
  v_other_id UUID;
  v_homonym_id UUID;
  v_count INTEGER;
  v_project_id BIGINT;
  v_work_id BIGINT;
  v_other_work_id BIGINT;
  v_work_updated_at TIMESTAMPTZ;
  v_project_updated_at TIMESTAMP WITHOUT TIME ZONE;
  v_expected_updated_at TIMESTAMPTZ;
  v_reference_audit_id UUID;
  v_reference_replayed BOOLEAN;
  v_linked_work_id BIGINT;
BEGIN
  BEGIN
    PERFORM * FROM public.create_game_character(
      v_editor, '11000000-0000-4000-8000-000000563691', 563691001, 'Unauthorized'
    );
    RAISE EXCEPTION 'non-admin actor unexpectedly created a game character';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  SELECT result.game_character_id, result.audit_log_id, result.replayed
  INTO v_character_id, v_audit_id, v_replayed
  FROM public.create_game_character(
    v_admin, v_request, 563691001, '  Same Name  '
  ) AS result;
  IF v_character_id IS NULL OR v_audit_id IS NULL OR v_replayed THEN
    RAISE EXCEPTION 'game character creation returned an invalid result';
  END IF;

  SELECT result.game_character_id, result.audit_log_id, result.replayed
  INTO v_retry_character_id, v_retry_audit_id, v_replayed
  FROM public.create_game_character(
    v_admin, v_request, 563691001, 'Same Name'
  ) AS result;
  IF v_retry_character_id IS DISTINCT FROM v_character_id
     OR v_retry_audit_id IS DISTINCT FROM v_audit_id
     OR NOT v_replayed THEN
    RAISE EXCEPTION 'an identical retry did not return its original identity and audit';
  END IF;

  SELECT result.game_character_id INTO v_homonym_id
  FROM public.create_game_character(
    v_admin, '10000000-0000-4000-8000-000000563692', 563691001, 'Same Name'
  ) AS result;
  IF v_homonym_id IS NULL OR v_homonym_id = v_character_id THEN
    RAISE EXCEPTION 'same-name homonyms in one game were incorrectly merged';
  END IF;

  SELECT result.game_character_id INTO v_other_id
  FROM public.create_game_character(
    v_admin, '10000000-0000-4000-8000-000000563693', 563691002, 'Same Name'
  ) AS result;
  IF v_other_id IS NULL OR v_other_id = v_character_id THEN
    RAISE EXCEPTION 'same-name characters across games were incorrectly merged';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.game_characters AS character
  WHERE character.id = v_character_id AND character.igdb_game_id = 563691001
    AND character.name = 'Same Name' AND character.created_by = v_admin;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'game character did not store normalized identity and provenance';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.audit_logs AS audit
  WHERE audit.id = v_audit_id AND audit.user_id = v_admin
    AND audit.entity_type = 'game_character'
    AND audit.entity_id = v_character_id::TEXT AND audit.action = 'create'
    AND audit.request_id = v_request AND audit.request_fingerprint IS NOT NULL
    AND audit.metadata ->> 'provenance' = 'dubbing_project_editor'
    AND audit.metadata ->> 'igdb_game_id' = '563691001'
    AND audit.previous_value IS NULL
    AND audit.new_value ->> 'id' = v_character_id::TEXT
    AND audit.new_value ->> 'name' = 'Same Name'
    AND audit.changed_fields @> ARRAY['igdb_game_id', 'name']::TEXT[];
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'game character audit lacks actor, request, provenance, or snapshots';
  END IF;

  SELECT character.updated_at INTO v_expected_updated_at
  FROM public.game_characters AS character WHERE character.id = v_character_id;
  SELECT result.audit_log_id, result.replayed
  INTO v_reference_audit_id, v_reference_replayed
  FROM public.update_game_character_references(
    v_admin,
    '10000000-0000-4000-8000-000000563695',
    v_character_id,
    v_expected_updated_at,
    '{"igdb_character_id":563691077}'::JSONB
  ) AS result;
  IF v_reference_audit_id IS NULL OR v_reference_replayed THEN
    RAISE EXCEPTION 'manual IGDB link did not create an audited update';
  END IF;

  SELECT character.updated_at INTO v_expected_updated_at
  FROM public.game_characters AS character WHERE character.id = v_character_id;
  SELECT result.audit_log_id, result.replayed
  INTO v_reference_audit_id, v_reference_replayed
  FROM public.update_game_character_references(
    v_admin,
    '10000000-0000-4000-8000-000000563696',
    v_character_id,
    v_expected_updated_at,
    '{"wikidata_qid":"Q456"}'::JSONB
  ) AS result;
  IF v_reference_audit_id IS NULL OR v_reference_replayed THEN
    RAISE EXCEPTION 'independent Wikidata link did not create an audited update';
  END IF;

  SELECT character.updated_at INTO v_expected_updated_at
  FROM public.game_characters AS character WHERE character.id = v_homonym_id;
  BEGIN
    PERFORM * FROM public.update_game_character_references(
      v_admin,
      '10000000-0000-4000-8000-000000563697',
      v_homonym_id,
      v_expected_updated_at,
      '{"igdb_character_id":563691077}'::JSONB
    );
    RAISE EXCEPTION 'duplicate same-game IGDB mapping unexpectedly succeeded';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  SELECT character.updated_at INTO v_expected_updated_at
  FROM public.game_characters AS character WHERE character.id = v_character_id;
  SELECT result.audit_log_id, result.replayed
  INTO v_reference_audit_id, v_reference_replayed
  FROM public.update_game_character_references(
    v_admin,
    '10000000-0000-4000-8000-000000563698',
    v_character_id,
    v_expected_updated_at,
    '{"igdb_character_id":null}'::JSONB
  ) AS result;
  IF v_reference_audit_id IS NULL OR v_reference_replayed THEN
    RAISE EXCEPTION 'manual IGDB unlink did not create an audited update';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.game_characters AS character
  JOIN public.audit_logs AS audit
    ON audit.entity_id = character.id::TEXT
  WHERE character.id = v_character_id
    AND character.igdb_character_id IS NULL
    AND character.wikidata_qid = 'Q456'
    AND audit.id = v_reference_audit_id
    AND audit.metadata ->> 'provenance' = 'manual_confirmation'
    AND audit.new_value ->> 'wikidata_qid' = 'Q456';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'IGDB unlink did not preserve independent Wikidata provenance';
  END IF;

  SELECT result.project_id INTO v_project_id
  FROM public.save_dubbing_project_editor(
    v_admin,
    '10000000-0000-4000-8000-000000563694',
    NULL,
    NULL,
    '{"content_id":563691001,"content_type":"video_game","language":"fr-FR","studio_id":null,"status":"draft"}'::JSONB,
    '[]'::JSONB,
    jsonb_build_array(jsonb_build_object(
      'game_character_id', v_character_id,
      'character_name', 'Same Name',
      'voice_actor_id', 563691101,
      'performance', 'dialogues'
    ))
  ) AS result;

  SELECT count(*) INTO v_count
  FROM public.work AS work
  WHERE work.dubbing_project_id = v_project_id
    AND work.game_character_id = v_character_id
    AND work.character_id IS NULL
    AND work.character_name = 'Same Name'
    AND work.voice_actor_id = 563691101;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'controlled project save did not preserve the local character identity and credit';
  END IF;

  SELECT work.id, work.updated_at INTO v_work_id, v_work_updated_at
  FROM public.work AS work WHERE work.dubbing_project_id = v_project_id;
  SELECT project.updated_at INTO v_project_updated_at
  FROM public.dubbing_projects AS project WHERE project.id = v_project_id;
  PERFORM * FROM public.save_dubbing_project_editor(
    v_admin,
    '10000000-0000-4000-8000-000000563699',
    v_project_id,
    v_project_updated_at,
    '{"content_id":563691001,"content_type":"video_game","language":"fr-FR","studio_id":null,"status":"draft"}'::JSONB,
    '[]'::JSONB,
    jsonb_build_array(
      jsonb_build_object(
        'id', v_work_id,
        'expected_updated_at', v_work_updated_at,
        'expected', jsonb_build_object(
          'actor_id', NULL,
          'character_id', NULL,
          'game_character_id', v_character_id,
          'character_name', 'Same Name',
          'voice_actor_id', 563691101,
          'performance', 'dialogues',
          'note', NULL,
          'highlight', FALSE,
          'status', 'validated'
        ),
        'game_character_id', v_character_id,
        'character_id', NULL,
        'character_name', 'Same Name',
        'voice_actor_id', 563691101,
        'performance', 'dialogues',
        'note', NULL,
        'highlight', FALSE
      ),
      jsonb_build_object(
        'game_character_id', v_homonym_id,
        'character_id', NULL,
        'character_name', 'Same Name',
        'voice_actor_id', 563691101,
        'performance', 'dialogues'
      )
    )
  );

  SELECT count(*) INTO v_count
  FROM public.work AS work
  WHERE work.dubbing_project_id = v_project_id
    AND work.game_character_id IN (v_character_id, v_homonym_id)
    AND work.character_name = 'Same Name'
    AND work.voice_actor_id = 563691101;
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'distinct same-name local characters could not retain separate credits';
  END IF;

  SELECT result.work_id INTO v_linked_work_id
  FROM public.create_voice_actor_work_link(
    v_admin,
    '10000000-0000-4000-8000-000000563700',
    563691101,
    563691001,
    'video_game',
    'fr-FR',
    NULL,
    v_character_id,
    'Same Name',
    'dialogues'
  ) AS result;
  IF v_linked_work_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.work AS work
    WHERE work.id = v_linked_work_id
      AND work.game_character_id = v_character_id
  ) THEN
    RAISE EXCEPTION 'voice actor work link did not preserve the selected local character UUID';
  END IF;

  SELECT jsonb_array_length(public.find_duplicate_work_groups(0, 20) -> 'items')
  INTO v_count;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'duplicate moderation grouped distinct local homonyms';
  END IF;

  SELECT min(work.id), max(work.id)
  INTO v_work_id, v_other_work_id
  FROM public.work AS work
  WHERE work.dubbing_project_id = v_project_id
    AND work.game_character_id IN (v_character_id, v_homonym_id);
  BEGIN
    PERFORM public.merge_work_duplicates_atomic(
      v_work_id,
      ARRAY[v_work_id, v_other_work_id],
      '{}'::JSONB,
      v_admin
    );
    RAISE EXCEPTION 'duplicate moderation merged distinct local homonyms';
  EXCEPTION WHEN serialization_failure THEN
    NULL;
  END;
END;
$$;
RESET ROLE;

SET LOCAL ROLE service_role;
DO $$
BEGIN
  BEGIN
    INSERT INTO public.game_characters (igdb_game_id, name, created_by, updated_by)
    VALUES (
      563691003, 'Bypass',
      '00000000-0000-0000-0000-000000563691',
      '00000000-0000-0000-0000-000000563691'
    );
    RAISE EXCEPTION 'service_role unexpectedly wrote a character without its audit RPC';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;
RESET ROLE;

SET LOCAL ROLE anon;
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.game_characters AS character
  WHERE character.igdb_game_id = 563691001 AND character.name = 'Same Name';
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'public local character reads or same-game homonyms failed';
  END IF;
END;
$$;
RESET ROLE;

ROLLBACK;
