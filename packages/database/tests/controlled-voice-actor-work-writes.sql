-- Run on a disposable database after migrations through
-- 20261015204215_controlled_voice_actor_work_writes.sql. The outer
-- transaction removes all fixtures and temporary failure constraints.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout = '30s';

INSERT INTO auth.users (id, raw_app_meta_data) VALUES
  ('00000000-0000-0000-0000-000000563681', '{"role":"admin"}'::JSONB),
  ('00000000-0000-0000-0000-000000563682', '{"role":"user"}'::JSONB),
  ('00000000-0000-0000-0000-000000563683', '{"role":"user"}'::JSONB),
  ('00000000-0000-0000-0000-000000563684', '{"role":"user"}'::JSONB);

INSERT INTO public.voice_actors (id, firstname, lastname) VALUES
  (563681001, 'Work Link', 'One'),
  (563681002, 'Work Link', 'Two');

INSERT INTO public.user_voice_actor_links (id, user_id, voice_actor_id) VALUES
  ('56368100-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000563682', 563681001),
  ('56368100-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000563683', 563681002);

SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.create_voice_actor_work_link(
      '00000000-0000-0000-0000-000000563682',
      '56368100-0000-4000-8000-000000000001', 563681001, 563681101,
      'movie', 'fr-FR', NULL, 'Anonymous role', 'dialogues'
    );
    RAISE EXCEPTION 'anon unexpectedly executed the controlled work RPC';
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
    PERFORM * FROM public.create_voice_actor_work_link(
      '00000000-0000-0000-0000-000000563682',
      '56368100-0000-4000-8000-000000000001', 563681001, 563681101,
      'movie', 'fr-FR', NULL, 'Unauthenticated RPC role', 'dialogues'
    );
    RAISE EXCEPTION 'authenticated unexpectedly executed the service-only work RPC';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;
RESET ROLE;

SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_admin UUID := '00000000-0000-0000-0000-000000563681';
  v_owner UUID := '00000000-0000-0000-0000-000000563682';
  v_other_owner UUID := '00000000-0000-0000-0000-000000563683';
  v_unlinked UUID := '00000000-0000-0000-0000-000000563684';
  v_request UUID := '56368100-0000-4000-8000-000000000011';
  v_role_retry UUID := '56368100-0000-4000-8000-000000000012';
  v_distinct_role UUID := '56368100-0000-4000-8000-000000000013';
  v_update_request UUID := '56368100-0000-4000-8000-000000000014';
  v_delete_request UUID := '56368100-0000-4000-8000-000000000015';
  v_work_id BIGINT;
  v_second_work_id BIGINT;
  v_project_id BIGINT;
  v_import_project_id BIGINT;
  v_admin_work_id BIGINT;
  v_audit_id UUID;
  v_admin_audit_id UUID;
  v_replayed BOOLEAN;
  v_expected_updated_at TIMESTAMPTZ;
  v_admin_expected_updated_at TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  -- A linked user creates a free-text role; NULL actor_id remains supported.
  SELECT result.work_id, result.project_id, result.audit_log_id, result.replayed
  INTO v_work_id, v_project_id, v_audit_id, v_replayed
  FROM public.create_voice_actor_work_link(
    v_owner, v_request, 563681001, 563681101,
    'movie', 'fr-FR', NULL, ' Rôle libre ', 'dialogues'
  ) AS result;
  IF v_work_id IS NULL OR v_project_id IS NULL OR v_audit_id IS NULL OR v_replayed THEN
    RAISE EXCEPTION 'authorized creation returned an invalid result';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.work AS work
    WHERE work.id = v_work_id AND work.actor_id IS NULL
      AND work.character_name = ' Rôle libre '
      AND work.voice_actor_id = 563681001
      AND work.created_by = v_owner
  ) THEN
    RAISE EXCEPTION 'free-text role or actor attribution was not preserved';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_logs AS audit
    WHERE audit.id = v_audit_id
      AND audit.user_id = v_owner
      AND audit.entity_type = 'work'
      AND audit.entity_id = v_work_id::TEXT
      AND audit.action = 'create'
      AND audit.request_id = v_request
      AND audit.request_fingerprint IS NOT NULL
      AND audit.metadata ->> 'operation' = 'create'
      AND audit.metadata ->> 'transaction_id' IS NOT NULL
      AND audit.previous_value = 'null'::JSONB
      AND jsonb_typeof(audit.new_value -> 'id') = 'number'
      AND jsonb_typeof(audit.new_value -> 'actor_id') = 'null'
      AND audit.new_value ->> 'character_name' = ' Rôle libre '
      AND audit.changed_fields @> ARRAY['character_name', 'voice_actor_id']::TEXT[]
  ) THEN
    RAISE EXCEPTION 'create audit is missing actor, request, or typed full snapshots';
  END IF;

  -- Reusing the request returns the same row and audit; reusing it with new
  -- data is a conflict. A separate request for the same identity is audited
  -- as an ensure operation without creating another row.
  SELECT result.work_id, result.audit_log_id, result.replayed
  INTO v_second_work_id, v_audit_id, v_replayed
  FROM public.create_voice_actor_work_link(
    v_owner, v_request, 563681001, 563681101,
    'movie', 'fr-FR', NULL, ' Rôle libre ', 'dialogues'
  ) AS result;
  IF v_second_work_id <> v_work_id OR NOT v_replayed THEN
    RAISE EXCEPTION 'idempotent create retry did not return the original result';
  END IF;

  BEGIN
    PERFORM * FROM public.create_voice_actor_work_link(
      v_owner, v_request, 563681001, 563681101,
      'movie', 'fr-FR', NULL, ' Rôle libre ', 'chant'
    );
    RAISE EXCEPTION 'request id reuse with different data unexpectedly succeeded';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  SELECT result.work_id, result.audit_log_id, result.replayed
  INTO v_second_work_id, v_audit_id, v_replayed
  FROM public.create_voice_actor_work_link(
    v_owner, v_role_retry, 563681001, 563681101,
    'movie', 'fr-FR', NULL, 'rÔLE LIBRE', 'chant'
  ) AS result;
  IF v_second_work_id <> v_work_id OR v_replayed THEN
    RAISE EXCEPTION 'normalized duplicate role was not returned as an ensure operation';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_logs AS audit
    WHERE audit.id = v_audit_id AND audit.action = 'ensure_link'
      AND audit.previous_value = audit.new_value
      AND cardinality(audit.changed_fields) = 0
  ) THEN
    RAISE EXCEPTION 'existing role was not represented by a no-op audit event';
  END IF;

  SELECT result.work_id INTO v_second_work_id
  FROM public.create_voice_actor_work_link(
    v_owner, v_distinct_role, 563681001, 563681101,
    'movie', 'fr-FR', NULL, 'Distinct role', 'chant'
  ) AS result;
  IF v_second_work_id = v_work_id OR (
    SELECT count(*) FROM public.work WHERE dubbing_project_id = v_project_id
  ) <> 2 THEN
    RAISE EXCEPTION 'distinct character role was merged with another role';
  END IF;

  -- Unlinked users and users representing a different voice actor cannot
  -- create a link for this voice actor; admin privileges come from app metadata.
  BEGIN
    PERFORM * FROM public.create_voice_actor_work_link(
      v_unlinked, '56368100-0000-4000-8000-000000000016', 563681001,
      563681101, 'movie', 'fr-FR', NULL, 'Unauthorized', 'dialogues'
    );
    RAISE EXCEPTION 'unlinked user unexpectedly created a voice actor link';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    PERFORM * FROM public.create_voice_actor_work_link(
      v_other_owner, '56368100-0000-4000-8000-000000000017', 563681001,
      563681101, 'movie', 'fr-FR', NULL, 'Wrong owner', 'dialogues'
    );
    RAISE EXCEPTION 'unrelated owner unexpectedly created a voice actor link';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    PERFORM * FROM public.create_voice_actor_work_link(
      v_owner, '56368100-0000-4000-8000-000000000024', 563681001,
      563681103, 'invalid-media', 'fr-FR', NULL, 'Invalid media type', 'dialogues'
    );
    RAISE EXCEPTION 'invalid media type unexpectedly succeeded';
  EXCEPTION WHEN invalid_parameter_value THEN
    NULL;
  END;
  BEGIN
    PERFORM * FROM public.create_voice_actor_work_link(
      v_owner, '56368100-0000-4000-8000-000000000025', 563681001,
      563681103, 'movie', 'xx-XX', NULL, 'Invalid language', 'dialogues'
    );
    RAISE EXCEPTION 'invalid dubbing language unexpectedly succeeded';
  EXCEPTION WHEN invalid_parameter_value THEN
    NULL;
  END;
  BEGIN
    PERFORM * FROM public.create_voice_actor_work_link(
      v_admin, '56368100-0000-4000-8000-000000000026', 563681999,
      563681103, 'movie', 'fr-FR', NULL, 'Missing voice actor', 'dialogues'
    );
    RAISE EXCEPTION 'missing voice actor unexpectedly succeeded';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;

  -- Admins may operate on any voice actor, while the audit actor remains the
  -- authenticated administrator passed by the trusted route.
  SELECT result.work_id INTO v_admin_work_id
  FROM public.create_voice_actor_work_link(
    v_admin, '56368100-0000-4000-8000-000000000018', 563681002,
    563681102, 'movie', 'fr-FR', 563681202, 'Admin role', 'dialogues'
  ) AS result;
  SELECT work.updated_at INTO v_admin_expected_updated_at
  FROM public.work AS work WHERE work.id = v_admin_work_id;
  SELECT result.audit_log_id INTO v_admin_audit_id
  FROM public.update_voice_actor_work_performance(
    v_admin, '56368100-0000-4000-8000-000000000023', v_admin_work_id,
    v_admin_expected_updated_at, 'voice'
  ) AS result;
  IF NOT EXISTS (
    SELECT 1 FROM public.work
    WHERE id = v_admin_work_id AND performance = 'voice'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.audit_logs
    WHERE id = v_admin_audit_id AND user_id = v_admin AND action = 'update'
  ) THEN
    RAISE EXCEPTION 'administrator could not update another voice actor with an audit';
  END IF;

  -- Preserve the existing process-credits project helper and its validated
  -- import writer. That writer remains a separate unaudited follow-up slice.
  SELECT result.project_id INTO v_import_project_id
  FROM public.find_or_create_dubbing_project(
    v_admin, NULL, '56368100-0000-4000-8000-000000000022',
    563681401, 'movie', 'fr-FR'
  ) AS result;
  INSERT INTO public.work (
    dubbing_project_id, actor_id, character_name, performance, status
  ) VALUES (
    v_import_project_id, 563681402, 'Imported Role', 'dialogues', 'validated'
  );
  IF NOT EXISTS (
    SELECT 1 FROM public.work
    WHERE dubbing_project_id = v_import_project_id
      AND character_name = 'Imported Role' AND status = 'validated'
  ) THEN
    RAISE EXCEPTION 'T08 guard blocked the existing validated credits importer';
  END IF;
  UPDATE public.work
  SET performance = 'dialogues', status = 'validated', character_name = 'Admin role'
  WHERE id = v_admin_work_id;
  IF NOT EXISTS (
    SELECT 1 FROM public.work
    WHERE id = v_admin_work_id
      AND performance = 'dialogues' AND status = 'validated'
      AND character_name = 'Admin role'
  ) THEN
    RAISE EXCEPTION 'T08 guard blocked the existing credits importer update path';
  END IF;

  SELECT work.updated_at INTO v_expected_updated_at
  FROM public.work AS work WHERE work.id = v_work_id;
  SELECT result.audit_log_id, result.replayed
  INTO v_audit_id, v_replayed
  FROM public.update_voice_actor_work_performance(
    v_owner, v_update_request, v_work_id, v_expected_updated_at, 'chant'
  ) AS result;
  IF v_replayed OR NOT EXISTS (
    SELECT 1 FROM public.work WHERE id = v_work_id AND performance = 'chant'
  ) THEN
    RAISE EXCEPTION 'authorized performance update did not persist';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_logs AS audit
    WHERE audit.id = v_audit_id
      AND audit.user_id = v_owner
      AND audit.action = 'update'
      AND audit.request_id = v_update_request
      AND jsonb_typeof(audit.previous_value -> 'performance') = 'string'
      AND audit.previous_value ->> 'performance' = 'dialogues'
      AND audit.new_value ->> 'performance' = 'chant'
      AND audit.changed_fields @> ARRAY['performance']::TEXT[]
  ) THEN
    RAISE EXCEPTION 'performance audit does not contain exact before/after values';
  END IF;

  SELECT result.audit_log_id, result.replayed
  INTO v_audit_id, v_replayed
  FROM public.update_voice_actor_work_performance(
    v_owner, v_update_request, v_work_id, v_expected_updated_at, 'chant'
  ) AS result;
  IF NOT v_replayed OR (SELECT count(*) FROM public.audit_logs WHERE request_id = v_update_request) <> 1 THEN
    RAISE EXCEPTION 'performance retry duplicated its audit event';
  END IF;

  BEGIN
    PERFORM * FROM public.update_voice_actor_work_performance(
      v_owner, '56368100-0000-4000-8000-000000000019', v_work_id,
      v_expected_updated_at + INTERVAL '1 second', 'dialogues'
    );
    RAISE EXCEPTION 'stale performance update unexpectedly succeeded';
  EXCEPTION WHEN serialization_failure THEN
    NULL;
  END;
  BEGIN
    PERFORM * FROM public.update_voice_actor_work_performance(
      v_unlinked, '56368100-0000-4000-8000-000000000020', v_work_id,
      (SELECT updated_at FROM public.work WHERE id = v_work_id), 'dialogues'
    );
    RAISE EXCEPTION 'unrelated user unexpectedly updated work';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    PERFORM * FROM public.update_voice_actor_work_performance(
      v_owner, '56368100-0000-4000-8000-000000000021', v_work_id,
      (SELECT updated_at FROM public.work WHERE id = v_work_id), 'unapproved'
    );
    RAISE EXCEPTION 'invalid performance value unexpectedly succeeded';
  EXCEPTION WHEN invalid_parameter_value THEN
    NULL;
  END;

  -- Delete is a narrowly scoped audited assignment mutation. Its complete
  -- prior row is retained for the separate moderator rollback task (#22).
  SELECT work.updated_at INTO v_expected_updated_at
  FROM public.work AS work WHERE work.id = v_second_work_id;
  BEGIN
    PERFORM * FROM public.delete_voice_actor_work_link(
      v_other_owner, '56368100-0000-4000-8000-000000000027',
      v_second_work_id, v_expected_updated_at
    );
    RAISE EXCEPTION 'unrelated user unexpectedly deleted a work link';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  SELECT result.audit_log_id INTO v_audit_id
  FROM public.delete_voice_actor_work_link(
    v_admin, v_delete_request, v_second_work_id, v_expected_updated_at
  ) AS result;
  IF EXISTS (SELECT 1 FROM public.work WHERE id = v_second_work_id)
     OR NOT EXISTS (
       SELECT 1 FROM public.audit_logs AS audit
       WHERE audit.id = v_audit_id AND audit.user_id = v_admin
         AND audit.action = 'delete'
         AND audit.previous_value ->> 'id' = v_second_work_id::TEXT
         AND audit.new_value = 'null'::JSONB
         AND audit.metadata ->> 'restore_snapshot' = 'true'
     ) THEN
    RAISE EXCEPTION 'deletion did not preserve an attributable restore snapshot';
  END IF;

  -- Direct legacy service-role writes are blocked by the migration guard.
  BEGIN
    INSERT INTO public.work (
      dubbing_project_id, actor_id, voice_actor_id, character_name, performance, status
    ) VALUES (v_project_id, NULL, 563681001, 'Bypass attempt', 'dialogues', 'user');
    RAISE EXCEPTION 'direct user-link INSERT unexpectedly bypassed the RPC';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    UPDATE public.work SET performance = 'voice' WHERE id = v_work_id;
    RAISE EXCEPTION 'direct performance UPDATE unexpectedly bypassed the RPC';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    UPDATE public.work
    SET performance = 'voice', character_name = 'Bypass attempt altered'
    WHERE id = v_work_id;
    RAISE EXCEPTION 'performance update with an unrelated field unexpectedly bypassed the RPC';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    DELETE FROM public.work WHERE id = v_work_id;
    RAISE EXCEPTION 'direct work DELETE unexpectedly bypassed the RPC';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  -- Request ids are unique across the complete audit table, and runtime roles
  -- cannot update or delete immutable history.
  BEGIN
    UPDATE public.audit_logs SET action = 'tampered' WHERE id = v_audit_id;
    RAISE EXCEPTION 'service_role unexpectedly modified audit history';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    DELETE FROM public.audit_logs WHERE id = v_audit_id;
    RAISE EXCEPTION 'service_role unexpectedly deleted audit history';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  SELECT count(*) INTO v_count FROM public.audit_logs
  WHERE user_id = v_owner AND request_id = v_request;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'create request did not retain exactly one audit event';
  END IF;
END;
$$;
RESET ROLE;

-- A failed work insert rolls back the project that the same RPC had just
-- created, including its project audit row.
ALTER TABLE public.work
  ADD CONSTRAINT controlled_voice_work_test_reject_insert
  CHECK (status <> 'user') NOT VALID;
SET LOCAL ROLE service_role;
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.create_voice_actor_work_link(
      '00000000-0000-0000-0000-000000563682',
      '56368100-0000-4000-8000-000000000031', 563681001, 563681301,
      'movie', 'fr-FR', NULL, 'Must roll back', 'dialogues'
    );
    RAISE EXCEPTION 'constrained work insert unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END;
$$;
RESET ROLE;
ALTER TABLE public.work DROP CONSTRAINT controlled_voice_work_test_reject_insert;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.dubbing_projects
    WHERE content_id = 563681301 AND content_type = 'movie'
  ) OR EXISTS (
    SELECT 1 FROM public.audit_logs
    WHERE request_id = '56368100-0000-4000-8000-000000000031'
       OR request_id = md5(
         'voice-actor-work-project:00000000-0000-0000-0000-000000563682:' ||
         '56368100-0000-4000-8000-000000000031'
       )::UUID
  ) THEN
    RAISE EXCEPTION 'failed work insert left an orphan project or audit row';
  END IF;
