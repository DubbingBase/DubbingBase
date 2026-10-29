-- Run on a disposable database after all migrations. Fixtures and failure
-- injection are rolled back together.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout = '30s';

INSERT INTO auth.users (id, raw_app_meta_data) VALUES
  ('00000000-0000-0000-0000-000000563691', '{"role":"admin"}'::JSONB),
  ('00000000-0000-0000-0000-000000563692', '{"role":"user"}'::JSONB),
  ('00000000-0000-0000-0000-000000563693', '{"role":"user"}'::JSONB),
  ('00000000-0000-0000-0000-000000563694', '{"role":"user"}'::JSONB);

INSERT INTO public.voice_actors (id, firstname, lastname) VALUES
  (563691001, 'Ownership Link', 'One'),
  (563691002, 'Ownership Link', 'Two'),
  (563691003, 'Ownership Link', 'Three');

SELECT set_config('test.link_admin', '00000000-0000-0000-0000-000000563691', TRUE);
SELECT set_config('test.link_user', '00000000-0000-0000-0000-000000563692', TRUE);
SELECT set_config('test.link_other_user', '00000000-0000-0000-0000-000000563693', TRUE);
SELECT set_config('test.link_failure_user', '00000000-0000-0000-0000-000000563694', TRUE);

DO $$
BEGIN
  IF has_table_privilege('anon', 'public.user_voice_actor_links', 'INSERT')
     OR has_table_privilege('anon', 'public.user_voice_actor_links', 'UPDATE')
     OR has_table_privilege('anon', 'public.user_voice_actor_links', 'DELETE')
     OR has_table_privilege('authenticated', 'public.user_voice_actor_links', 'INSERT')
     OR has_table_privilege('authenticated', 'public.user_voice_actor_links', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.user_voice_actor_links', 'DELETE')
     OR has_table_privilege('service_role', 'public.user_voice_actor_links', 'INSERT')
     OR has_table_privilege('service_role', 'public.user_voice_actor_links', 'UPDATE')
     OR has_table_privilege('service_role', 'public.user_voice_actor_links', 'DELETE')
     OR NOT has_table_privilege('authenticated', 'public.user_voice_actor_links', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.user_voice_actor_links', 'SELECT') THEN
    RAISE EXCEPTION 'ownership-link table grants do not require controlled writes';
  END IF;
  IF has_table_privilege('anon', 'public.user_voice_actor_link_requests', 'SELECT')
     OR has_table_privilege('authenticated', 'public.user_voice_actor_link_requests', 'SELECT')
     OR has_table_privilege('service_role', 'public.user_voice_actor_link_requests', 'SELECT')
     OR has_table_privilege('authenticated', 'public.user_voice_actor_link_requests', 'INSERT')
     OR has_table_privilege('service_role', 'public.user_voice_actor_link_requests', 'DELETE') THEN
    RAISE EXCEPTION 'idempotency request results are directly accessible';
  END IF;
  IF has_function_privilege('anon', 'public.admin_link_user_voice_actor_controlled(uuid,uuid,uuid,integer)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.admin_link_user_voice_actor_controlled(uuid,uuid,uuid,integer)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.admin_link_user_voice_actor_controlled(uuid,uuid,uuid,integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.delete_user_voice_actor_link_controlled(uuid,uuid,uuid,integer,uuid)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.delete_user_voice_actor_link_controlled(uuid,uuid,uuid,integer,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.delete_user_voice_actor_link_controlled(uuid,uuid,uuid,integer,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'ownership-link RPC grants are incorrect';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc AS function
    JOIN pg_roles AS owner ON owner.oid = function.proowner
    WHERE function.oid = 'public.merge_voice_actor_duplicates_atomic(integer,integer[],jsonb)'::REGPROCEDURE
      AND owner.rolname = 'postgres'
      AND function.prosecdef
  ) OR NOT has_function_privilege(
    'service_role',
    'public.merge_voice_actor_duplicates_atomic(integer,integer[],jsonb)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'established voice-actor merge lost its privileged execution boundary';
  END IF;
END;
$$;

SET LOCAL ROLE anon;
DO $$
BEGIN
  PERFORM count(*) FROM public.user_voice_actor_links;
  BEGIN
    PERFORM * FROM public.admin_link_user_voice_actor_controlled(
      current_setting('test.link_admin')::UUID,
      '56369100-0000-4000-8000-000000000001',
      current_setting('test.link_user')::UUID,
      563691001
    );
    RAISE EXCEPTION 'anonymous caller executed ownership-link RPC';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000563692","role":"authenticated","app_metadata":{"role":"user"}}', TRUE);
DO $$
BEGIN
  BEGIN
    INSERT INTO public.user_voice_actor_links (user_id, voice_actor_id)
    VALUES (current_setting('test.link_user')::UUID, 563691001);
    RAISE EXCEPTION 'non-admin directly inserted an ownership link';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    PERFORM * FROM public.admin_link_user_voice_actor_controlled(
      current_setting('test.link_user')::UUID,
      '56369100-0000-4000-8000-000000000002',
      current_setting('test.link_user')::UUID,
      563691001
    );
    RAISE EXCEPTION 'non-admin executed the admin ownership-link RPC';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000563691","role":"authenticated","app_metadata":{"role":"admin"}}', TRUE);
DO $$
DECLARE
  v_first public.user_voice_actor_links%ROWTYPE;
  v_second public.user_voice_actor_links%ROWTYPE;
  v_audit_id UUID;
  v_created BOOLEAN;
  v_replayed BOOLEAN;
  v_denied BOOLEAN;
BEGIN
  SELECT result.link_id, result.created, result.audit_log_id, result.replayed
  INTO v_first.id, v_created, v_audit_id, v_replayed
  FROM public.admin_link_user_voice_actor_controlled(
    current_setting('test.link_admin')::UUID,
    '56369100-0000-4000-8000-000000000003',
    current_setting('test.link_user')::UUID,
    563691001
  ) AS result;

  IF v_first.id IS NULL OR NOT v_created OR v_audit_id IS NULL OR v_replayed THEN
    RAISE EXCEPTION 'administrator link did not create an audited relationship';
  END IF;
  SELECT * INTO v_first FROM public.user_voice_actor_links WHERE id = v_first.id;
  IF v_first.user_id <> current_setting('test.link_user')::UUID
     OR v_first.voice_actor_id <> 563691001
     OR v_first.created_by <> current_setting('test.link_admin')::UUID THEN
    RAISE EXCEPTION 'ownership link has incorrect persisted values';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_logs AS audit
    WHERE audit.id = v_audit_id
      AND audit.user_id = current_setting('test.link_admin')::UUID
      AND audit.entity_type = 'user_voice_actor_link'
      AND audit.entity_id = v_first.id::TEXT
      AND audit.action = 'create'
      AND audit.previous_value IS NULL
      AND audit.new_value ->> 'id' = v_first.id::TEXT
      AND audit.new_value ->> 'user_id' = current_setting('test.link_user')
      AND jsonb_typeof(audit.new_value -> 'voice_actor_id') = 'number'
      AND audit.new_value ->> 'voice_actor_id' = '563691001'
      AND audit.changed_fields @> ARRAY['user_id', 'voice_actor_id', 'created_by']::TEXT[]
      AND audit.request_id = '56369100-0000-4000-8000-000000000003'
      AND audit.request_fingerprint IS NOT NULL
      AND audit.metadata ->> 'source' = 'api/link-user-voice-actor'
      AND audit.metadata ->> 'request_id' = '56369100-0000-4000-8000-000000000003'
      AND audit.created_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'create audit is missing actor, typed snapshot, or request source';
  END IF;

  SELECT result.link_id, result.created, result.audit_log_id, result.replayed
  INTO v_second.id, v_created, v_audit_id, v_replayed
  FROM public.admin_link_user_voice_actor_controlled(
    current_setting('test.link_admin')::UUID,
    '56369100-0000-4000-8000-000000000003',
    current_setting('test.link_user')::UUID,
    563691001
  ) AS result;
  IF v_second.id <> v_first.id OR NOT v_created OR v_audit_id IS NULL OR NOT v_replayed THEN
    RAISE EXCEPTION 'same request retry did not return its original result';
  END IF;

  v_denied := FALSE;
  BEGIN
    PERFORM * FROM public.admin_link_user_voice_actor_controlled(
      current_setting('test.link_admin')::UUID,
      '56369100-0000-4000-8000-000000000003',
      current_setting('test.link_user')::UUID,
      563691002
    );
  EXCEPTION WHEN SQLSTATE 'P2001' THEN
    v_denied := TRUE;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'request ID was reused with a different payload';
  END IF;

  SELECT result.link_id, result.created, result.audit_log_id, result.replayed
  INTO v_second.id, v_created, v_audit_id, v_replayed
  FROM public.admin_link_user_voice_actor_controlled(
    current_setting('test.link_admin')::UUID,
    '56369100-0000-4000-8000-000000000009',
    current_setting('test.link_user')::UUID,
    563691001
  ) AS result;
  IF v_second.id <> v_first.id OR v_created OR v_replayed OR v_audit_id IS NULL THEN
    RAISE EXCEPTION 'new request for an existing relationship did not persist its no-op result';
  END IF;

  -- A user may represent multiple voice actors; only an exact pair is unique.
  SELECT result.link_id INTO v_second.id
  FROM public.admin_link_user_voice_actor_controlled(
    current_setting('test.link_admin')::UUID,
    '56369100-0000-4000-8000-000000000004',
    current_setting('test.link_user')::UUID,
    563691002
  ) AS result;
  IF v_second.id IS NULL OR (
    SELECT count(*) FROM public.user_voice_actor_links
    WHERE user_id = current_setting('test.link_user')::UUID
  ) <> 2 THEN
    RAISE EXCEPTION 'distinct voice-actor ownership link was not preserved';
  END IF;

  BEGIN
    PERFORM * FROM public.admin_link_user_voice_actor_controlled(
      current_setting('test.link_user')::UUID,
      '56369100-0000-4000-8000-000000000005',
      current_setting('test.link_user')::UUID,
      563691001
    );
    RAISE EXCEPTION 'caller spoofed the acting administrator';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;
RESET ROLE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_voice_actor_link_requests AS request
    WHERE request.actor_id = current_setting('test.link_admin')::UUID
      AND request.request_id = '56369100-0000-4000-8000-000000000009'
      AND request.result_changed = FALSE
      AND request.result_link_id IS NOT NULL
      AND request.audit_log_id IS NOT NULL
      AND request.completed_at IS NOT NULL
      AND length(request.payload_fingerprint) = 32
  ) THEN
    RAISE EXCEPTION 'no-op request result did not retain its payload fingerprint and outcome';
  END IF;
END;
$$;

SET LOCAL ROLE anon;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.user_voice_actor_links
      WHERE user_id = current_setting('test.link_user')::UUID) <> 2 THEN
    RAISE EXCEPTION 'public ownership-link reads were unexpectedly restricted';
  END IF;
END;
$$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000563692","role":"authenticated","app_metadata":{"role":"user"}}', TRUE);
DO $$
DECLARE
  v_denied BOOLEAN;
  v_result BOOLEAN;
  v_audit_id UUID;
  v_link_id UUID;
BEGIN
  BEGIN
    INSERT INTO public.user_voice_actor_links (user_id, voice_actor_id)
    VALUES (current_setting('test.link_user')::UUID, 563691001);
    RAISE EXCEPTION 'authenticated user directly inserted an ownership link';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    UPDATE public.user_voice_actor_links SET voice_actor_id = 563691002
    WHERE user_id = current_setting('test.link_user')::UUID;
    RAISE EXCEPTION 'authenticated user directly updated an ownership link';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    DELETE FROM public.user_voice_actor_links
    WHERE user_id = current_setting('test.link_user')::UUID;
    RAISE EXCEPTION 'authenticated user directly deleted an ownership link';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  v_denied := FALSE;
  BEGIN
    SELECT result.deleted, result.audit_log_id
    INTO v_result, v_audit_id
    FROM public.delete_user_voice_actor_link_controlled(
      current_setting('test.link_user')::UUID,
      '56369100-0000-4000-8000-000000000006',
      current_setting('test.link_other_user')::UUID,
      563691001,
      '56369100-0000-4000-8000-000000000099'
    ) AS result;
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := TRUE;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'user removed another user voice-actor link';
  END IF;

  SELECT link.id INTO v_link_id
  FROM public.user_voice_actor_links AS link
  WHERE link.user_id = current_setting('test.link_user')::UUID
    AND link.voice_actor_id = 563691001;

  SELECT result.deleted, result.audit_log_id
  INTO v_result, v_audit_id
  FROM public.delete_user_voice_actor_link_controlled(
    current_setting('test.link_user')::UUID,
    '56369100-0000-4000-8000-000000000007',
    current_setting('test.link_user')::UUID,
    563691001,
    v_link_id
  ) AS result;

  IF NOT v_result OR v_audit_id IS NULL
     OR EXISTS (SELECT 1 FROM public.user_voice_actor_links WHERE id = v_link_id)
     OR NOT EXISTS (
       SELECT 1 FROM public.audit_logs AS audit
       WHERE audit.id = v_audit_id
         AND audit.user_id = current_setting('test.link_user')::UUID
         AND audit.entity_type = 'user_voice_actor_link'
         AND audit.entity_id = v_link_id::TEXT
         AND audit.action = 'delete'
         AND audit.previous_value ->> 'id' = v_link_id::TEXT
         AND jsonb_typeof(audit.previous_value -> 'voice_actor_id') = 'number'
         AND audit.new_value IS NULL
         AND audit.request_id = '56369100-0000-4000-8000-000000000007'
         AND audit.request_fingerprint IS NOT NULL
         AND audit.changed_fields @> ARRAY['user_id', 'voice_actor_id']::TEXT[]
     ) THEN
    RAISE EXCEPTION 'self unlink or its complete before snapshot failed';
  END IF;

  BEGIN
    UPDATE public.audit_logs SET new_value = '{}'::JSONB WHERE id = v_audit_id;
    RAISE EXCEPTION 'authenticated user modified audit history';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    DELETE FROM public.audit_logs WHERE id = v_audit_id;
    RAISE EXCEPTION 'authenticated user deleted audit history';
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
    INSERT INTO public.user_voice_actor_links (user_id, voice_actor_id)
    VALUES (current_setting('test.link_user')::UUID, 563691001);
    RAISE EXCEPTION 'service_role directly inserted an ownership link';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    DELETE FROM public.user_voice_actor_links
    WHERE user_id = current_setting('test.link_user')::UUID;
    RAISE EXCEPTION 'service_role directly deleted an ownership link';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000563691","role":"authenticated","app_metadata":{"role":"admin"}}', TRUE);
DO $$
DECLARE
  v_deleted BOOLEAN;
  v_audit_id UUID;
  v_link_id UUID;
  v_new_link_id UUID;
  v_replayed BOOLEAN;
  v_created BOOLEAN;
  v_conflict BOOLEAN;
BEGIN
  SELECT result.link_id, result.created, result.replayed
  INTO v_link_id, v_created, v_replayed
  FROM public.admin_link_user_voice_actor_controlled(
    current_setting('test.link_admin')::UUID,
    '56369100-0000-4000-8000-000000000009',
    current_setting('test.link_user')::UUID,
    563691001
  ) AS result;
  IF v_link_id IS NULL OR v_created OR NOT v_replayed OR EXISTS (
    SELECT 1 FROM public.user_voice_actor_links
    WHERE user_id = current_setting('test.link_user')::UUID
      AND voice_actor_id = 563691001
  ) THEN
    RAISE EXCEPTION 'replayed no-op request recreated a removed relationship';
  END IF;

  SELECT result.link_id, result.created
  INTO v_link_id, v_created
  FROM public.admin_link_user_voice_actor_controlled(
    current_setting('test.link_admin')::UUID,
    '56369100-0000-4000-8000-000000000010',
    current_setting('test.link_user')::UUID,
    563691001
  ) AS result;
  IF v_link_id IS NULL OR NOT v_created THEN
    RAISE EXCEPTION 'could not create link for delete replay test';
  END IF;

  SELECT result.deleted
  INTO v_deleted
  FROM public.delete_user_voice_actor_link_controlled(
    current_setting('test.link_admin')::UUID,
    '56369100-0000-4000-8000-000000000011',
    current_setting('test.link_user')::UUID,
    563691001,
    v_link_id
  ) AS result;
  IF NOT v_deleted THEN
    RAISE EXCEPTION 'delete request did not remove its original link';
  END IF;

  SELECT result.link_id, result.created
  INTO v_new_link_id, v_created
  FROM public.admin_link_user_voice_actor_controlled(
    current_setting('test.link_admin')::UUID,
    '56369100-0000-4000-8000-000000000012',
    current_setting('test.link_user')::UUID,
    563691001
  ) AS result;
  IF v_new_link_id IS NULL OR NOT v_created OR v_new_link_id = v_link_id THEN
    RAISE EXCEPTION 'later relink did not create a distinct relationship';
  END IF;

  v_conflict := FALSE;
  BEGIN
    PERFORM * FROM public.delete_user_voice_actor_link_controlled(
      current_setting('test.link_admin')::UUID,
      '56369100-0000-4000-8000-000000000018',
      current_setting('test.link_user')::UUID,
      563691001,
      v_link_id
    );
  EXCEPTION WHEN SQLSTATE 'P2001' THEN
    v_conflict := TRUE;
  END;
  IF NOT v_conflict OR NOT EXISTS (
    SELECT 1 FROM public.user_voice_actor_links WHERE id = v_new_link_id
  ) THEN
    RAISE EXCEPTION 'stale expected link ID did not protect the later relationship';
  END IF;

  SELECT result.deleted, result.replayed
  INTO v_deleted, v_replayed
  FROM public.delete_user_voice_actor_link_controlled(
    current_setting('test.link_admin')::UUID,
    '56369100-0000-4000-8000-000000000011',
    current_setting('test.link_user')::UUID,
    563691001,
    v_link_id
  ) AS result;
  IF NOT v_deleted OR NOT v_replayed OR NOT EXISTS (
    SELECT 1 FROM public.user_voice_actor_links WHERE id = v_new_link_id
  ) THEN
    RAISE EXCEPTION 'replayed delete removed a later relationship';
  END IF;

  SELECT result.link_id INTO v_link_id
  FROM public.admin_link_user_voice_actor_controlled(
    current_setting('test.link_admin')::UUID,
    '56369100-0000-4000-8000-000000000013',
    current_setting('test.link_user')::UUID,
    563691003
  ) AS result;
  SELECT result.deleted INTO v_deleted
  FROM public.delete_user_voice_actor_link_controlled(
    current_setting('test.link_admin')::UUID,
    '56369100-0000-4000-8000-000000000014',
    current_setting('test.link_user')::UUID,
    563691003,
    v_link_id
  ) AS result;
  IF NOT v_deleted THEN
    RAISE EXCEPTION 'create retry test setup did not remove its link';
  END IF;

  SELECT result.link_id, result.created, result.replayed
  INTO v_new_link_id, v_created, v_replayed
  FROM public.admin_link_user_voice_actor_controlled(
    current_setting('test.link_admin')::UUID,
    '56369100-0000-4000-8000-000000000013',
    current_setting('test.link_user')::UUID,
    563691003
  ) AS result;
  IF NOT v_created OR NOT v_replayed OR v_new_link_id <> v_link_id OR EXISTS (
    SELECT 1 FROM public.user_voice_actor_links
    WHERE user_id = current_setting('test.link_user')::UUID
      AND voice_actor_id = 563691003
  ) THEN
    RAISE EXCEPTION 'replayed creation restored a later-removed relationship';
  END IF;

  SELECT id INTO v_link_id FROM public.user_voice_actor_links
  WHERE user_id = current_setting('test.link_user')::UUID
    AND voice_actor_id = 563691002;
  SELECT result.deleted, result.audit_log_id
  INTO v_deleted, v_audit_id
  FROM public.delete_user_voice_actor_link_controlled(
    current_setting('test.link_admin')::UUID,
    '56369100-0000-4000-8000-000000000008',
    current_setting('test.link_user')::UUID,
    563691002,
    v_link_id
  ) AS result;
  IF NOT v_deleted OR v_audit_id IS NULL THEN
    RAISE EXCEPTION 'administrator unlink did not return its audit';
  END IF;
END;
$$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000563691","role":"authenticated","app_metadata":{"role":"admin"}}', TRUE);
DO $$
DECLARE
  v_link_id UUID;
BEGIN
  SELECT result.link_id INTO v_link_id
  FROM public.admin_link_user_voice_actor_controlled(
    current_setting('test.link_admin')::UUID,
    '56369100-0000-4000-8000-000000000015',
    current_setting('test.link_failure_user')::UUID,
    563691001
  ) AS result;
  IF v_link_id IS NULL THEN
    RAISE EXCEPTION 'audit-failure unlink fixture was not created';
  END IF;
END;
$$;
RESET ROLE;

CREATE FUNCTION public.reject_t02_link_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $trigger$
BEGIN
  IF NEW.entity_type = 'user_voice_actor_link'
     AND NEW.user_id::TEXT = current_setting('test.link_admin') THEN
    RAISE EXCEPTION 'forced ownership-link audit failure';
  END IF;
  RETURN NEW;
END;
$trigger$;
CREATE TRIGGER reject_t02_link_audit
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.reject_t02_link_audit();

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000563691","role":"authenticated","app_metadata":{"role":"admin"}}', TRUE);
DO $$
DECLARE
  v_failed BOOLEAN := FALSE;
  v_link_id UUID;
BEGIN
  BEGIN
    PERFORM * FROM public.admin_link_user_voice_actor_controlled(
      current_setting('test.link_admin')::UUID,
      '56369100-0000-4000-8000-000000000016',
      current_setting('test.link_failure_user')::UUID,
      563691002
    );
  EXCEPTION WHEN raise_exception THEN
    v_failed := TRUE;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'expected audit insertion failure did not occur';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_voice_actor_links
    WHERE user_id = current_setting('test.link_failure_user')::UUID
      AND voice_actor_id = 563691002
  ) THEN
    RAISE EXCEPTION 'ownership link was created despite a failed audit insert';
  END IF;
  SELECT id INTO v_link_id FROM public.user_voice_actor_links
  WHERE user_id = current_setting('test.link_failure_user')::UUID
    AND voice_actor_id = 563691001;
  v_failed := FALSE;
  BEGIN
    PERFORM * FROM public.delete_user_voice_actor_link_controlled(
      current_setting('test.link_admin')::UUID,
      '56369100-0000-4000-8000-000000000017',
      current_setting('test.link_failure_user')::UUID,
      563691001,
      v_link_id
    );
  EXCEPTION WHEN raise_exception THEN
    v_failed := TRUE;
  END;
  IF NOT v_failed OR NOT EXISTS (
    SELECT 1 FROM public.user_voice_actor_links WHERE id = v_link_id
  ) THEN
    RAISE EXCEPTION 'failed delete audit did not roll back the relationship removal';
  END IF;
END;
$$;
RESET ROLE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_voice_actor_link_requests
    WHERE actor_id = current_setting('test.link_admin')::UUID
      AND request_id IN (
        '56369100-0000-4000-8000-000000000016',
        '56369100-0000-4000-8000-000000000017'
      )
  ) THEN
    RAISE EXCEPTION 'failed audit mutation left behind an idempotency result';
  END IF;
END;
$$;

ROLLBACK;
