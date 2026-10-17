-- Run against an isolated database after
-- 20261015150040_audit_regional_voice_cast_assignments.sql.
-- All fixtures and failpoint triggers are rolled back at the end.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout = '30s';

INSERT INTO auth.users (id, raw_app_meta_data)
VALUES
  ('00000000-0000-4000-8000-000000563661', '{"role":"admin"}'::JSONB),
  ('00000000-0000-4000-8000-000000563662', '{"role":"editor"}'::JSONB);

INSERT INTO public.voice_actors(firstname, lastname)
VALUES ('Regional Audit', 'One') RETURNING id AS va_one \gset
INSERT INTO public.voice_actors(firstname, lastname)
VALUES ('Regional Audit', 'Two') RETURNING id AS va_two \gset
INSERT INTO public.voice_actors(firstname, lastname)
VALUES ('Regional Audit', 'Three') RETURNING id AS va_three \gset

INSERT INTO public.dubbing_projects(content_id, content_type, language, status)
VALUES (999995, 'movie', 'fr-FR', 'validated') RETURNING id AS unrelated_project_id \gset
INSERT INTO public.work(dubbing_project_id, actor_id, voice_actor_id, performance, status)
VALUES (:'unrelated_project_id'::BIGINT, 720002, :'va_one'::BIGINT, 'voice', 'validated')
RETURNING id AS unrelated_work_id \gset

CREATE FUNCTION pg_temp.call_regional_assignment(
  p_content_id BIGINT,
  p_content_type TEXT,
  p_dubbing_language TEXT,
  p_operations JSONB,
  p_request_id UUID,
  p_actor_id UUID DEFAULT '00000000-0000-4000-8000-000000563661'::UUID
)
RETURNS BIGINT
LANGUAGE SQL
AS $test$
  SELECT public.save_regional_project_actor_assignments(
    p_content_id,
    p_content_type,
    p_dubbing_language,
    p_operations,
    p_actor_id,
    p_request_id
  );
$test$;

CREATE FUNCTION public.test_fail_regional_assignment_work()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $test$
BEGIN
  IF pg_catalog.current_setting('test.fail_regional_work', TRUE) = 'on' THEN
    RAISE EXCEPTION 'Injected work mutation failure' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$test$;
CREATE TRIGGER test_fail_regional_assignment_work
  BEFORE INSERT ON public.work
  FOR EACH ROW EXECUTE FUNCTION public.test_fail_regional_assignment_work();

CREATE FUNCTION public.test_fail_regional_assignment_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $test$
BEGIN
  IF pg_catalog.current_setting('test.fail_regional_audit', TRUE) = 'on' THEN
    RAISE EXCEPTION 'Injected audit insertion failure' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$test$;
CREATE TRIGGER test_fail_regional_assignment_audit
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.test_fail_regional_assignment_audit();

SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM public.save_regional_project_actor_assignments(
      999992, 'movie', 'fr-FR', '[]'::JSONB,
      '00000000-0000-4000-8000-000000563661'::UUID,
      '00000000-0000-4000-8000-000000563671'::UUID
    );
    RAISE EXCEPTION 'Anonymous caller executed the controlled RPC';
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
    PERFORM public.save_regional_project_actor_assignments(
      999992, 'movie', 'fr-FR', '[]'::JSONB,
      '00000000-0000-4000-8000-000000563661'::UUID,
      '00000000-0000-4000-8000-000000563671'::UUID
    );
    RAISE EXCEPTION 'Authenticated caller bypassed the server route';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;
RESET ROLE;

SET LOCAL ROLE service_role;
DO $$
BEGIN
  BEGIN
    PERFORM public.save_regional_project_actor_assignments(
      999991, 'movie', 'fr-FR', '[]'::JSONB
    );
    RAISE EXCEPTION 'The legacy RPC wrote without actor or request attribution';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    NULL;
  END;
END;
$$;