END;
$$;

-- A failed required audit insertion rolls back both the performance change and
-- a newly created project/work pair.
ALTER TABLE public.audit_logs
  ADD CONSTRAINT controlled_voice_audit_test_reject_work
  CHECK (metadata ->> 'source' <> 'voice_actor_work_mutation') NOT VALID;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_work_id BIGINT;
  v_updated_at TIMESTAMPTZ;
BEGIN
  SELECT work.id, work.updated_at INTO v_work_id, v_updated_at
  FROM public.work AS work
  WHERE work.voice_actor_id = 563681001
    AND work.character_name = ' Rôle libre ';
  BEGIN
    PERFORM * FROM public.update_voice_actor_work_performance(
      '00000000-0000-0000-0000-000000563682',
      '56368100-0000-4000-8000-000000000041', v_work_id, v_updated_at, 'voice'
    );
    RAISE EXCEPTION 'constrained audit insertion unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  IF NOT EXISTS (
    SELECT 1 FROM public.work WHERE id = v_work_id AND performance = 'chant'
  ) OR EXISTS (
    SELECT 1 FROM public.audit_logs
    WHERE request_id = '56368100-0000-4000-8000-000000000041'
  ) THEN
    RAISE EXCEPTION 'audit failure did not roll back the performance update';
  END IF;

  BEGIN
    PERFORM * FROM public.create_voice_actor_work_link(
      '00000000-0000-0000-0000-000000563682',
      '56368100-0000-4000-8000-000000000042', 563681001, 563681302,
      'movie', 'fr-FR', NULL, 'Audit failure rolls back project', 'dialogues'
    );
    RAISE EXCEPTION 'work audit insertion unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END;
$$;
RESET ROLE;
ALTER TABLE public.audit_logs DROP CONSTRAINT controlled_voice_audit_test_reject_work;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.dubbing_projects
    WHERE content_id = 563681302 AND content_type = 'movie'
  ) OR EXISTS (
    SELECT 1 FROM public.work WHERE character_name = 'Audit failure rolls back project'
  ) OR EXISTS (
    SELECT 1 FROM public.audit_logs
    WHERE request_id = '56368100-0000-4000-8000-000000000042'
  ) THEN
    RAISE EXCEPTION 'failed audit left a project, work row, or audit event';
  END IF;
END;
$$;

ROLLBACK;
