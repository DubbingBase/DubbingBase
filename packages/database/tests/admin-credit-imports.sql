-- Run against an isolated local database after all migrations.
-- The transaction keeps all fixtures and the injected failure constraint local.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.work
  ADD CONSTRAINT test_admin_credit_import_failure
  CHECK (character_name IS DISTINCT FROM 'Injected failure') NOT VALID;

DO $$
DECLARE
  v_admin_id UUID := '56368400-0000-4000-8000-000000000001';
  v_non_admin_id UUID := '56368400-0000-4000-8000-000000000002';
  v_request_id UUID := '56368400-0000-4000-8000-000000000011';
  v_updated_request_id UUID := '56368400-0000-4000-8000-000000000012';
  v_distinct_request_id UUID := '56368400-0000-4000-8000-000000000013';
  v_failure_request_id UUID := '56368400-0000-4000-8000-000000000014';
  v_existing_project_failure_request_id UUID := '56368400-0000-4000-8000-000000000015';
  v_first RECORD;
  v_replay RECORD;
  v_updated RECORD;
  v_distinct RECORD;
  v_unrelated_before JSONB;
  v_unrelated_after JSONB;
  v_unrelated_work_id BIGINT;
  v_voice_actor_count BIGINT;
  v_work_count BIGINT;
  v_project_count BIGINT;
  v_denial_observed BOOLEAN := FALSE;
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id IN (v_admin_id, v_non_admin_id)) THEN
    RAISE EXCEPTION 'Admin credit import fixture IDs are already in use';
  END IF;

  INSERT INTO auth.users (id, raw_app_meta_data)
  VALUES
    (v_admin_id, '{"role":"admin"}'::JSONB),
    (v_non_admin_id, '{"role":"user"}'::JSONB);

  IF NOT has_function_privilege(
       'service_role',
       'public.save_admin_credit_import(uuid, uuid, bigint, text, text, bigint, text, text, bigint, bigint, text)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'anon',
       'public.save_admin_credit_import(uuid, uuid, bigint, text, text, bigint, text, text, bigint, bigint, text)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'authenticated',
       'public.save_admin_credit_import(uuid, uuid, bigint, text, text, bigint, text, text, bigint, bigint, text)',
       'EXECUTE'
     )
     OR has_table_privilege(
       'service_role', 'private.admin_credit_import_requests', 'SELECT'
     ) THEN
    RAISE EXCEPTION 'Admin credit import permissions are too broad or missing';
  END IF;

  BEGIN
    PERFORM * FROM public.save_admin_credit_import(
      v_non_admin_id, v_request_id, 563684101, 'movie', 'en-US',
      NULL, 'Atomic', 'Non Admin', NULL, NULL, 'Rejected Role'
    );
    RAISE EXCEPTION 'Non-admin was allowed to import credits';
  EXCEPTION WHEN insufficient_privilege THEN
    v_denial_observed := TRUE;
  END;
  IF NOT v_denial_observed THEN
    RAISE EXCEPTION 'Non-admin denial was not observed';
  END IF;

  SELECT result.* INTO v_first
  FROM public.save_admin_credit_import(
    v_admin_id, v_request_id, 563684101, 'movie', 'en-US',
    NULL, 'Atomic', 'Importer', NULL, NULL, 'Role One'
  ) AS result;
  IF v_first.replayed IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'First import was unexpectedly reported as a replay';
  END IF;

  SELECT work.* INTO STRICT v_replay
  FROM public.work AS work
  WHERE work.id = v_first.work_id;
  IF v_replay.voice_actor_id IS DISTINCT FROM v_first.voice_actor_id
     OR v_replay.character_id IS NOT NULL
     OR v_replay.character_name IS DISTINCT FROM 'Role One'
     OR v_replay.performance IS DISTINCT FROM 'dialogues'
     OR v_replay.status IS DISTINCT FROM 'validated' THEN
    RAISE EXCEPTION 'Imported work fields were not preserved';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_logs AS audit
    WHERE audit.id = v_first.audit_log_id
      AND audit.user_id = v_admin_id
      AND audit.entity_type = 'work'
      AND audit.entity_id = v_first.work_id::TEXT
      AND audit.action = 'create'
      AND audit.metadata ->> 'import_source' = 'process_credits'
  ) THEN
    RAISE EXCEPTION 'Imported work lacks its controlled audit event';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_logs AS audit
    WHERE audit.user_id = v_admin_id
      AND audit.entity_type = 'voice_actor'
      AND audit.entity_id = v_first.voice_actor_id::TEXT
      AND audit.action = 'create'
  ) THEN
    RAISE EXCEPTION 'New voice actor lacks its controlled audit event';
  END IF;

  SELECT result.* INTO v_replay
  FROM public.save_admin_credit_import(
    v_admin_id, v_request_id, 563684101, 'movie', 'en-US',
    NULL, 'Atomic', 'Importer', NULL, NULL, 'Role One'
  ) AS result;
  IF v_replay.replayed IS DISTINCT FROM TRUE
     OR v_replay.work_id IS DISTINCT FROM v_first.work_id
     OR v_replay.project_id IS DISTINCT FROM v_first.project_id
     OR v_replay.voice_actor_id IS DISTINCT FROM v_first.voice_actor_id
     OR v_replay.audit_log_id IS DISTINCT FROM v_first.audit_log_id THEN
    RAISE EXCEPTION 'Repeated import did not return the original result';
  END IF;

  SELECT count(*) INTO v_work_count
  FROM public.work AS work
  WHERE work.dubbing_project_id = v_first.project_id
    AND work.voice_actor_id = v_first.voice_actor_id;
  SELECT count(*) INTO v_voice_actor_count
  FROM public.voice_actors AS actor
  WHERE actor.id = v_first.voice_actor_id;
  SELECT count(*) INTO v_project_count
  FROM public.dubbing_projects AS project
  WHERE project.id = v_first.project_id;
  IF v_work_count <> 1 OR v_voice_actor_count <> 1 OR v_project_count <> 1 THEN
    RAISE EXCEPTION 'Repeated import created duplicate project, actor, or work rows';
  END IF;

  BEGIN
    PERFORM * FROM public.save_admin_credit_import(
      v_admin_id, v_request_id, 563684101, 'movie', 'en-US',
      NULL, 'Atomic', 'Importer', NULL, NULL, 'Changed Role'
    );
    RAISE EXCEPTION 'A request ID was accepted with changed credit data';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  SELECT result.* INTO v_updated
  FROM public.save_admin_credit_import(
    v_admin_id, v_updated_request_id, 563684101, 'movie', 'en-US',
    v_first.voice_actor_id, NULL, NULL, NULL, NULL, '  role one  '
  ) AS result;
  IF v_updated.work_id IS DISTINCT FROM v_first.work_id
     OR v_updated.replayed IS DISTINCT FROM FALSE
     OR NOT EXISTS (
       SELECT 1 FROM public.work AS work
       WHERE work.id = v_first.work_id
         AND work.character_name = '  role one  '
         AND work.performance = 'dialogues'
         AND work.status = 'validated'
     ) THEN
    RAISE EXCEPTION 'Role-aware matching did not update the existing work row';
  END IF;

  SELECT result.* INTO v_distinct
  FROM public.save_admin_credit_import(
    v_admin_id, v_distinct_request_id, 563684101, 'movie', 'en-US',
    v_first.voice_actor_id, NULL, NULL, NULL, NULL, 'Role Two'
  ) AS result;
  IF v_distinct.work_id = v_first.work_id THEN
    RAISE EXCEPTION 'A distinct role replaced the existing assignment';
  END IF;

  BEGIN
    PERFORM * FROM public.save_admin_credit_import(
      v_admin_id, v_failure_request_id, 563684102, 'movie', 'en-US',
      NULL, 'Atomic', 'Failure', NULL, NULL, 'Injected failure'
    );
    RAISE EXCEPTION 'Injected work constraint failure was not reached';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  IF EXISTS (
       SELECT 1 FROM public.dubbing_projects
       WHERE content_id = 563684102 AND content_type = 'movie' AND language = 'en-US'
     )
     OR EXISTS (
       SELECT 1 FROM public.voice_actors
       WHERE firstname = 'Atomic' AND lastname = 'Failure'
     )
     OR EXISTS (
       SELECT 1 FROM private.admin_credit_import_requests
       WHERE admin_id = v_admin_id AND request_id = v_failure_request_id
     ) THEN
    RAISE EXCEPTION 'Failed first credit left a project, voice actor, or retry record';
  END IF;

  INSERT INTO public.dubbing_projects(content_id, content_type, language)
  VALUES (563684103, 'movie', 'en-US');
  INSERT INTO public.work (
    dubbing_project_id, character_name, performance, status
  )
  SELECT project.id, 'Unrelated Existing', 'voice', 'validated'
  FROM public.dubbing_projects AS project
  WHERE project.content_id = 563684103
    AND project.content_type = 'movie'
    AND project.language = 'en-US'
  RETURNING id INTO v_unrelated_work_id;
  SELECT pg_catalog.to_jsonb(work) INTO v_unrelated_before
  FROM public.work AS work
  WHERE work.id = v_unrelated_work_id;

  BEGIN
    PERFORM * FROM public.save_admin_credit_import(
      v_admin_id, v_existing_project_failure_request_id, 563684103, 'movie', 'en-US',
      NULL, 'Atomic', 'Failure Two', NULL, NULL, 'Injected failure'
    );
    RAISE EXCEPTION 'Injected work constraint failure was not reached for existing project';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  SELECT pg_catalog.to_jsonb(work) INTO v_unrelated_after
  FROM public.work AS work
  WHERE work.id = v_unrelated_work_id;
  IF v_unrelated_after IS DISTINCT FROM v_unrelated_before
     OR EXISTS (
       SELECT 1 FROM public.voice_actors
       WHERE firstname = 'Atomic' AND lastname = 'Failure Two'
     )
     OR EXISTS (
       SELECT 1 FROM private.admin_credit_import_requests
       WHERE admin_id = v_admin_id
         AND request_id = v_existing_project_failure_request_id
     ) THEN
    RAISE EXCEPTION 'Failed credit changed unrelated work or left a new actor/request';
  END IF;
END;
$$;

ROLLBACK;