SELECT pg_temp.call_regional_assignment(
  999992,
  'movie',
  'fr-FR',
  jsonb_build_array(jsonb_build_object(
    'actor_id', 720001,
    'work_id', NULL,
    'expected_voice_actor_id', NULL,
    'voice_actor_id', :'va_one'::BIGINT
  )),
  '00000000-0000-4000-8000-000000563671'::UUID
) AS main_project_id \gset
DO $$
BEGIN
  BEGIN
    PERFORM pg_temp.call_regional_assignment(
      999992,
      'movie',
      'fr-FR',
      jsonb_build_array(jsonb_build_object(
        'actor_id', 720001,
        'work_id', NULL,
        'expected_voice_actor_id', NULL,
        'voice_actor_id', (SELECT id FROM public.voice_actors WHERE firstname = 'Regional Audit' AND lastname = 'Two')
      )),
      '00000000-0000-4000-8000-000000563671'::UUID
    );
    RAISE EXCEPTION 'A request ID was accepted with a different payload';
  EXCEPTION WHEN SQLSTATE '40001' THEN
    NULL;
  END;

  BEGIN
    PERFORM pg_temp.call_regional_assignment(
      999992,
      'movie',
      'fr-FR',
      jsonb_build_array(jsonb_build_object(
        'actor_id', 720002,
        'work_id', (SELECT id FROM public.work WHERE dubbing_project_id = (SELECT id FROM public.dubbing_projects WHERE content_id = 999995 AND content_type = 'movie' AND language = 'fr-FR')),
        'expected_voice_actor_id', (SELECT id FROM public.voice_actors WHERE firstname = 'Regional Audit' AND lastname = 'One'),
        'voice_actor_id', (SELECT id FROM public.voice_actors WHERE firstname = 'Regional Audit' AND lastname = 'Two')
      )),
      '00000000-0000-4000-8000-000000563672'::UUID
    );
    RAISE EXCEPTION 'A work from another project was accepted';
  EXCEPTION WHEN SQLSTATE '40001' THEN
    NULL;
  END;

  BEGIN
    PERFORM pg_temp.call_regional_assignment(
      999992,
      'movie',
      'fr-FR',
      '[{"actor_id":720003,"work_id":null,"expected_voice_actor_id":null,"voice_actor_id":1,"status":"validated"}]'::JSONB,
      '00000000-0000-4000-8000-000000563673'::UUID
    );
    RAISE EXCEPTION 'A protected operation field was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;

  BEGIN
    PERFORM pg_temp.call_regional_assignment(
      999992,
      'movie',
      'fr-FR',
      '[1]'::JSONB,
      '00000000-0000-4000-8000-000000563679'::UUID
    );
    RAISE EXCEPTION 'An operation array with a non-object item was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;

  BEGIN
    PERFORM pg_temp.call_regional_assignment(
      999992,
      'movie',
      'fr-FR',
      jsonb_build_array(jsonb_build_object(
        'actor_id', 720004,
        'work_id', NULL,
        'expected_voice_actor_id', NULL,
        'voice_actor_id', (SELECT id FROM public.voice_actors WHERE firstname = 'Regional Audit' AND lastname = 'One')
      )),
      '00000000-0000-4000-8000-000000563674'::UUID,
      '00000000-0000-4000-8000-000000563662'::UUID
    );
    RAISE EXCEPTION 'An editor actor was accepted by the admin-only RPC';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    NULL;
  END;

  PERFORM pg_catalog.set_config('test.fail_regional_work', 'on', TRUE);
  BEGIN
    PERFORM pg_temp.call_regional_assignment(
      999993,
      'movie',
      'fr-FR',
      jsonb_build_array(jsonb_build_object(
        'actor_id', 720005,
        'work_id', NULL,
        'expected_voice_actor_id', NULL,
        'voice_actor_id', (SELECT id FROM public.voice_actors WHERE firstname = 'Regional Audit' AND lastname = 'One')
      )),
      '00000000-0000-4000-8000-000000563675'::UUID
    );
    RAISE EXCEPTION 'Injected database mutation failure was ignored';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  PERFORM pg_catalog.set_config('test.fail_regional_work', 'off', TRUE);

  PERFORM pg_catalog.set_config('test.fail_regional_audit', 'on', TRUE);
  BEGIN
    PERFORM pg_temp.call_regional_assignment(
      999994,
      'movie',
      'fr-FR',
      jsonb_build_array(jsonb_build_object(
        'actor_id', 720006,
        'work_id', NULL,
        'expected_voice_actor_id', NULL,
        'voice_actor_id', (SELECT id FROM public.voice_actors WHERE firstname = 'Regional Audit' AND lastname = 'One')
      )),
      '00000000-0000-4000-8000-000000563676'::UUID
    );
    RAISE EXCEPTION 'Injected audit insertion failure was ignored';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  PERFORM pg_catalog.set_config('test.fail_regional_audit', 'off', TRUE);
