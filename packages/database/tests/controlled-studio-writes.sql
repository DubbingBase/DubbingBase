BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'studios'
      AND column_name = 'updated_at'
      AND is_nullable = 'NO'
      AND column_default IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'studio updated_at must have a default and be NOT NULL';
  END IF;
END;
$$;

INSERT INTO auth.users (id, raw_app_meta_data) VALUES
  ('00000000-0000-0000-0000-000000563651', '{}'::JSONB),
  ('00000000-0000-0000-0000-000000563652', '{"role":"editor"}'::JSONB);

SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.controlled_save_studio(
      '00000000-0000-0000-0000-000000563651', NULL, NULL,
      'e51cfeb6-411e-40bf-994e-f75cf48ef53c', '{"name":"Anonymous attempt"}'::JSONB
    );
    RAISE EXCEPTION 'anon unexpectedly executed controlled_save_studio';
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
    PERFORM * FROM public.controlled_save_studio(
      '00000000-0000-0000-0000-000000563651', NULL, NULL,
      'e51cfeb6-411e-40bf-994e-f75cf48ef53c', '{"name":"Unauthorized attempt"}'::JSONB
    );
    RAISE EXCEPTION 'authenticated unexpectedly executed controlled_save_studio';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;
RESET ROLE;

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000563651';
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000563651","role":"authenticated","app_metadata":{}}';
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    INSERT INTO public.studios (name) VALUES ('Unauthorized direct studio write');
    RAISE EXCEPTION 'non-editor unexpectedly inserted a studio directly';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;
RESET ROLE;
RESET request.jwt.claim.sub;
RESET request.jwt.claims;

SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    INSERT INTO public.studios (name) VALUES ('Anonymous direct studio write');
    RAISE EXCEPTION 'anon unexpectedly inserted a studio directly';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;
RESET ROLE;

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000563652';
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000563652","role":"authenticated","app_metadata":{"role":"editor"}}';
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_studio_id BIGINT;
  v_audit_count INTEGER;
BEGIN
  INSERT INTO public.studios (name, country)
  VALUES ('Audited direct editor studio', 'France')
  RETURNING id INTO v_studio_id;

  SELECT count(*) INTO v_audit_count
  FROM public.audit_logs
  WHERE entity_type = 'studio'
    AND entity_id = v_studio_id::TEXT
    AND user_id = '00000000-0000-0000-0000-000000563652'
    AND action = 'create'
    AND metadata ->> 'source' = 'database_trigger'
    AND metadata ->> 'transaction_id' IS NOT NULL
    AND new_value ->> 'country' = 'France';
  IF v_audit_count <> 1 THEN
    RAISE EXCEPTION 'authenticated editor insert did not persist one audit event';
  END IF;

  UPDATE public.studios SET city = 'Lille' WHERE id = v_studio_id;
  SELECT count(*) INTO v_audit_count
  FROM public.audit_logs
  WHERE entity_type = 'studio'
    AND entity_id = v_studio_id::TEXT
    AND user_id = '00000000-0000-0000-0000-000000563652'
    AND action = 'update'
    AND previous_value = '{"city":null}'::JSONB
    AND new_value = '{"city":"Lille"}'::JSONB
    AND changed_fields = ARRAY['city']::TEXT[];
  IF v_audit_count <> 1 THEN
    RAISE EXCEPTION 'authenticated editor update did not persist its exact before/after audit';
  END IF;

  BEGIN
    UPDATE public.studios SET created_at = clock_timestamp() WHERE id = v_studio_id;
    RAISE EXCEPTION 'editor unexpectedly modified protected created_at';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;
