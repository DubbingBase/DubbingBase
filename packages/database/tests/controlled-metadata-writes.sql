-- Run only against an isolated local database after applying all migrations.
-- All fixtures, assertions, and failure-injection triggers roll back together.
\set ON_ERROR_STOP on
BEGIN;

SELECT gen_random_uuid() AS metadata_admin_id,
       gen_random_uuid() AS metadata_non_admin_id,
       gen_random_uuid() AS metadata_request_id,
       gen_random_uuid() AS metadata_voice_request_id,
       gen_random_uuid() AS metadata_failure_request_id;
\gset
SELECT set_config('test.metadata_admin_id', :'metadata_admin_id', TRUE),
       set_config('test.metadata_non_admin_id', :'metadata_non_admin_id', TRUE),
       set_config('test.metadata_request_id', :'metadata_request_id', TRUE),
       set_config('test.metadata_voice_request_id', :'metadata_voice_request_id', TRUE),
       set_config('test.metadata_failure_request_id', :'metadata_failure_request_id', TRUE);

INSERT INTO auth.users (id, raw_app_meta_data)
VALUES
  (:'metadata_admin_id', '{"role":"admin"}'::JSONB),
  (:'metadata_non_admin_id', '{}'::JSONB);

CREATE FUNCTION public.reject_metadata_audit_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $trigger$
BEGIN
  IF NEW.user_id::TEXT = current_setting('test.fail_metadata_audit_actor', TRUE) THEN
    RAISE EXCEPTION 'forced metadata audit failure';
  END IF;
  RETURN NEW;