END;
$$;
RESET ROLE;

SELECT id AS main_work_id
FROM public.work
WHERE dubbing_project_id = :'main_project_id'::BIGINT AND actor_id = 720001
\gset

-- Give the existing row structured values that must survive an assignment
-- change and remain recoverable from the before/after snapshots.
UPDATE public.work
SET character_id = 80801,
    character_name = 'Audit character',
    note = 'Preserve this note'
WHERE id = :'main_work_id'::BIGINT;

-- Replaying the original request after it committed returns its project without
-- replaying the write or creating another audit event.
SET LOCAL ROLE service_role;
SELECT pg_temp.call_regional_assignment(
  999992,
  'movie',
  'fr-FR',
  jsonb_build_array(jsonb_build_object(
    'actor_id', 720001,
    'work_id', NULL,
    'expected_voice_actor_id', NULL,
    'voice_actor_id', :'va_one'::BIGINT
  )),
  '00000000-0000-4000-8000-000000563671'::UUID
);
SELECT pg_temp.call_regional_assignment(
  999992,
  'movie',
  'fr-FR',
  jsonb_build_array(jsonb_build_object(
    'actor_id', 720001,
    'work_id', :'main_work_id'::BIGINT,
    'expected_voice_actor_id', :'va_one'::BIGINT,
    'voice_actor_id', :'va_two'::BIGINT
  )),
  '00000000-0000-4000-8000-000000563677'::UUID
);
-- The exact update retry must be a no-op after the first commit.
SELECT pg_temp.call_regional_assignment(
  999992,
  'movie',
  'fr-FR',
  jsonb_build_array(jsonb_build_object(
    'actor_id', 720001,
    'work_id', :'main_work_id'::BIGINT,
    'expected_voice_actor_id', :'va_one'::BIGINT,
    'voice_actor_id', :'va_two'::BIGINT
  )),
  '00000000-0000-4000-8000-000000563677'::UUID
);
RESET ROLE;

SET LOCAL ROLE service_role;
SELECT pg_temp.call_regional_assignment(
  999992,
  'movie',
  'fr-FR',
  jsonb_build_array(jsonb_build_object(
    'actor_id', 720001,
    'work_id', :'main_work_id'::BIGINT,
    'expected_voice_actor_id', :'va_two'::BIGINT,
    'voice_actor_id', NULL
  )),
  '00000000-0000-4000-8000-000000563678'::UUID
);
RESET ROLE;

DO $$
DECLARE
  v_project_id BIGINT;
  v_work_id BIGINT;
  v_project_audit public.audit_logs%ROWTYPE;
  v_work_create public.audit_logs%ROWTYPE;
  v_work_update public.audit_logs%ROWTYPE;
  v_work_delete public.audit_logs%ROWTYPE;
  v_changed_fields TEXT[];