RESET ROLE;
RESET request.jwt.claim.sub;
RESET request.jwt.claims;

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000563651';
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000563651","role":"authenticated","app_metadata":{}}';
SET LOCAL ROLE authenticated;
UPDATE public.studios
SET city = 'Unauthorized overwrite'
WHERE name = 'Audited direct editor studio';
RESET ROLE;
RESET request.jwt.claim.sub;
RESET request.jwt.claims;
DO $$
BEGIN
  IF (SELECT city FROM public.studios WHERE name = 'Audited direct editor studio') IS DISTINCT FROM 'Lille' THEN
    RAISE EXCEPTION 'non-editor modified a studio through direct table access';
  END IF;
  IF (SELECT count(*) FROM public.audit_logs
      WHERE entity_type = 'studio' AND entity_id = (
        SELECT id::TEXT FROM public.studios WHERE name = 'Audited direct editor studio'
      )) <> 2 THEN
    RAISE EXCEPTION 'unauthorized direct update created an audit event';
  END IF;
END;
$$;

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000563652';
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000563652","role":"authenticated","app_metadata":{"role":"editor"}}';
SET LOCAL ROLE authenticated;
DELETE FROM public.studios WHERE name = 'Audited direct editor studio';
RESET ROLE;
RESET request.jwt.claim.sub;
RESET request.jwt.claims;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_logs
    WHERE entity_type = 'studio'
      AND action = 'delete'
      AND user_id = '00000000-0000-0000-0000-000000563652'
      AND previous_value ->> 'name' = 'Audited direct editor studio'
      AND new_value = '{}'::JSONB
  ) THEN
    RAISE EXCEPTION 'authorized editor studio deletion did not retain a full audit snapshot';
  END IF;
END;
$$;

SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_studio_id BIGINT;
  v_audit_id UUID;
  v_replayed BOOLEAN;
  v_updated_at TIMESTAMP WITHOUT TIME ZONE;
  v_second_audit UUID;
  v_noop_audit_id UUID;
  v_count INTEGER;
