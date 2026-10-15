-- Run in a disposable local database after the main schema and
-- 20261015124627_controlled_studio_writes.sql. This transaction leaves no data.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout = '30s';

INSERT INTO auth.users (id, raw_app_meta_data) VALUES
  ('00000000-0000-0000-0000-000000563651', '{"role":"admin"}'::JSONB),
  ('00000000-0000-0000-0000-000000563652', '{"role":"editor"}'::JSONB);

INSERT INTO public.voice_actors (id, firstname, lastname) VALUES
  (563651001, 'Project Save', 'One'),
  (563651002, 'Project Save', 'Two'),
  (563651003, 'Project Save', 'Three');

INSERT INTO public.jobs (id, name) VALUES
  (1, 'Artistic Director'), (2, 'Adaptation'), (3, 'Recording'),
  (4, 'Editing'), (5, 'Mixing'), (6, 'Project Manager'), (7, 'Creative Supervision')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.studios (name) VALUES ('Project Save Fixture');

SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.save_dubbing_project_editor(
      '00000000-0000-0000-0000-000000563651',
      '01000000-0000-4000-8000-000000563651', NULL, NULL,
      '{}'::JSONB, '[]'::JSONB, '[]'::JSONB
    );
    RAISE EXCEPTION 'anon unexpectedly executed the controlled project save';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.save_dubbing_project_editor(
      '00000000-0000-0000-0000-000000563652',
      '02000000-0000-4000-8000-000000563652', NULL, NULL,
      '{}'::JSONB, '[]'::JSONB, '[]'::JSONB
    );
    RAISE EXCEPTION 'authenticated unexpectedly executed the service-only RPC';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.dubbing_projects (content_id, content_type, language)
    VALUES (563651901, 'movie', 'fr-FR');
    RAISE EXCEPTION 'authenticated unexpectedly wrote a project directly';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.dubbing_project_crew (dubbing_project_id, job_id, person_id)
    VALUES (1, 1, 563651001);
    RAISE EXCEPTION 'authenticated unexpectedly wrote crew directly';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;
RESET ROLE;

SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_admin UUID := '00000000-0000-0000-0000-000000563651';
  v_editor UUID := '00000000-0000-0000-0000-000000563652';
  v_create_request UUID := '10000000-0000-4000-8000-000000563651';
  v_update_request UUID := '10000000-0000-4000-8000-000000563652';
  v_project_id BIGINT;
  v_project_updated_at TIMESTAMP WITHOUT TIME ZONE;
  v_initial_updated_at TIMESTAMP WITHOUT TIME ZONE;
  v_audit_id UUID;
  v_replayed BOOLEAN;
  v_retry_audit_id UUID;
  v_work_one public.work%ROWTYPE;
  v_work_two public.work%ROWTYPE;
  v_cross_project_id BIGINT;
  v_cross_project_updated_at TIMESTAMP WITHOUT TIME ZONE;
  v_other_audit_id UUID;
  v_process_project_id BIGINT;
  v_process_audit_id UUID;
  v_count INTEGER;