BEGIN
  SELECT id INTO v_project_id
  FROM public.dubbing_projects
  WHERE content_id = 999992 AND content_type = 'movie' AND language = 'fr-FR';
  SELECT id INTO v_work_id
  FROM public.work
  WHERE dubbing_project_id = v_project_id AND actor_id = 720001;

  IF v_project_id IS NULL OR v_work_id IS NOT NULL THEN
    RAISE EXCEPTION 'The final delete operation did not remove its work row';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.dubbing_projects
    WHERE content_id IN (999991, 999993, 999994) AND content_type = 'movie'
  ) OR EXISTS (
    SELECT 1 FROM public.audit_logs
    WHERE entity_type = 'dubbing_project'
      AND new_value ->> 'content_id' IN ('999991', '999993', '999994')
  ) THEN
    RAISE EXCEPTION 'A mutation or audit failure left partial project/audit rows';
  END IF;

  SELECT * INTO v_project_audit
  FROM public.audit_logs
  WHERE entity_type = 'dubbing_project' AND entity_id = v_project_id::TEXT;
  SELECT audit.* INTO v_work_create
  FROM private.regional_assignment_request_audits AS link
  JOIN public.audit_logs AS audit ON audit.id = link.audit_log_id
  WHERE link.actor_id = '00000000-0000-4000-8000-000000563661'::UUID
    AND link.request_id = '00000000-0000-4000-8000-000000563671'::UUID
    AND audit.entity_type = 'work' AND audit.action = 'create';
  SELECT audit.* INTO v_work_update
  FROM private.regional_assignment_request_audits AS link
  JOIN public.audit_logs AS audit ON audit.id = link.audit_log_id
  WHERE link.actor_id = '00000000-0000-4000-8000-000000563661'::UUID
    AND link.request_id = '00000000-0000-4000-8000-000000563677'::UUID
    AND audit.entity_type = 'work' AND audit.action = 'update';
  SELECT audit.* INTO v_work_delete
  FROM private.regional_assignment_request_audits AS link
  JOIN public.audit_logs AS audit ON audit.id = link.audit_log_id
  WHERE link.actor_id = '00000000-0000-4000-8000-000000563661'::UUID
    AND link.request_id = '00000000-0000-4000-8000-000000563678'::UUID
    AND audit.entity_type = 'work' AND audit.action = 'delete';

  IF v_project_audit.id IS NULL OR v_project_audit.user_id IS DISTINCT FROM '00000000-0000-4000-8000-000000563661'::UUID
    OR v_project_audit.action IS DISTINCT FROM 'create'
    OR v_project_audit.previous_value IS NOT NULL
    OR v_project_audit.new_value ->> 'content_id' IS DISTINCT FROM '999992'
    OR v_project_audit.new_value ->> 'language' IS DISTINCT FROM 'fr-FR'
    OR v_project_audit.created_at IS NULL THEN
    RAISE EXCEPTION 'Project audit lacks its actor, complete creation snapshot, or timestamp';
  END IF;

  IF v_work_create.id IS NULL OR v_work_create.previous_value IS NOT NULL
    OR v_work_create.new_value ->> 'voice_actor_id' IS DISTINCT FROM (SELECT id::TEXT FROM public.voice_actors WHERE firstname = 'Regional Audit' AND lastname = 'One')
    OR v_work_create.new_value ->> 'created_by' IS DISTINCT FROM '00000000-0000-4000-8000-000000563661'
    OR v_work_create.created_at IS NULL THEN
    RAISE EXCEPTION 'Work creation audit lacks complete values or authenticated actor attribution';
  END IF;

  IF v_work_update.id IS NULL
    OR v_work_update.previous_value ->> 'voice_actor_id' IS DISTINCT FROM (SELECT id::TEXT FROM public.voice_actors WHERE firstname = 'Regional Audit' AND lastname = 'One')
    OR v_work_update.new_value ->> 'voice_actor_id' IS DISTINCT FROM (SELECT id::TEXT FROM public.voice_actors WHERE firstname = 'Regional Audit' AND lastname = 'Two')
    OR v_work_update.new_value ->> 'updated_by' IS DISTINCT FROM '00000000-0000-4000-8000-000000563661'
    OR v_work_update.previous_value ->> 'note' IS DISTINCT FROM 'Preserve this note'
    OR v_work_update.new_value ->> 'note' IS DISTINCT FROM 'Preserve this note'
    OR v_work_update.previous_value ->> 'character_name' IS DISTINCT FROM 'Audit character'
    OR v_work_update.new_value ->> 'character_name' IS DISTINCT FROM 'Audit character' THEN
    RAISE EXCEPTION 'Work update audit is missing typed before/after values';
  END IF;

  IF v_work_delete.id IS NULL OR v_work_delete.new_value IS NOT NULL
    OR v_work_delete.previous_value ->> 'voice_actor_id' IS DISTINCT FROM (SELECT id::TEXT FROM public.voice_actors WHERE firstname = 'Regional Audit' AND lastname = 'Two')
    OR v_work_delete.previous_value ->> 'note' IS DISTINCT FROM 'Preserve this note'
    OR v_work_delete.previous_value ->> 'character_name' IS DISTINCT FROM 'Audit character' THEN
    RAISE EXCEPTION 'Work deletion audit cannot reconstruct the deleted row';
  END IF;

  IF (SELECT count(*) FROM private.regional_assignment_request_audits
      WHERE actor_id = '00000000-0000-4000-8000-000000563661'::UUID
        AND request_id = '00000000-0000-4000-8000-000000563671'::UUID) <> 2
    OR (SELECT count(*) FROM private.regional_assignment_requests
      WHERE actor_id = '00000000-0000-4000-8000-000000563661'::UUID
        AND request_id = '00000000-0000-4000-8000-000000563671'::UUID
        AND metadata ->> 'source' = '/api/admin/dubbing-project') <> 1 THEN
    RAISE EXCEPTION 'Create request audit linkage or request metadata is incomplete';
  END IF;

  SELECT changed_fields INTO v_changed_fields
  FROM private.regional_assignment_request_audits
  WHERE audit_log_id = v_work_update.id;
  IF v_changed_fields IS DISTINCT FROM ARRAY['updated_by', 'voice_actor_id']::TEXT[] THEN
    RAISE EXCEPTION 'Update audit changed_fields is not an exact diff: %', v_changed_fields;
  END IF;

  IF has_table_privilege('anon', 'private.regional_assignment_requests', 'SELECT')
    OR has_table_privilege('authenticated', 'private.regional_assignment_request_audits', 'SELECT')
    OR has_table_privilege('service_role', 'private.regional_assignment_requests', 'SELECT')
    OR has_table_privilege('anon', 'public.audit_logs', 'SELECT')
    OR NOT has_table_privilege('authenticated', 'public.audit_logs', 'SELECT') THEN
    RAISE EXCEPTION 'Audit visibility grants or private request access are incorrect';
  END IF;