BEGIN
  SELECT result.studio_id, result.audit_log_id, result.replayed
  INTO v_studio_id, v_audit_id, v_replayed
  FROM public.controlled_save_studio(
    '00000000-0000-0000-0000-000000563651', NULL, NULL,
    'e51cfeb6-411e-40bf-994e-f75cf48ef53c',
    '{"name":"Audited community studio","city":"Paris","website_url":"https://studio.example"}'::JSONB
  ) AS result;

  IF v_studio_id IS NULL OR v_audit_id IS NULL OR v_replayed THEN
    RAISE EXCEPTION 'authorized studio creation returned an invalid result';
  END IF;
  PERFORM set_config('app.skip_studio_audit', 'false', TRUE);

  SELECT count(*) INTO v_count
  FROM public.audit_logs AS audit
  WHERE audit.id = v_audit_id
    AND audit.user_id = '00000000-0000-0000-0000-000000563651'
    AND audit.entity_type = 'studio'
    AND audit.entity_id = v_studio_id::TEXT
    AND audit.action = 'create'
    AND audit.changed_fields = ARRAY[
      'city', 'country', 'created_at', 'description', 'id', 'logo_url',
      'name', 'social_media_links', 'updated_at', 'website_url'
    ]::TEXT[]
    AND audit.previous_value = '{}'::JSONB
    AND audit.new_value ->> 'city' = 'Paris'
    AND audit.new_value ->> 'name' = 'Audited community studio'
    AND audit.new_value ->> 'website_url' = 'https://studio.example'
    AND jsonb_typeof(audit.new_value -> 'id') = 'number'
    AND jsonb_typeof(audit.new_value -> 'created_at') = 'string'
    AND audit.request_id = 'e51cfeb6-411e-40bf-994e-f75cf48ef53c'
    AND audit.metadata ->> 'source' = '/api/save-studio';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'studio creation audit is missing actor, request, fields, or typed snapshots';
  END IF;

  SELECT studio.updated_at INTO v_updated_at
  FROM public.studios AS studio WHERE studio.id = v_studio_id;

  SELECT result.audit_log_id, result.replayed
  INTO v_second_audit, v_replayed
  FROM public.controlled_save_studio(
    '00000000-0000-0000-0000-000000563651', v_studio_id, v_updated_at,
    '83a4a872-7663-4f32-8e35-4b96e0dcf7bb',
    '{"city":"Lyon","social_media_links":{"instagram":"https://instagram.com/studio"}}'::JSONB
  ) AS result;
  PERFORM set_config('app.skip_studio_audit', 'false', TRUE);

  IF v_second_audit IS NULL OR v_replayed THEN
    RAISE EXCEPTION 'authorized studio update returned an invalid result';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.audit_logs AS audit
  WHERE audit.id = v_second_audit
    AND audit.previous_value = '{"city":"Paris","social_media_links":null}'::JSONB
    AND audit.new_value = '{"city":"Lyon","social_media_links":{"instagram":"https://instagram.com/studio"}}'::JSONB
    AND audit.changed_fields = ARRAY['city', 'social_media_links']::TEXT[];
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'studio update did not preserve exact before/after values';
  END IF;

  SELECT result.audit_log_id, result.replayed
  INTO v_audit_id, v_replayed
  FROM public.controlled_save_studio(
    '00000000-0000-0000-0000-000000563651', v_studio_id, v_updated_at,
    '83a4a872-7663-4f32-8e35-4b96e0dcf7bb',
    '{"city":"Lyon","social_media_links":{"instagram":"https://instagram.com/studio"}}'::JSONB
  ) AS result;
  PERFORM set_config('app.skip_studio_audit', 'false', TRUE);
  IF v_audit_id IS DISTINCT FROM v_second_audit OR NOT v_replayed THEN
    RAISE EXCEPTION 'identical retry did not return the original audit event';
  END IF;

  BEGIN
    PERFORM * FROM public.controlled_save_studio(
      '00000000-0000-0000-0000-000000563651', v_studio_id, v_updated_at,
      '83a4a872-7663-4f32-8e35-4b96e0dcf7bb', '{"city":"Changed retry"}'::JSONB
    );
    RAISE EXCEPTION 'request id was reused with different data';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  BEGIN
    PERFORM * FROM public.controlled_save_studio(
      '00000000-0000-0000-0000-000000563651', v_studio_id, v_updated_at,
      '2e89b9d1-8a92-42b3-97a9-f357e0c2da48', '{"city":"Stale overwrite"}'::JSONB
    );
    RAISE EXCEPTION 'stale studio version was accepted';
  EXCEPTION WHEN serialization_failure THEN
    NULL;
  END;

  SELECT studio.updated_at INTO v_updated_at
  FROM public.studios AS studio WHERE studio.id = v_studio_id;

  SELECT result.audit_log_id, result.replayed
  INTO v_noop_audit_id, v_replayed
  FROM public.controlled_save_studio(
    '00000000-0000-0000-0000-000000563651', v_studio_id, v_updated_at,
    '45f4df18-7c72-4a4d-b738-d4f886745d1a', '{"city":"Lyon"}'::JSONB
  ) AS result;
  IF v_noop_audit_id IS NULL OR v_replayed THEN
    RAISE EXCEPTION 'no-op studio save did not create a retry receipt';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.audit_logs AS audit
  WHERE audit.id = v_noop_audit_id
    AND audit.action = 'noop'
    AND audit.previous_value = '{}'::JSONB
    AND audit.new_value = '{}'::JSONB
    AND audit.changed_fields = ARRAY[]::TEXT[];
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'no-op retry receipt did not retain an empty audit delta';
  END IF;

  SELECT result.audit_log_id, result.replayed
  INTO v_second_audit, v_replayed
  FROM public.controlled_save_studio(
    '00000000-0000-0000-0000-000000563651', v_studio_id, v_updated_at,
    '45f4df18-7c72-4a4d-b738-d4f886745d1a', '{"city":"Lyon"}'::JSONB
  ) AS result;
  IF v_second_audit IS DISTINCT FROM v_noop_audit_id OR NOT v_replayed THEN
    RAISE EXCEPTION 'identical no-op retry did not return its original receipt';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.get_recent_contributions(1000) AS contribution
  WHERE contribution.id = v_noop_audit_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'no-op retry receipt appeared in the public contribution feed';
  END IF;

  BEGIN
    PERFORM * FROM public.controlled_save_studio(
      '00000000-0000-0000-0000-000000563651', v_studio_id, NULL,
      '1d37ad62-990e-4b2a-a33c-9a07eab16f8f', '{"created_at":"2020-01-01"}'::JSONB
    );
    RAISE EXCEPTION 'protected field was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN
    NULL;
  END;

  BEGIN
    PERFORM * FROM public.controlled_save_studio(
      '00000000-0000-0000-0000-000000563651', v_studio_id, v_updated_at,
      '81a2b916-dbb3-4a18-b6e0-8b0267ef9f8a', '{"logo_url":"https://cdn.example/logo.png"}'::JSONB
    );
    RAISE EXCEPTION 'community user changed a protected logo';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    PERFORM * FROM public.controlled_save_studio(
      '00000000-0000-0000-0000-000000563651', 999999999, NULL,
      '926e615a-8f32-4c66-8ad2-232254e5fab4', '{"city":"Missing"}'::JSONB
    );
    RAISE EXCEPTION 'missing studio was accepted';
  EXCEPTION WHEN no_data_found THEN
    NULL;
  END;

  SELECT count(*) INTO v_count
  FROM public.audit_logs
  WHERE user_id = '00000000-0000-0000-0000-000000563651'
    AND entity_id = v_studio_id::TEXT;
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'create, update, and no-op save did not each persist one audit event';
  END IF;

  IF (SELECT city FROM public.studios WHERE id = v_studio_id) <> 'Lyon' THEN
    RAISE EXCEPTION 'rejected request changed persisted studio state';
  END IF;