END;
$trigger$;
CREATE TRIGGER reject_metadata_audit_insert
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.reject_metadata_audit_insert();

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.controlled_save_metadata(uuid,text,jsonb,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.controlled_save_metadata(uuid,text,jsonb,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.controlled_save_metadata(uuid,text,jsonb,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'metadata RPC execute grants are incorrect';
  END IF;
  IF has_column_privilege('service_role', 'public.audit_logs', 'new_value', 'UPDATE')
     OR has_table_privilege('service_role', 'public.audit_logs', 'DELETE')
     OR has_table_privilege('service_role', 'public.audit_logs', 'TRUNCATE') THEN
    RAISE EXCEPTION 'service_role can modify or delete audit history';
  END IF;
END;
$$;

SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM public.controlled_save_metadata(
      current_setting('test.metadata_admin_id')::UUID,
      'job', '{"name":"Anonymous metadata write"}'::JSONB, gen_random_uuid()
    );
    RAISE EXCEPTION 'anon executed the metadata RPC';
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
    PERFORM public.controlled_save_metadata(
      current_setting('test.metadata_admin_id')::UUID,
      'job', '{"name":"Authenticated metadata write"}'::JSONB, gen_random_uuid()
    );
    RAISE EXCEPTION 'authenticated executed the service-only metadata RPC';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;
RESET ROLE;

SET LOCAL ROLE service_role;
DO $$
DECLARE
  admin_id UUID := current_setting('test.metadata_admin_id')::UUID;
  non_admin_id UUID := current_setting('test.metadata_non_admin_id')::UUID;
  request_id UUID := current_setting('test.metadata_request_id')::UUID;
  voice_request_id UUID := current_setting('test.metadata_voice_request_id')::UUID;
  failure_request_id UUID := current_setting('test.metadata_failure_request_id')::UUID;
  job_result JSONB;
  retry_result JSONB;
  voice_result JSONB;
  audit_count BIGINT;
BEGIN
  BEGIN
    PERFORM public.controlled_save_metadata(
      non_admin_id, 'job', '{"name":"Non-admin metadata write"}'::JSONB, gen_random_uuid()
    );
    RAISE EXCEPTION 'non-admin actor was accepted';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  job_result := public.controlled_save_metadata(
    admin_id, 'job', '{"name":"Controlled metadata job"}'::JSONB, request_id
  );
  IF job_result -> 'record' ->> 'name' <> 'Controlled metadata job'
     OR (job_result ->> 'replayed')::BOOLEAN IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'job creation returned an unexpected result';
  END IF;
  PERFORM set_config('test.metadata_audit_id', job_result ->> 'audit_log_id', TRUE);

  retry_result := public.controlled_save_metadata(
    admin_id, 'job', '{"name":"Controlled metadata job"}'::JSONB, request_id
  );
  IF (retry_result ->> 'replayed')::BOOLEAN IS DISTINCT FROM TRUE
     OR retry_result ->> 'audit_log_id' IS DISTINCT FROM job_result ->> 'audit_log_id' THEN
    RAISE EXCEPTION 'identical retry did not replay the original audit result';
  END IF;

  retry_result := public.controlled_save_metadata(
    admin_id, 'job', '{"name":"Deterministic retry job"}'::JSONB
  );
  IF (public.controlled_save_metadata(
        admin_id, 'job', '{"name":"Deterministic retry job"}'::JSONB
      ) ->> 'replayed')::BOOLEAN IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'request without a client key was not retry-safe';
  END IF;

  BEGIN
    PERFORM public.controlled_save_metadata(
      admin_id, 'job', '{"name":"Different payload"}'::JSONB, request_id
    );
    RAISE EXCEPTION 'request key was reused with different data';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  BEGIN
    PERFORM public.controlled_save_metadata(
      admin_id, 'job', '{"name":"Controlled metadata job"}'::JSONB, gen_random_uuid()
    );
    RAISE EXCEPTION 'duplicate job was accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
  SELECT count(*) INTO audit_count
  FROM public.audit_logs
  WHERE user_id = admin_id AND entity_type = 'job'
    AND new_value ->> 'name' = 'Controlled metadata job';
  IF audit_count <> 1 THEN
    RAISE EXCEPTION 'failed duplicate mutation wrote an extra audit';
  END IF;

  BEGIN
    PERFORM public.controlled_save_metadata(
      admin_id, 'voice_actor', '{"created_by":"00000000-0000-0000-0000-000000000001","firstname":"Protected","lastname":"Field"}'::JSONB, gen_random_uuid()
    );
    RAISE EXCEPTION 'protected voice actor field was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN
    NULL;
  END;
  BEGIN
    PERFORM public.controlled_save_metadata(
      admin_id, 'voice_actor', '{"firstname":"Large","lastname":"Identifier","tmdb_id":9223372036854775808}'::JSONB, gen_random_uuid()
    );
    RAISE EXCEPTION 'out-of-range TMDB identifier was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN
    NULL;
  END;
  BEGIN
    PERFORM public.controlled_save_metadata(
      admin_id, 'voice_actor', '{"firstname":"Sensitive","lastname":"URL","social_media_links":{"website":"https://example.test/?access_token=example"}}'::JSONB, gen_random_uuid()
    );
    RAISE EXCEPTION 'credential-bearing social URL was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN
    NULL;
  END;

  voice_result := public.controlled_save_metadata(
    admin_id,
    'voice_actor',
    '{"firstname":"Ada","lastname":"Lovelace","date_of_birth":"1815-12-10","tmdb_id":88,"wikidata_id":"Q7259","social_media_links":{"website":"https://example.test/ada"}}'::JSONB,
    voice_request_id
  );
  IF voice_result -> 'record' ->> 'date_of_birth' <> '1815-12-10'
     OR jsonb_typeof(voice_result -> 'record' -> 'tmdb_id') <> 'number'
     OR voice_result -> 'record' ->> 'created_by' IS DISTINCT FROM admin_id::TEXT THEN
    RAISE EXCEPTION 'voice actor snapshot lost typed values or actor attribution';
  END IF;

  SELECT count(*) INTO audit_count
  FROM public.audit_logs AS audit
  WHERE audit.id = (voice_result ->> 'audit_log_id')::UUID
    AND audit.user_id = admin_id
    AND audit.entity_type = 'voice_actor'
    AND audit.entity_id = voice_result -> 'record' ->> 'id'
    AND audit.action = 'create'
    AND audit.previous_value IS NULL
    AND audit.new_value = voice_result -> 'record'
    AND audit.created_at IS NOT NULL;
  IF audit_count <> 1 THEN
    RAISE EXCEPTION 'voice actor audit snapshot is missing or incorrect';
  END IF;
  PERFORM set_config('test.metadata_voice_audit_id', voice_result ->> 'audit_log_id', TRUE);

  PERFORM set_config('test.fail_metadata_audit_actor', admin_id::TEXT, TRUE);
  BEGIN
    PERFORM public.controlled_save_metadata(
      admin_id,
      'job',
      '{"name":"Audit failure must roll back"}'::JSONB,
      failure_request_id
    );
    RAISE EXCEPTION 'audit failure injection was not observed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'forced metadata audit failure' THEN
      RAISE;
    END IF;
  END;
END;
$$;
RESET ROLE;

DO $$
DECLARE
  admin_id UUID := current_setting('test.metadata_admin_id')::UUID;
  audit_id UUID := current_setting('test.metadata_audit_id')::UUID;
  job_count BIGINT;
  audit_count BIGINT;
  request_count BIGINT;
BEGIN
  SELECT count(*) INTO job_count FROM public.jobs WHERE name = 'Audit failure must roll back';
  SELECT count(*) INTO audit_count FROM public.audit_logs
  WHERE user_id = admin_id AND action = 'create' AND entity_type = 'job'
    AND new_value ->> 'name' = 'Audit failure must roll back';
  SELECT count(*) INTO request_count FROM private.metadata_write_requests
  WHERE actor_id = admin_id AND request_id = current_setting('test.metadata_failure_request_id')::UUID;
  IF job_count <> 0 OR audit_count <> 0 OR request_count <> 0 THEN
    RAISE EXCEPTION 'audit failure left a partial metadata mutation';
  END IF;

  SELECT count(*) INTO audit_count FROM public.audit_logs
  WHERE id = audit_id AND new_value ->> 'name' = 'Controlled metadata job';
  IF audit_count <> 1 THEN
    RAISE EXCEPTION 'valid job audit snapshot was not persisted';
  END IF;

  SELECT count(*) INTO request_count FROM private.metadata_write_requests AS request
  JOIN public.audit_logs AS audit ON audit.id = request.audit_log_id
  WHERE request.audit_log_id = audit_id
    AND request.actor_id = admin_id
    AND request.entity_id = audit.entity_id;
  IF request_count <> 1 THEN
    RAISE EXCEPTION 'request metadata is not linked to the mutation audit';
  END IF;
END;
$$;

SET LOCAL ROLE service_role;
UPDATE public.audit_logs
SET reverted_at = clock_timestamp()
WHERE id = current_setting('test.metadata_audit_id')::UUID;
RESET ROLE;

CREATE ROLE controlled_metadata_audit_attacker NOLOGIN;
GRANT controlled_metadata_audit_attacker TO postgres;
GRANT authenticated TO controlled_metadata_audit_attacker;
GRANT SELECT, UPDATE, DELETE ON public.audit_logs TO controlled_metadata_audit_attacker;
CREATE POLICY "test attacker can update audit history"
  ON public.audit_logs FOR UPDATE TO controlled_metadata_audit_attacker
  USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "test attacker can delete audit history"
  ON public.audit_logs FOR DELETE TO controlled_metadata_audit_attacker
  USING (TRUE);
SET LOCAL ROLE controlled_metadata_audit_attacker;
DO $$
DECLARE
  audit_id UUID := current_setting('test.metadata_audit_id')::UUID;
  voice_audit_id UUID := current_setting('test.metadata_voice_audit_id')::UUID;
BEGIN
  BEGIN
    UPDATE public.audit_logs SET new_value = '{}'::JSONB WHERE id = audit_id;
    RAISE EXCEPTION 'audit modification was accepted';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    NULL;
  END;
  BEGIN
    DELETE FROM public.audit_logs WHERE id = audit_id;
    RAISE EXCEPTION 'audit deletion was accepted';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    NULL;
  END;
  BEGIN
    UPDATE public.audit_logs SET reverted_at = clock_timestamp() WHERE id = voice_audit_id;
    RAISE EXCEPTION 'unauthorized audit reversion marker was accepted';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    NULL;
  END;
END;
$$;
RESET ROLE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_logs
    WHERE id = current_setting('test.metadata_audit_id')::UUID
      AND new_value ->> 'name' = 'Controlled metadata job'
      AND reverted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'audit history changed after rejected modification or deletion';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.audit_logs
    WHERE id = current_setting('test.metadata_voice_audit_id')::UUID
      AND reverted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'unauthorized actor changed the audit reversion marker';
  END IF;
END;
$$;

ROLLBACK;