END;
$$;

SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_audit_id UUID;
BEGIN
  SELECT id INTO v_audit_id
  FROM public.audit_logs
  WHERE entity_type = 'dubbing_project' AND entity_id = (
    SELECT id::TEXT FROM public.dubbing_projects
    WHERE content_id = 999992 AND content_type = 'movie' AND language = 'fr-FR'
  );

  BEGIN
    UPDATE public.audit_logs SET action = 'tampered' WHERE id = v_audit_id;
    RAISE EXCEPTION 'service_role changed an audit action';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    DELETE FROM public.audit_logs WHERE id = v_audit_id;
    RAISE EXCEPTION 'service_role deleted an audit row';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  UPDATE public.audit_logs SET reverted_at = clock_timestamp() WHERE id = v_audit_id;
END;
$$;
RESET ROLE;

DO $$
DECLARE
  v_audit_id UUID;
BEGIN
  SELECT id INTO v_audit_id
  FROM public.audit_logs
  WHERE entity_type = 'dubbing_project' AND entity_id = (
    SELECT id::TEXT FROM public.dubbing_projects
    WHERE content_id = 999992 AND content_type = 'movie' AND language = 'fr-FR'
  );

  BEGIN
    UPDATE public.audit_logs SET action = 'tampered' WHERE id = v_audit_id;
    RAISE EXCEPTION 'Audit immutability trigger allowed changing an event';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    NULL;
  END;

  BEGIN
    DELETE FROM public.audit_logs WHERE id = v_audit_id;
    RAISE EXCEPTION 'Audit immutability trigger allowed deletion';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    NULL;
  END;

  BEGIN
    UPDATE public.audit_logs SET reverted_at = NULL WHERE id = v_audit_id;
    RAISE EXCEPTION 'Audit reverted marker was cleared';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    NULL;
  END;
END;
$$;

ROLLBACK;