END;
$$;
RESET ROLE;

CREATE OR REPLACE FUNCTION public.test_fail_studio_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.city = 'Mutation failure fixture' THEN
    RAISE EXCEPTION 'injected studio mutation failure';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER test_fail_studio_update
  BEFORE UPDATE ON public.studios
  FOR EACH ROW EXECUTE FUNCTION public.test_fail_studio_update();

CREATE OR REPLACE FUNCTION public.test_fail_studio_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.request_id = 'ea2f07d0-9b29-4d42-b3ed-64c26158de07' THEN
    RAISE EXCEPTION 'injected studio audit failure';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER test_fail_studio_audit
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.test_fail_studio_audit();

SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_studio_id BIGINT;
  v_updated_at TIMESTAMP WITHOUT TIME ZONE;
  v_failed BOOLEAN;
  v_count INTEGER;
BEGIN
  SELECT id, updated_at INTO v_studio_id, v_updated_at
  FROM public.studios WHERE name = 'Audited community studio';

  v_failed := FALSE;
  BEGIN
    PERFORM * FROM public.controlled_save_studio(
      '00000000-0000-0000-0000-000000563651', v_studio_id, v_updated_at,
      'c4c7ecc6-0cf8-45c0-bff1-4ed173891801', '{"city":"Mutation failure fixture"}'::JSONB
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := TRUE;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'injected mutation failure did not fail the operation';
  END IF;

  IF (SELECT city FROM public.studios WHERE id = v_studio_id) <> 'Lyon' THEN
    RAISE EXCEPTION 'studio state changed after mutation failure';
  END IF;
  SELECT count(*) INTO v_count FROM public.audit_logs
  WHERE request_id = 'c4c7ecc6-0cf8-45c0-bff1-4ed173891801';
  IF v_count <> 0 THEN RAISE EXCEPTION 'mutation failure left an audit event'; END IF;

  SELECT updated_at INTO v_updated_at FROM public.studios WHERE id = v_studio_id;
  v_failed := FALSE;
  BEGIN
    PERFORM * FROM public.controlled_save_studio(
      '00000000-0000-0000-0000-000000563651', v_studio_id, v_updated_at,
      'ea2f07d0-9b29-4d42-b3ed-64c26158de07', '{"city":"Audit failure fixture"}'::JSONB
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := TRUE;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'injected audit failure did not fail the operation';
  END IF;

  IF (SELECT city FROM public.studios WHERE id = v_studio_id) <> 'Lyon' THEN
    RAISE EXCEPTION 'studio state changed after audit failure';
  END IF;
  SELECT count(*) INTO v_count FROM public.audit_logs
  WHERE request_id = 'ea2f07d0-9b29-4d42-b3ed-64c26158de07';
  IF v_count <> 0 THEN RAISE EXCEPTION 'audit failure left a partial event'; END IF;
END;
$$;
RESET ROLE;

DROP TRIGGER test_fail_studio_update ON public.studios;
DROP FUNCTION public.test_fail_studio_update();
DROP TRIGGER test_fail_studio_audit ON public.audit_logs;
DROP FUNCTION public.test_fail_studio_audit();

SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_audit_id UUID;
  v_original_new_value JSONB;
BEGIN
  IF has_table_privilege('service_role', 'public.audit_logs', 'TRUNCATE') THEN
    RAISE EXCEPTION 'service_role can truncate audit history';
  END IF;

  SELECT id, new_value INTO v_audit_id, v_original_new_value
  FROM public.audit_logs
  WHERE request_id = 'e51cfeb6-411e-40bf-994e-f75cf48ef53c';

  BEGIN
    UPDATE public.audit_logs SET new_value = '{}'::JSONB WHERE id = v_audit_id;
    RAISE EXCEPTION 'service_role modified an immutable snapshot';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    DELETE FROM public.audit_logs WHERE id = v_audit_id;
    RAISE EXCEPTION 'service_role deleted an immutable event';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  UPDATE public.audit_logs SET reverted_at = clock_timestamp() WHERE id = v_audit_id;
  BEGIN
    UPDATE public.audit_logs SET reverted_at = NULL WHERE id = v_audit_id;
    RAISE EXCEPTION 'service_role cleared a one-way revert marker';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    NULL;
  END;

  IF (SELECT new_value FROM public.audit_logs WHERE id = v_audit_id) IS DISTINCT FROM v_original_new_value THEN
    RAISE EXCEPTION 'audit snapshot changed while marking it reverted';
  END IF;
END;
$$;
RESET ROLE;

CREATE ROLE studio_audit_probe_56365 NOLOGIN;
GRANT SELECT, UPDATE, DELETE ON public.audit_logs TO studio_audit_probe_56365;
GRANT studio_audit_probe_56365 TO postgres;
CREATE POLICY "Temporary audit immutability probe" ON public.audit_logs
  FOR ALL TO studio_audit_probe_56365 USING (TRUE) WITH CHECK (TRUE);

SET LOCAL ROLE studio_audit_probe_56365;
DO $$
DECLARE
  v_audit_id UUID;
  v_original_new_value JSONB;
BEGIN
  SELECT id, new_value INTO v_audit_id, v_original_new_value
  FROM public.audit_logs
  WHERE request_id = '83a4a872-7663-4f32-8e35-4b96e0dcf7bb';
  IF v_audit_id IS NULL THEN
    RAISE EXCEPTION 'audit immutability probe could not find its target event';
  END IF;

  BEGIN
    UPDATE public.audit_logs SET new_value = '{}'::JSONB WHERE id = v_audit_id;
    RAISE EXCEPTION 'role with UPDATE privilege modified an immutable snapshot';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    NULL;
  END;

  BEGIN
    DELETE FROM public.audit_logs WHERE id = v_audit_id;
    RAISE EXCEPTION 'role with DELETE privilege deleted an immutable event';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    NULL;
  END;

  IF NOT has_table_privilege(current_user, 'public.audit_logs', 'UPDATE')
     OR NOT has_table_privilege(current_user, 'public.audit_logs', 'DELETE')
     OR (SELECT new_value FROM public.audit_logs WHERE id = v_audit_id)
       IS DISTINCT FROM v_original_new_value THEN
    RAISE EXCEPTION 'audit immutability probe did not preserve the snapshot';
  END IF;
END;
$$;
RESET ROLE;

ROLLBACK;
