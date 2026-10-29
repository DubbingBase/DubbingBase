-- Run on a disposable database after all migrations. The outer transaction
-- rolls back every fixture and the temporary audit-failure trigger.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout = '30s';

DO $$
DECLARE
  v_role TEXT;
BEGIN
  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF has_table_privilege(v_role, 'public.work', 'TRUNCATE')
       OR has_table_privilege(v_role, 'public.work', 'TRIGGER') THEN
      RAISE EXCEPTION '% retains a work-table TRUNCATE or TRIGGER privilege', v_role;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    WHERE attribute.attrelid = 'public.work'::REGCLASS
      AND attribute.attname = 'updated_at'
      AND attribute.attnotnull
      AND NOT attribute.attisdropped
  ) THEN
    RAISE EXCEPTION 'work.updated_at must be non-null for optimistic concurrency';
  END IF;
END;
$$;

INSERT INTO auth.users (id, raw_app_meta_data) VALUES
  ('00000000-0000-0000-0000-000000563691', '{"role":"admin"}'::JSONB),
  ('00000000-0000-0000-0000-000000563692', '{"role":"user"}'::JSONB),
  ('00000000-0000-0000-0000-000000563693', '{"role":"user"}'::JSONB),
  ('00000000-0000-0000-0000-000000563694', '{"role":"user"}'::JSONB);

INSERT INTO public.voice_actors (id, firstname, lastname) VALUES
  (563691001, 'Review Status', 'Actor');
INSERT INTO public.user_voice_actor_links (id, user_id, voice_actor_id) VALUES
  ('56369100-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000563692', 563691001);

SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.update_work_review_status_controlled(
      '00000000-0000-0000-0000-000000563691',
      '56369100-0000-4000-8000-000000000001', 1, NULL, 'accepted'
    );
    RAISE EXCEPTION 'anon unexpectedly executed the review status RPC';
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
    PERFORM * FROM public.update_work_review_status_controlled(
      '00000000-0000-0000-0000-000000563691',
      '56369100-0000-4000-8000-000000000002', 1, NULL, 'accepted'
    );
    RAISE EXCEPTION 'authenticated unexpectedly executed the service-only review status RPC';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;

SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_admin UUID := '00000000-0000-0000-0000-000000563691';
  v_owner UUID := '00000000-0000-0000-0000-000000563692';
  v_other UUID := '00000000-0000-0000-0000-000000563693';
  v_unlinked UUID := '00000000-0000-0000-0000-000000563694';
  v_create_request UUID := '56369100-0000-4000-8000-000000000010';
  v_admin_request UUID := '56369100-0000-4000-8000-000000000011';
  v_owner_request UUID := '56369100-0000-4000-8000-000000000012';
  v_stale_request UUID := '56369100-0000-4000-8000-000000000013';
  v_work_id BIGINT;
  v_audit_id UUID;
  v_expected_updated_at TIMESTAMPTZ;
  v_replayed BOOLEAN;