BEGIN
  -- A service-role caller still has to identify a current database administrator.
  BEGIN
    PERFORM * FROM public.save_dubbing_project_editor(
      v_editor, '11000000-0000-4000-8000-000000563651', NULL, NULL,
      jsonb_build_object(
        'content_id', 563651910, 'content_type', 'movie', 'language', 'fr-FR',
        'studio_id', NULL, 'status', 'draft'
      ), '[]'::JSONB, '[]'::JSONB
    );
    RAISE EXCEPTION 'non-admin actor unexpectedly saved a project';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  -- Create one movie project with two distinct free-text roles for one actor.
  SELECT result.project_id, result.updated_at, result.audit_log_id, result.replayed
  INTO v_project_id, v_initial_updated_at, v_audit_id, v_replayed
  FROM public.save_dubbing_project_editor(
    v_admin, v_create_request, NULL, NULL,
    jsonb_build_object(
      'content_id', 563651911, 'content_type', 'movie', 'language', 'fr-FR',
      'studio_id', NULL, 'status', 'draft'
    ),
    jsonb_build_array(jsonb_build_object('job_id', 1, 'person_id', 563651001)),
    jsonb_build_array(
      jsonb_build_object(
        'actor_id', 563651101, 'character_name', 'Rôle: Pilote',
        'voice_actor_id', 563651001, 'performance', 'dialogues',
        'note', 'Free text survives', 'highlight', FALSE
      ),
      jsonb_build_object(
        'actor_id', 563651101, 'character_name', 'Rôle: Capitaine',
        'voice_actor_id', 563651001, 'performance', 'singing',
        'note', NULL, 'highlight', TRUE
      )
    )
  ) AS result;

  IF v_project_id IS NULL OR v_audit_id IS NULL OR v_replayed THEN
    RAISE EXCEPTION 'authorized project creation returned an invalid result';
  END IF;
  IF (SELECT count(*) FROM public.dubbing_project_crew
      WHERE dubbing_project_id = v_project_id AND job_id = 1 AND person_id = 563651001) <> 1
     OR (SELECT count(*) FROM public.work WHERE dubbing_project_id = v_project_id) <> 2 THEN
    RAISE EXCEPTION 'project creation did not persist its crew and both distinct cast roles';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.audit_logs AS audit
  WHERE audit.id = v_audit_id
    AND audit.user_id = v_admin
    AND audit.entity_type = 'dubbing_project'
    AND audit.entity_id = v_project_id::TEXT
    AND audit.action = 'create'
    AND audit.request_id = v_create_request
    AND audit.request_fingerprint IS NOT NULL
    AND audit.metadata ->> 'source' = 'save_dubbing_project_editor'
    AND audit.metadata ->> 'media_type' = 'movie'
    AND audit.metadata ->> 'transaction_id' IS NOT NULL
    AND audit.previous_value -> 'project' = 'null'::JSONB
    AND audit.previous_value -> 'crew' = '[]'::JSONB
    AND audit.previous_value -> 'cast' = '[]'::JSONB
    AND jsonb_typeof(audit.new_value -> 'project' -> 'content_id') = 'number'
    AND jsonb_typeof(audit.new_value -> 'project' -> 'created_at') = 'string'
    AND jsonb_array_length(audit.new_value -> 'crew') = 1
    AND jsonb_array_length(audit.new_value -> 'cast') = 2
    AND audit.new_value -> 'cast' @> '[{"character_name":"Rôle: Pilote","performance":"dialogues"}]'::JSONB
    AND audit.new_value -> 'cast' @> '[{"character_name":"Rôle: Capitaine","performance":"singing"}]'::JSONB
    AND audit.changed_fields @> ARRAY['project', 'crew', 'cast']::TEXT[];
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'create audit lacks actor, request, typed snapshots, or role distinctions';
  END IF;

  -- An identical retry returns the original event and does not duplicate rows.
  SELECT result.audit_log_id, result.replayed
  INTO v_retry_audit_id, v_replayed
  FROM public.save_dubbing_project_editor(
    v_admin, v_create_request, NULL, NULL,
    jsonb_build_object(
      'content_id', 563651911, 'content_type', 'movie', 'language', 'fr-FR',
      'studio_id', NULL, 'status', 'draft'
    ),
    jsonb_build_array(jsonb_build_object('job_id', 1, 'person_id', 563651001)),
    jsonb_build_array(
      jsonb_build_object(
        'actor_id', 563651101, 'character_name', 'Rôle: Pilote',
        'voice_actor_id', 563651001, 'performance', 'dialogues',
        'note', 'Free text survives', 'highlight', FALSE
      ),
      jsonb_build_object(
        'actor_id', 563651101, 'character_name', 'Rôle: Capitaine',
        'voice_actor_id', 563651001, 'performance', 'singing',
        'note', NULL, 'highlight', TRUE
      )
    )
  ) AS result;
  IF v_retry_audit_id IS DISTINCT FROM v_audit_id OR NOT v_replayed
     OR (SELECT count(*) FROM public.work WHERE dubbing_project_id = v_project_id) <> 2
     OR (SELECT count(*) FROM public.audit_logs WHERE request_id = v_create_request) <> 1 THEN
    RAISE EXCEPTION 'identical project retry created duplicate effects';
  END IF;

  -- A retry cannot report the old save as current after its cast was changed.
  UPDATE public.work
  SET note = 'Changed after the original save'
  WHERE dubbing_project_id = v_project_id AND character_name = 'Rôle: Pilote';
  BEGIN
    PERFORM * FROM public.save_dubbing_project_editor(
      v_admin, v_create_request, NULL, NULL,
      jsonb_build_object(
        'content_id', 563651911, 'content_type', 'movie', 'language', 'fr-FR',
        'studio_id', NULL, 'status', 'draft'
      ),
      jsonb_build_array(jsonb_build_object('job_id', 1, 'person_id', 563651001)),
      jsonb_build_array(
        jsonb_build_object(
          'actor_id', 563651101, 'character_name', 'Rôle: Pilote',
          'voice_actor_id', 563651001, 'performance', 'dialogues',
          'note', 'Free text survives', 'highlight', FALSE
        ),
        jsonb_build_object(
          'actor_id', 563651101, 'character_name', 'Rôle: Capitaine',
          'voice_actor_id', 563651001, 'performance', 'singing',
          'note', NULL, 'highlight', TRUE
        )
      )
    );
    RAISE EXCEPTION 'stale project retry unexpectedly succeeded';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    NULL;
  END;

  -- Updating project metadata, crew, and cast is one event and one transaction.
  SELECT work.* INTO v_work_one
  FROM public.work AS work
  WHERE work.dubbing_project_id = v_project_id AND work.character_name = 'Rôle: Pilote';
  SELECT work.* INTO v_work_two
  FROM public.work AS work
  WHERE work.dubbing_project_id = v_project_id AND work.character_name = 'Rôle: Capitaine';

  SELECT result.updated_at, result.audit_log_id, result.replayed
  INTO v_project_updated_at, v_other_audit_id, v_replayed
  FROM public.save_dubbing_project_editor(
    v_admin, v_update_request, v_project_id, v_initial_updated_at,
    jsonb_build_object(
      'content_id', 563651911, 'content_type', 'movie', 'language', 'fr-CA',
      'studio_id', (SELECT studio.id FROM public.studios AS studio WHERE studio.name = 'Project Save Fixture'),
      'status', 'validated'
    ),
    jsonb_build_array(
      jsonb_build_object('job_id', 1, 'person_id', 563651002),
      jsonb_build_object('job_id', 3, 'person_id', 563651001)
    ),
    jsonb_build_array(
      jsonb_build_object(
        'id', v_work_one.id,
        'expected_updated_at', v_work_one.updated_at,
        'expected', jsonb_build_object(
          'actor_id', v_work_one.actor_id, 'character_id', v_work_one.character_id,
          'character_name', v_work_one.character_name, 'voice_actor_id', v_work_one.voice_actor_id,
          'performance', v_work_one.performance, 'note', v_work_one.note,
          'highlight', v_work_one.highlight, 'status', v_work_one.status
        ),
        'voice_actor_id', 563651002, 'character_name', 'Rôle: Navigateur'
      ),
      jsonb_build_object(
        'id', v_work_two.id,
        'expected_updated_at', v_work_two.updated_at,
        'expected', jsonb_build_object(
          'actor_id', v_work_two.actor_id, 'character_id', v_work_two.character_id,
          'character_name', v_work_two.character_name, 'voice_actor_id', v_work_two.voice_actor_id,
          'performance', v_work_two.performance, 'note', v_work_two.note,
          'highlight', v_work_two.highlight, 'status', v_work_two.status
        ),
        'note', 'Updated without replacing role identity'
      )
    )
  ) AS result;
  IF v_other_audit_id IS NULL OR v_replayed OR v_project_updated_at IS NULL THEN
    RAISE EXCEPTION 'authorized project edit returned an invalid result';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.dubbing_projects AS project
    WHERE project.id = v_project_id AND project.language = 'fr-CA'
      AND project.status = 'validated'
      AND project.studio_id = (SELECT studio.id FROM public.studios AS studio WHERE studio.name = 'Project Save Fixture')
  ) OR NOT EXISTS (
    SELECT 1 FROM public.dubbing_project_crew AS crew
    WHERE crew.dubbing_project_id = v_project_id AND crew.job_id = 1 AND crew.person_id = 563651002
  ) OR NOT EXISTS (
    SELECT 1 FROM public.dubbing_project_crew AS crew
    WHERE crew.dubbing_project_id = v_project_id AND crew.job_id = 3 AND crew.person_id = 563651001
  ) OR NOT EXISTS (
    SELECT 1 FROM public.work AS work
    WHERE work.id = v_work_one.id AND work.voice_actor_id = 563651002
      AND work.character_name = 'Rôle: Navigateur' AND work.performance = 'dialogues'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.work AS work
    WHERE work.id = v_work_two.id AND work.voice_actor_id = 563651001
      AND work.character_name = 'Rôle: Capitaine'
      AND work.note = 'Updated without replacing role identity'
  ) THEN
    RAISE EXCEPTION 'project edit lost a project, crew, cast, or role distinction';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.audit_logs AS audit
  WHERE audit.id = v_other_audit_id
    AND audit.user_id = v_admin
    AND audit.entity_type = 'dubbing_project'
    AND audit.entity_id = v_project_id::TEXT
    AND audit.action = 'update'
    AND audit.request_id = v_update_request
    AND audit.previous_value -> 'project' ->> 'language' = 'fr-FR'
    AND audit.new_value -> 'project' ->> 'language' = 'fr-CA'
    AND jsonb_array_length(audit.previous_value -> 'crew') = 1
    AND jsonb_array_length(audit.new_value -> 'crew') = 2
    AND audit.previous_value -> 'cast' @> jsonb_build_array(jsonb_build_object('id', v_work_one.id, 'character_name', 'Rôle: Pilote'))
    AND audit.new_value -> 'cast' @> jsonb_build_array(jsonb_build_object('id', v_work_one.id, 'character_name', 'Rôle: Navigateur'))
    AND jsonb_typeof(audit.new_value -> 'cast' -> 0 -> 'id') = 'number'
    AND audit.changed_fields @> ARRAY['project', 'crew', 'cast']::TEXT[];
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'update audit does not contain valid before/after project, crew, and cast snapshots';
  END IF;

  -- A request ID cannot be reused for different data, and a stale project version fails.
  BEGIN
    PERFORM * FROM public.save_dubbing_project_editor(
      v_admin, v_create_request, v_project_id, v_initial_updated_at,
      jsonb_build_object(
        'content_id', 563651911, 'content_type', 'movie', 'language', 'fr-CA',
        'studio_id', NULL, 'status', 'draft'
      ), '[]'::JSONB, '[]'::JSONB
    );
    RAISE EXCEPTION 'request id was reused with different project data';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
  BEGIN
    PERFORM * FROM public.save_dubbing_project_editor(
      v_admin, '11000000-0000-4000-8000-000000563653', v_project_id, v_initial_updated_at,
      jsonb_build_object(
        'content_id', 563651911, 'content_type', 'movie', 'language', 'fr-FR',
        'studio_id', NULL, 'status', 'draft'
      ), '[]'::JSONB, '[]'::JSONB
    );
    RAISE EXCEPTION 'stale project version was accepted';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    NULL;
  END;
  BEGIN
    PERFORM * FROM public.save_dubbing_project_editor(
      v_admin, '11000000-0000-4000-8000-000000563654', 999999999, NULL,
      jsonb_build_object(
        'content_id', 563651911, 'content_type', 'movie', 'language', 'fr-FR',
        'studio_id', NULL, 'status', 'draft'
      ), '[]'::JSONB, '[]'::JSONB
    );
    RAISE EXCEPTION 'unrelated project id was accepted';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    NULL;
  END;

  -- A second editor cannot submit a work ID from another project.
  SELECT result.project_id, result.updated_at INTO v_cross_project_id, v_cross_project_updated_at
  FROM public.save_dubbing_project_editor(
    v_admin, '12000000-0000-4000-8000-000000563651', NULL, NULL,
    jsonb_build_object(
      'content_id', 563651912, 'content_type', 'movie', 'language', 'fr-FR',
      'studio_id', NULL, 'status', 'draft'
    ), '[]'::JSONB, '[]'::JSONB
  ) AS result;
  BEGIN
    PERFORM * FROM public.save_dubbing_project_editor(
      v_admin, '12000000-0000-4000-8000-000000563652', v_cross_project_id, v_cross_project_updated_at,
      jsonb_build_object(
        'content_id', 563651912, 'content_type', 'movie', 'language', 'fr-FR',
        'studio_id', NULL, 'status', 'draft'
      ), '[]'::JSONB,
      jsonb_build_array(jsonb_build_object(
        'id', v_work_one.id,
        'expected_updated_at', v_work_one.updated_at,
        'expected', jsonb_build_object(
          'actor_id', v_work_one.actor_id, 'character_id', v_work_one.character_id,
          'character_name', v_work_one.character_name, 'voice_actor_id', v_work_one.voice_actor_id,
          'performance', v_work_one.performance, 'note', v_work_one.note,
          'highlight', v_work_one.highlight, 'status', v_work_one.status
        ),
        'character_name', 'Cross-project overwrite'
      ))
    );
    RAISE EXCEPTION 'cross-project cast ID was accepted';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    NULL;
  END;

  -- SQL-level validation rejects invalid languages, protected fields, and references.
  BEGIN
    PERFORM * FROM public.save_dubbing_project_editor(
      v_admin, '13000000-0000-4000-8000-000000563651', NULL, NULL,
      jsonb_build_object(
        'content_id', 563651913, 'content_type', 'movie', 'language', 'xx-ZZ',
        'studio_id', NULL, 'status', 'draft'
      ), '[]'::JSONB, '[]'::JSONB
    );
    RAISE EXCEPTION 'unsupported language was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN
    NULL;
  END;
  BEGIN
    PERFORM * FROM public.save_dubbing_project_editor(
      v_admin, '13000000-0000-4000-8000-000000563652', NULL, NULL,
      jsonb_build_object(
        'content_id', 563651914, 'content_type', 'movie', 'language', 'fr-FR',
        'studio_id', NULL, 'status', 'draft', 'updated_at', 'client-value'
      ), '[]'::JSONB, '[]'::JSONB
    );
    RAISE EXCEPTION 'protected project field was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN
    NULL;
  END;
  BEGIN
    PERFORM * FROM public.save_dubbing_project_editor(
      v_admin, '13000000-0000-4000-8000-000000563653', NULL, NULL,
      jsonb_build_object(
        'content_id', 563651915, 'content_type', 'movie', 'language', 'fr-FR',
        'studio_id', NULL, 'status', 'draft'
      ), jsonb_build_array(jsonb_build_object('job_id', 1, 'person_id', 999999999)), '[]'::JSONB
    );
    RAISE EXCEPTION 'unknown crew person was accepted';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;
  BEGIN
    PERFORM * FROM public.save_dubbing_project_editor(
      v_admin, '13000000-0000-4000-8000-000000563654', NULL, NULL,
      jsonb_build_object(
        'content_id', 563651916, 'content_type', 'movie', 'language', 'fr-FR',
        'studio_id', NULL, 'status', 'draft'
      ), '[]'::JSONB,
      jsonb_build_array(jsonb_build_object('voice_actor_id', 999999999, 'character_name', 'Unknown'))
    );
    RAISE EXCEPTION 'unknown cast voice actor was accepted';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;
  BEGIN
    PERFORM * FROM public.save_dubbing_project_editor(
      v_admin, '13000000-0000-4000-8000-000000563655', v_project_id, v_project_updated_at,
      jsonb_build_object(
        'content_id', 563651911, 'content_type', 'movie', 'language', 'fr-CA',
        'studio_id', NULL, 'status', 'validated'
      ), '[]'::JSONB,
      jsonb_build_array(jsonb_build_object('id', v_work_one.id, 'status', 'reviewed'))
    );
    RAISE EXCEPTION 'protected cast status was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN
    NULL;
  END;

  -- Game character IDs and free-text names are both retained in snapshots.
  SELECT result.project_id, result.audit_log_id INTO v_cross_project_id, v_other_audit_id
  FROM public.save_dubbing_project_editor(
    v_admin, '14000000-0000-4000-8000-000000563651', NULL, NULL,
    jsonb_build_object(
      'content_id', 563651917, 'content_type', 'video_game', 'language', 'fr-FR',
      'studio_id', NULL, 'status', 'validated'
    ), '[]'::JSONB,
    jsonb_build_array(jsonb_build_object(
      'character_id', 563651301, 'character_name', 'Joueur libre',
      'voice_actor_id', 563651003, 'performance', 'dialogues'
    ))
  ) AS result;
  IF NOT EXISTS (
    SELECT 1 FROM public.work WHERE dubbing_project_id = v_cross_project_id
      AND character_id = 563651301 AND character_name = 'Joueur libre'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.audit_logs AS audit WHERE audit.id = v_other_audit_id
      AND jsonb_typeof(audit.new_value -> 'cast' -> 0 -> 'character_id') = 'number'
      AND audit.new_value -> 'cast' -> 0 ->> 'character_name' = 'Joueur libre'
  ) THEN
    RAISE EXCEPTION 'game character ID or free-text character name was lost';
  END IF;

  -- Existing service-role project DML is blocked; the regional RPC remains callable.
  BEGIN
    UPDATE public.dubbing_projects SET status = 'draft' WHERE id = v_project_id;
    RAISE EXCEPTION 'service_role unexpectedly changed a project directly';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    UPDATE public.dubbing_projects SET status = 'draft' WHERE id = v_project_id
      /* save_regional_project_actor_assignments() */;
    RAISE EXCEPTION 'a comment bypassed the controlled-write guard';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    TRUNCATE TABLE public.dubbing_projects CASCADE;
    RAISE EXCEPTION 'service_role unexpectedly truncated controlled project records';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF (SELECT count(*) FROM public.audit_logs WHERE user_id = v_admin) <> 4 THEN
    RAISE EXCEPTION 'rejected requests or idempotent retries wrote unexpected audit events';
  END IF;

  SELECT result.project_id, result.audit_log_id
  INTO v_process_project_id, v_process_audit_id
  FROM public.find_or_create_dubbing_project(
    v_admin, NULL, '19000000-0000-4000-8000-000000563651',
    563651919, 'movie', 'fr-FR'
  ) AS result;
  IF v_process_project_id IS NULL OR v_process_audit_id IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM public.audit_logs
       WHERE id = v_process_audit_id
         AND user_id = v_admin
         AND entity_id = v_process_project_id::TEXT
         AND metadata ->> 'source' = 'find_or_create_dubbing_project'
         AND metadata -> 'voice_actor_id' = 'null'::JSONB
     ) THEN
    RAISE EXCEPTION 'admin credit-import project creation was not audited';
  END IF;
