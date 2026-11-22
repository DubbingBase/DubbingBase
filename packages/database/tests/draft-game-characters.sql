-- Run against isolated local Supabase. The transaction leaves no fixtures behind.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout = '30s';

INSERT INTO auth.users (id, raw_app_meta_data) VALUES
  ('00000000-0000-0000-0000-000000563701', '{"role":"admin"}'::JSONB),
  ('00000000-0000-0000-0000-000000563702', '{"role":"editor"}'::JSONB);
INSERT INTO public.voice_actors (id, firstname, lastname) VALUES
  (563701101, 'Draft Character', 'One'), (563701102, 'Draft Character', 'Two');

SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_admin UUID := '00000000-0000-0000-0000-000000563701';
  v_editor UUID := '00000000-0000-0000-0000-000000563702';
  v_request UUID := '10000000-0000-4000-8000-000000563701';
  v_draft UUID := '20000000-0000-4000-8000-000000563701';
  v_project JSONB := '{"content_id":563701001,"content_type":"video_game","language":"fr-FR","studio_id":null,"status":"draft"}';
  v_drafts JSONB := jsonb_build_object(v_draft::TEXT, 'Draft Role');
  v_cast JSONB := jsonb_build_array(
    jsonb_build_object('game_character_id', v_draft, 'character_name', 'Draft Role', 'voice_actor_id', 563701101),
    jsonb_build_object('game_character_id', v_draft, 'character_name', 'Draft Role', 'voice_actor_id', 563701102)
  );
  v_saved RECORD;
  v_retry RECORD;
  v_character_id UUID;
BEGIN
  IF has_function_privilege('anon', 'public.save_dubbing_project_editor_with_characters(uuid, uuid, bigint, timestamp, jsonb, jsonb, jsonb, jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.save_dubbing_project_editor_with_characters(uuid, uuid, bigint, timestamp, jsonb, jsonb, jsonb, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'A browser role can call the draft character save RPC';
  END IF;

  BEGIN
    PERFORM public.save_dubbing_project_editor_with_characters(
      v_editor, v_request, NULL, NULL, v_project, '[]', v_cast, v_drafts
    );
    RAISE EXCEPTION 'A non-admin actor saved draft characters';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    PERFORM public.save_dubbing_project_editor_with_characters(
      v_admin, v_request, NULL, NULL, v_project, '[]', '[]', v_drafts
    );
    RAISE EXCEPTION 'An unassigned draft was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  BEGIN
    PERFORM public.save_dubbing_project_editor_with_characters(
      v_admin, v_request, NULL, NULL, v_project, '[]',
      jsonb_set(v_cast, '{1,voice_actor_id}', '563701199'), v_drafts
    );
    RAISE EXCEPTION 'A cast with a missing voice actor was saved';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  IF EXISTS (SELECT 1 FROM public.game_characters WHERE igdb_game_id = 563701001)
     OR EXISTS (SELECT 1 FROM public.dubbing_projects WHERE content_id = 563701001)
     OR EXISTS (SELECT 1 FROM public.audit_logs WHERE user_id = v_admin) THEN
    RAISE EXCEPTION 'A rejected save left a character, project, or audit entry behind';
  END IF;

  SELECT * INTO STRICT v_saved FROM public.save_dubbing_project_editor_with_characters(
    v_admin, v_request, NULL, NULL, v_project, '[]', v_cast, v_drafts
  );
  SELECT id INTO STRICT v_character_id FROM public.game_characters
  WHERE igdb_game_id = 563701001 AND name = 'Draft Role' AND created_by = v_admin;
  IF v_saved.replayed OR (SELECT count(*) FROM public.work
    WHERE dubbing_project_id = v_saved.project_id AND game_character_id = v_character_id
      AND character_id IS NULL AND voice_actor_id IN (563701101, 563701102)) <> 2 THEN
    RAISE EXCEPTION 'Both cast rows must reference the single saved character';
  END IF;

  SELECT * INTO STRICT v_retry FROM public.save_dubbing_project_editor_with_characters(
    v_admin, v_request, NULL, NULL, v_project, '[]', v_cast, v_drafts
  );
  IF NOT v_retry.replayed OR v_retry.audit_log_id IS DISTINCT FROM v_saved.audit_log_id
     OR (SELECT count(*) FROM public.audit_logs WHERE user_id = v_admin) <> 2
     OR (SELECT count(*) FROM public.game_characters WHERE igdb_game_id = 563701001) <> 1 THEN
    RAISE EXCEPTION 'Retry duplicated the save or the character';
  END IF;
END;
$$;
ROLLBACK;