BEGIN
  SELECT result.work_id INTO v_work_id
  FROM public.create_voice_actor_work_link(
    v_owner, v_create_request, 563691001, 563691101,
    'movie', 'fr-FR', NULL, 'Review role', 'dialogues'
  ) AS result;
  SELECT work.updated_at INTO v_expected_updated_at
  FROM public.work AS work WHERE work.id = v_work_id;
  IF v_expected_updated_at IS NULL THEN
    RAISE EXCEPTION 'new work row has no optimistic concurrency version';
  END IF;
  BEGIN
    INSERT INTO public.work (
      dubbing_project_id, character_name, performance, status, updated_at
    )
    SELECT work.dubbing_project_id, 'null-version-rejected', 'dialogues', 'validated', NULL
    FROM public.work AS work WHERE work.id = v_work_id;
    RAISE EXCEPTION 'work unexpectedly accepted a null update version';
  EXCEPTION WHEN not_null_violation THEN
    NULL;
  END;
  IF EXISTS (
    SELECT 1 FROM public.work
    WHERE dubbing_project_id = (SELECT dubbing_project_id FROM public.work WHERE id = v_work_id)
      AND character_name = 'null-version-rejected'
  ) THEN
    RAISE EXCEPTION 'failed null-version insert changed persisted work';
  END IF;

  -- An unrelated and an unlinked authenticated identity cannot mutate it.
  BEGIN
    PERFORM * FROM public.update_work_review_status_controlled(
      v_other, '56369100-0000-4000-8000-000000000015', v_work_id,
      v_expected_updated_at, 'accepted'
    );
    RAISE EXCEPTION 'unrelated user unexpectedly updated review status';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    PERFORM * FROM public.update_work_review_status_controlled(
      v_unlinked, '56369100-0000-4000-8000-000000000016', v_work_id,
      v_expected_updated_at, 'accepted'
    );
    RAISE EXCEPTION 'unlinked user unexpectedly updated review status';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  SELECT result.audit_log_id, result.replayed
  INTO v_audit_id, v_replayed
  FROM public.update_work_review_status_controlled(
    v_admin, v_admin_request, v_work_id, v_expected_updated_at, 'accepted'
  ) AS result;
  IF v_audit_id IS NULL OR v_replayed THEN
    RAISE EXCEPTION 'authorized admin update returned an invalid result';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.work
    WHERE id = v_work_id AND reviewed_status = 'accepted' AND updated_by = v_admin
  ) THEN
    RAISE EXCEPTION 'authorized admin review status was not persisted';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_logs AS audit
    WHERE audit.id = v_audit_id
      AND audit.user_id = v_admin
      AND audit.entity_type = 'work'
      AND audit.entity_id = v_work_id::TEXT
      AND audit.action = 'update_review_status'
      AND audit.request_id = v_admin_request
      AND audit.request_fingerprint IS NOT NULL
      AND audit.metadata ->> 'operation' = 'update_review_status'
      AND audit.metadata ->> 'transaction_id' IS NOT NULL
      AND audit.previous_value ->> 'reviewed_status' = 'waiting'
      AND audit.new_value ->> 'reviewed_status' = 'accepted'
      AND audit.changed_fields @> ARRAY['reviewed_status']::TEXT[]
  ) THEN
    RAISE EXCEPTION 'review status audit lacks actor, typed snapshots, or changed fields';
  END IF;

  -- A database-first rollout must not leave the old service-role table write
  -- usable before the replacement route is deployed.
  BEGIN
    UPDATE public.work SET reviewed_status = 'rejected' WHERE id = v_work_id;
    RAISE EXCEPTION 'service role unexpectedly bypassed the controlled review-status operation';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF (SELECT reviewed_status FROM public.work WHERE id = v_work_id) <> 'accepted' THEN
    RAISE EXCEPTION 'blocked legacy service-role write changed the persisted status';
  END IF;

  SELECT result.audit_log_id, result.replayed
  INTO v_audit_id, v_replayed
  FROM public.update_work_review_status_controlled(
    v_admin, v_admin_request, v_work_id, v_expected_updated_at, 'accepted'
  ) AS result;
  IF v_audit_id IS NULL OR NOT v_replayed THEN
    RAISE EXCEPTION 'stable retry did not return the original audit';
  END IF;
  IF (SELECT count(*) FROM public.audit_logs WHERE user_id = v_admin AND request_id = v_admin_request) <> 1 THEN
    RAISE EXCEPTION 'stable retry created duplicate audit events';
  END IF;

  BEGIN
    PERFORM * FROM public.update_work_review_status_controlled(
      v_admin, v_admin_request, v_work_id, v_expected_updated_at, 'rejected'
    );
    RAISE EXCEPTION 'request id reuse with a different status unexpectedly succeeded';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  -- A linked owner remains authorized; a later stale version is rejected.
  SELECT result.audit_log_id INTO v_audit_id
  FROM public.update_work_review_status_controlled(
    v_owner, v_owner_request, v_work_id, v_expected_updated_at, 'rejected'
  ) AS result;
  SELECT work.updated_at INTO v_expected_updated_at
  FROM public.work AS work WHERE work.id = v_work_id;
  IF v_audit_id IS NULL THEN
    RAISE EXCEPTION 'linked owner update was not audited';
  END IF;
  BEGIN
    PERFORM * FROM public.update_work_review_status_controlled(
      v_admin, v_stale_request, v_work_id, '2000-01-01T00:00:00Z', 'accepted'
    );
    RAISE EXCEPTION 'stale review status update unexpectedly succeeded';
  EXCEPTION WHEN serialization_failure THEN
    NULL;
  END;

  BEGIN
    PERFORM * FROM public.update_work_review_status_controlled(
      v_admin, '56369100-0000-4000-8000-000000000017', v_work_id,
      v_expected_updated_at, 'unknown'
    );
    RAISE EXCEPTION 'invalid review status unexpectedly succeeded';
  EXCEPTION WHEN invalid_parameter_value THEN
    NULL;
  END;

  PERFORM set_config('test.review_work_id', v_work_id::TEXT, TRUE);