END;
$$;
RESET ROLE;

-- Inject write failures at each stage; the surrounding RPC must roll back all rows.
CREATE OR REPLACE FUNCTION public.test_fail_project_save_write()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.test_fail_project_save_' || TG_TABLE_NAME, TRUE) = 'true' THEN
    RAISE EXCEPTION 'injected project save mutation failure';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
CREATE TRIGGER test_fail_project_save_write
  BEFORE INSERT OR UPDATE ON public.dubbing_projects
  FOR EACH ROW EXECUTE FUNCTION public.test_fail_project_save_write();
CREATE TRIGGER test_fail_crew_save_write
  BEFORE INSERT OR DELETE ON public.dubbing_project_crew
  FOR EACH ROW EXECUTE FUNCTION public.test_fail_project_save_write();
CREATE TRIGGER test_fail_work_save_write
  BEFORE INSERT OR UPDATE ON public.work
  FOR EACH ROW EXECUTE FUNCTION public.test_fail_project_save_write();
CREATE TRIGGER test_fail_audit_save_write
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.test_fail_project_save_write();

SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_admin UUID := '00000000-0000-0000-0000-000000563651';
  v_request UUID;
  v_failed BOOLEAN;
  v_project_id BIGINT;
  v_work_id BIGINT;
  v_project_updated_at TIMESTAMP WITHOUT TIME ZONE;