END;
$$;
RESET ROLE;

CREATE FUNCTION pg_temp.fail_review_status_audit()
RETURNS TRIGGER LANGUAGE plpgsql AS $trigger$
BEGIN
  IF NEW.entity_type = 'work' AND NEW.action = 'update_review_status' THEN
    RAISE EXCEPTION 'forced review audit failure' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$trigger$;
CREATE TRIGGER fail_review_status_audit
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_review_status_audit();

SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_admin UUID := '00000000-0000-0000-0000-000000563691';
  v_work_id BIGINT := current_setting('test.review_work_id')::BIGINT;
  v_expected_updated_at TIMESTAMPTZ;
  v_status TEXT;
  v_failed_request UUID := '56369100-0000-4000-8000-000000000014';
  v_audit_failed BOOLEAN := FALSE;
BEGIN
  SELECT work.updated_at INTO v_expected_updated_at
  FROM public.work AS work WHERE work.id = v_work_id;
  BEGIN
    PERFORM * FROM public.update_work_review_status_controlled(
      v_admin, v_failed_request, v_work_id, v_expected_updated_at, 'accepted'
    );
  EXCEPTION WHEN raise_exception THEN
    v_audit_failed := TRUE;
  END;
  IF NOT v_audit_failed THEN
    RAISE EXCEPTION 'audit failure unexpectedly allowed review status update';
  END IF;
  SELECT work.reviewed_status INTO v_status
  FROM public.work AS work WHERE work.id = v_work_id;
  IF v_status <> 'rejected' OR EXISTS (
    SELECT 1 FROM public.audit_logs WHERE user_id = v_admin AND request_id = v_failed_request
  ) THEN
    RAISE EXCEPTION 'audit failure did not roll back the review status mutation';
  END IF;
END;
$$;
RESET ROLE;
DROP TRIGGER fail_review_status_audit ON public.audit_logs;

-- Legacy callers may omit retry/version metadata. Changed values remain audited;
-- an identical retry becomes a no-op without a second audit side effect.
SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_admin UUID := '00000000-0000-0000-0000-000000563691';
  v_work_id BIGINT := current_setting('test.review_work_id')::BIGINT;
  v_audit_id UUID;
  v_replayed BOOLEAN;
  v_audit_count BIGINT;
  v_expected_updated_at TIMESTAMPTZ;
BEGIN
  SELECT count(*) INTO v_audit_count
  FROM public.audit_logs
  WHERE user_id = v_admin AND entity_id = v_work_id::TEXT AND action = 'update_review_status';
  SELECT updated_at INTO v_expected_updated_at FROM public.work WHERE id = v_work_id;

  SELECT result.audit_log_id, result.replayed INTO v_audit_id, v_replayed
  FROM public.update_work_review_status_controlled(v_admin, NULL, v_work_id, v_expected_updated_at, 'waiting') AS result;
  IF v_audit_id IS NULL OR v_replayed THEN
    RAISE EXCEPTION 'legacy update without request metadata was not audited';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_logs AS audit
    WHERE audit.id = v_audit_id
      AND audit.request_id IS NULL
      AND audit.request_fingerprint IS NULL
      AND audit.previous_value ->> 'reviewed_status' = 'rejected'
      AND audit.new_value ->> 'reviewed_status' = 'waiting'
  ) THEN
    RAISE EXCEPTION 'legacy update audit lost its typed before/after values';
  END IF;

  SELECT updated_at INTO v_expected_updated_at FROM public.work WHERE id = v_work_id;
  SELECT result.audit_log_id, result.replayed INTO v_audit_id, v_replayed
  FROM public.update_work_review_status_controlled(v_admin, NULL, v_work_id, v_expected_updated_at, 'waiting') AS result;
  IF v_audit_id IS NOT NULL OR v_replayed THEN
    RAISE EXCEPTION 'same-value legacy retry should be an unaudited no-op';
  END IF;
  IF (SELECT count(*) FROM public.audit_logs WHERE user_id = v_admin AND entity_id = v_work_id::TEXT AND action = 'update_review_status') <> v_audit_count + 1 THEN
    RAISE EXCEPTION 'same-value legacy retry created a duplicate audit event';
  END IF;
END;
$$;
RESET ROLE;

-- Direct table writes retained for authenticated admins receive the same full
-- snapshots; ordinary authenticated users and anon cannot write the row.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', '00000000-0000-0000-0000-000000563691',
  'role', 'authenticated',
  'app_metadata', jsonb_build_object('role', 'admin')
)::TEXT, TRUE);
UPDATE public.work SET reviewed_status = 'rejected'
WHERE id = current_setting('test.review_work_id')::BIGINT;
RESET ROLE;

DO $$
DECLARE
  v_work_id BIGINT;
BEGIN
  v_work_id := current_setting('test.review_work_id')::BIGINT;
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_logs
    WHERE user_id = '00000000-0000-0000-0000-000000563691'
      AND entity_type = 'work'
      AND entity_id = v_work_id::TEXT
      AND action = 'update'
      AND metadata ->> 'source' = 'authenticated_work_table_write'
      AND changed_fields @> ARRAY['reviewed_status']::TEXT[]
  ) THEN
    RAISE EXCEPTION 'direct authenticated work update did not create its audit';
  END IF;
END;
$$;
RESET ROLE;

SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_audit_id UUID;
BEGIN
  SELECT id INTO v_audit_id
  FROM public.audit_logs
  WHERE user_id = '00000000-0000-0000-0000-000000563691'
    AND entity_type = 'work'
    AND action = 'update_review_status'
  ORDER BY created_at DESC
  LIMIT 1;
  BEGIN
    UPDATE public.audit_logs SET new_value = '{}'::JSONB WHERE id = v_audit_id;
    RAISE EXCEPTION 'service role unexpectedly modified immutable audit history';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    DELETE FROM public.audit_logs WHERE id = v_audit_id;
    RAISE EXCEPTION 'service role unexpectedly deleted immutable audit history';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;
RESET ROLE;

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', '00000000-0000-0000-0000-000000563694',
  'role', 'anon'
)::TEXT, TRUE);
DO $$
DECLARE
  v_work_id BIGINT := current_setting('test.review_work_id')::BIGINT;
  v_rows BIGINT := 0;
BEGIN
  BEGIN
    UPDATE public.work SET reviewed_status = 'accepted' WHERE id = v_work_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
  EXCEPTION WHEN insufficient_privilege THEN
    v_rows := 0;
  END;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'anon unexpectedly updated a work review status';
  END IF;
END;
$$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', '00000000-0000-0000-0000-000000563694',
  'role', 'authenticated',
  'app_metadata', jsonb_build_object('role', 'user')
)::TEXT, TRUE);
DO $$
DECLARE
  v_work_id BIGINT := current_setting('test.review_work_id')::BIGINT;
  v_rows BIGINT := 0;
BEGIN
  BEGIN
    UPDATE public.work SET reviewed_status = 'accepted' WHERE id = v_work_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
  EXCEPTION WHEN insufficient_privilege THEN
    v_rows := 0;
  END;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'ordinary authenticated user unexpectedly updated a work review status';
  END IF;
END;
$$;
RESET ROLE;

DO $$
BEGIN
  IF (SELECT reviewed_status FROM public.work WHERE id = current_setting('test.review_work_id')::BIGINT) <> 'rejected'
     OR EXISTS (
       SELECT 1 FROM public.audit_logs
       WHERE user_id = '00000000-0000-0000-0000-000000563694'
         AND entity_type = 'work'
         AND entity_id = current_setting('test.review_work_id')
     ) THEN
    RAISE EXCEPTION 'unauthorized browser-role write changed work or created an audit event';
  END IF;
END;
$$;

ROLLBACK;