BEGIN
  FOR v_request IN
    SELECT unnest(ARRAY[
      '21000000-0000-4000-8000-000000563651'::UUID,
      '21000000-0000-4000-8000-000000563652'::UUID,
      '21000000-0000-4000-8000-000000563653'::UUID,
      '21000000-0000-4000-8000-000000563654'::UUID
    ])
  LOOP
    PERFORM set_config(
      'app.test_fail_project_save_' || CASE v_request
        WHEN '21000000-0000-4000-8000-000000563651'::UUID THEN 'dubbing_projects'
        WHEN '21000000-0000-4000-8000-000000563652'::UUID THEN 'dubbing_project_crew'
        WHEN '21000000-0000-4000-8000-000000563653'::UUID THEN 'work'
        ELSE 'audit_logs' END,
      'true', TRUE
    );
    v_failed := FALSE;
    BEGIN
      IF v_request = '21000000-0000-4000-8000-000000563651' THEN
        PERFORM * FROM public.save_dubbing_project_editor(
          v_admin, v_request, NULL, NULL,
          jsonb_build_object(
            'content_id', 563651920, 'content_type', 'movie', 'language', 'fr-FR',
            'studio_id', NULL, 'status', 'draft'
          ), '[]'::JSONB, '[]'::JSONB
        );
      ELSIF v_request = '21000000-0000-4000-8000-000000563652' THEN
        PERFORM * FROM public.save_dubbing_project_editor(
          v_admin, v_request, NULL, NULL,
          jsonb_build_object(
            'content_id', 563651921, 'content_type', 'movie', 'language', 'fr-FR',
            'studio_id', NULL, 'status', 'draft'
          ),
          jsonb_build_array(jsonb_build_object('job_id', 1, 'person_id', 563651001)), '[]'::JSONB
        );
      ELSIF v_request = '21000000-0000-4000-8000-000000563653' THEN
        PERFORM * FROM public.save_dubbing_project_editor(
          v_admin, v_request, NULL, NULL,
          jsonb_build_object(
            'content_id', 563651922, 'content_type', 'movie', 'language', 'fr-FR',
            'studio_id', NULL, 'status', 'draft'
          ), '[]'::JSONB,
          jsonb_build_array(jsonb_build_object(
            'voice_actor_id', 563651001, 'character_name', 'Injected work failure'
          ))
        );
      ELSE
        PERFORM * FROM public.save_dubbing_project_editor(
          v_admin, v_request, NULL, NULL,
          jsonb_build_object(
            'content_id', 563651923, 'content_type', 'movie', 'language', 'fr-FR',
            'studio_id', NULL, 'status', 'draft'
          ),
          jsonb_build_array(jsonb_build_object('job_id', 1, 'person_id', 563651001)),
          jsonb_build_array(jsonb_build_object(
            'voice_actor_id', 563651001, 'character_name', 'Injected audit failure'
          ))
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_failed := TRUE;
    END;
    PERFORM set_config(
      'app.test_fail_project_save_' || CASE v_request
        WHEN '21000000-0000-4000-8000-000000563651'::UUID THEN 'dubbing_projects'
        WHEN '21000000-0000-4000-8000-000000563652'::UUID THEN 'dubbing_project_crew'
        WHEN '21000000-0000-4000-8000-000000563653'::UUID THEN 'work'
        ELSE 'audit_logs' END,
      'false', TRUE
    );
    IF NOT v_failed THEN
      RAISE EXCEPTION 'injected project/crew/cast/audit failure did not fail the operation';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.dubbing_projects
      WHERE content_id = CASE v_request
        WHEN '21000000-0000-4000-8000-000000563651'::UUID THEN 563651920
        WHEN '21000000-0000-4000-8000-000000563652'::UUID THEN 563651921
        WHEN '21000000-0000-4000-8000-000000563653'::UUID THEN 563651922
        ELSE 563651923 END
        AND content_type = 'movie'
    ) OR EXISTS (SELECT 1 FROM public.audit_logs WHERE request_id = v_request) THEN
      RAISE EXCEPTION 'a failed project save left a project or audit event behind';
    END IF;
  END LOOP;

  SELECT project.id, project.updated_at INTO v_project_id, v_project_updated_at
  FROM public.dubbing_projects AS project
  WHERE project.content_id = 563651911 AND project.content_type = 'movie';
  SELECT work.id INTO v_work_id FROM public.work AS work
  WHERE work.dubbing_project_id = v_project_id AND work.character_name = 'Rôle: Navigateur';

  -- A failed crew deletion must preserve project, crew, cast, and audit history.
  PERFORM set_config('app.test_fail_project_save_dubbing_project_crew', 'true', TRUE);
  v_failed := FALSE;
  BEGIN
    PERFORM * FROM public.save_dubbing_project_editor(
      v_admin, '22000000-0000-4000-8000-000000563651', v_project_id, v_project_updated_at,
      jsonb_build_object(
        'content_id', 563651911, 'content_type', 'movie', 'language', 'fr-FR',
        'studio_id', NULL, 'status', 'draft'
      ), '[]'::JSONB,
      jsonb_build_array(jsonb_build_object(
        'id', v_work_id,
        'expected_updated_at', (SELECT work.updated_at FROM public.work AS work WHERE work.id = v_work_id),
        'expected', (SELECT jsonb_build_object(
          'actor_id', work.actor_id, 'character_id', work.character_id,
          'character_name', work.character_name, 'voice_actor_id', work.voice_actor_id,
          'performance', work.performance, 'note', work.note,
          'highlight', work.highlight, 'status', work.status
        ) FROM public.work AS work WHERE work.id = v_work_id),
        'character_name', 'Delete rollback fixture'
      ))
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := TRUE;
  END;
  PERFORM set_config('app.test_fail_project_save_dubbing_project_crew', 'false', TRUE);
  IF NOT v_failed
     OR NOT EXISTS (SELECT 1 FROM public.dubbing_project_crew WHERE dubbing_project_id = v_project_id AND job_id = 1)
     OR NOT EXISTS (SELECT 1 FROM public.work WHERE id = v_work_id AND character_name = 'Rôle: Navigateur')
     OR NOT EXISTS (SELECT 1 FROM public.dubbing_projects WHERE id = v_project_id
       AND language = 'fr-CA' AND status = 'validated' AND updated_at = v_project_updated_at)
     OR (SELECT count(*) FROM public.audit_logs WHERE entity_id = v_project_id::TEXT) <> 2 THEN
    RAISE EXCEPTION 'failed crew deletion was not rolled back with all related state';
  END IF;
END;
$$;
RESET ROLE;

SET LOCAL ROLE service_role;
SELECT public.save_regional_project_actor_assignments(
  563651918, 'movie', 'fr-FR',
  jsonb_build_array(jsonb_build_object(
    'actor_id', 563651102, 'work_id', NULL,
    'expected_voice_actor_id', NULL, 'voice_actor_id', 563651003
  ))
);
RESET ROLE;

-- A role with table grants still cannot change or delete immutable audit history.
CREATE ROLE project_save_audit_probe NOLOGIN;
GRANT project_save_audit_probe TO postgres;
GRANT SELECT, UPDATE, DELETE ON public.audit_logs TO project_save_audit_probe;
CREATE POLICY "Temporary project-save audit probe" ON public.audit_logs
  FOR ALL TO project_save_audit_probe USING (TRUE) WITH CHECK (TRUE);
SET LOCAL ROLE project_save_audit_probe;
DO $$
DECLARE
  v_audit_id UUID;
  v_snapshot JSONB;
BEGIN
  SELECT id, new_value INTO v_audit_id, v_snapshot
  FROM public.audit_logs
  WHERE request_id = '10000000-0000-4000-8000-000000563652';
  BEGIN
    UPDATE public.audit_logs SET new_value = '{}'::JSONB WHERE id = v_audit_id;
    RAISE EXCEPTION 'audit probe modified an immutable project snapshot';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    NULL;
  END;
  BEGIN
    DELETE FROM public.audit_logs WHERE id = v_audit_id;
    RAISE EXCEPTION 'audit probe deleted immutable project history';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    NULL;
  END;
  IF (SELECT new_value FROM public.audit_logs WHERE id = v_audit_id) IS DISTINCT FROM v_snapshot THEN
    RAISE EXCEPTION 'audit probe changed a committed project snapshot';
  END IF;
END;
$$;
RESET ROLE;

ROLLBACK;
