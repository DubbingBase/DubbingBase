-- Run only against an isolated local database after applying all migrations.
-- All fixture rows, assertions, and failure-injection triggers roll back together.
\set ON_ERROR_STOP on
BEGIN;

INSERT INTO auth.users (id, raw_app_meta_data)
VALUES
  ('00000000-0000-0000-0000-000000563655', '{"role":"admin"}'::JSONB),
  ('00000000-0000-0000-0000-000000563656', '{}'::JSONB),
  ('00000000-0000-0000-0000-000000563657', '{}'::JSONB);

INSERT INTO public.voice_actors (firstname, lastname, bio)
VALUES ('Controlled', 'Voice Actor', 'Before')
RETURNING id AS voice_actor_id \gset

INSERT INTO public.voice_actors (firstname, lastname)
VALUES ('Picture', 'Compatibility')
RETURNING id AS picture_voice_actor_id \gset

INSERT INTO public.user_voice_actor_links (user_id, voice_actor_id)
VALUES ('00000000-0000-0000-0000-000000563656', :voice_actor_id);

CREATE FUNCTION public.reject_voice_actor_audit_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $trigger$
BEGIN
  IF NEW.user_id::TEXT = current_setting('test.fail_voice_actor_audit_actor', TRUE) THEN
    RAISE EXCEPTION 'forced voice actor audit failure';
  END IF;
  RETURN NEW;
END;
$trigger$;
CREATE TRIGGER reject_voice_actor_audit_insert
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.reject_voice_actor_audit_insert();

CREATE FUNCTION public.reject_voice_actor_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $trigger$
BEGIN
  IF NEW.id::TEXT = current_setting('test.fail_voice_actor_update_id', TRUE) THEN
    RAISE EXCEPTION 'forced voice actor update failure';
  END IF;
  RETURN NEW;
END;
$trigger$;
CREATE TRIGGER reject_voice_actor_update
  BEFORE UPDATE ON public.voice_actors
  FOR EACH ROW EXECUTE FUNCTION public.reject_voice_actor_update();

DO $$
BEGIN
  IF has_table_privilege('anon', 'public.voice_actors', 'INSERT')
     OR has_table_privilege('anon', 'public.voice_actors', 'UPDATE')
     OR has_table_privilege('anon', 'public.voice_actors', 'DELETE')
     OR has_table_privilege('anon', 'public.voice_actors', 'TRUNCATE')
     OR has_table_privilege('anon', 'public.voice_actors', 'REFERENCES')
     OR has_table_privilege('anon', 'public.voice_actors', 'TRIGGER')
     OR has_table_privilege('authenticated', 'public.voice_actors', 'INSERT')
     OR has_table_privilege('authenticated', 'public.voice_actors', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.voice_actors', 'DELETE')
     OR has_table_privilege('authenticated', 'public.voice_actors', 'TRUNCATE')
     OR has_table_privilege('authenticated', 'public.voice_actors', 'REFERENCES')
     OR has_table_privilege('authenticated', 'public.voice_actors', 'TRIGGER')
     OR NOT has_table_privilege('anon', 'public.voice_actors', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.voice_actors', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.voice_actors', 'UPDATE') THEN
    RAISE EXCEPTION 'voice actor browser write or service-role grants are incorrect';
  END IF;
  IF has_sequence_privilege('anon', 'public.voice_actors_id_seq', 'USAGE')
     OR has_sequence_privilege('anon', 'public.voice_actors_id_seq', 'SELECT')
     OR has_sequence_privilege('anon', 'public.voice_actors_id_seq', 'UPDATE')
     OR has_sequence_privilege('authenticated', 'public.voice_actors_id_seq', 'USAGE')
     OR has_sequence_privilege('authenticated', 'public.voice_actors_id_seq', 'SELECT')
     OR has_sequence_privilege('authenticated', 'public.voice_actors_id_seq', 'UPDATE')
     OR NOT has_sequence_privilege('service_role', 'public.voice_actors_id_seq', 'USAGE')
     OR NOT has_sequence_privilege('service_role', 'public.voice_actors_id_seq', 'UPDATE') THEN
    RAISE EXCEPTION 'voice actor browser or service-role sequence grants are incorrect';
  END IF;
  IF has_function_privilege('anon', 'public.controlled_update_voice_actor(uuid,bigint,jsonb,timestamptz,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.controlled_update_voice_actor(uuid,bigint,jsonb,timestamptz,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.controlled_update_voice_actor(uuid,bigint,jsonb,timestamptz,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'voice actor update RPC execute grants are incorrect';
  END IF;
  IF has_column_privilege('service_role', 'public.audit_logs', 'new_value', 'UPDATE')
     OR has_table_privilege('service_role', 'public.audit_logs', 'DELETE')
     OR has_table_privilege('service_role', 'public.audit_logs', 'TRUNCATE') THEN
    RAISE EXCEPTION 'service_role can modify or delete audit history';
  END IF;
END;
$$;

SELECT set_config('test.voice_actor_id', :'voice_actor_id', TRUE);
SELECT set_config('test.picture_voice_actor_id', :'picture_voice_actor_id', TRUE);

SET LOCAL ROLE anon;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.voice_actors WHERE id = current_setting('test.voice_actor_id')::BIGINT
  ) THEN
    RAISE EXCEPTION 'anonymous users lost public profile read access';
  END IF;

  BEGIN
    PERFORM public.controlled_update_voice_actor(
      '00000000-0000-0000-0000-000000563656',
      current_setting('test.voice_actor_id')::BIGINT,
      '{"bio":"Anonymous update"}'::JSONB,
      clock_timestamp(), gen_random_uuid()
    );
    RAISE EXCEPTION 'anon executed the voice actor update RPC';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000563655","role":"authenticated","app_metadata":{"role":"admin"}}',
  TRUE
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.voice_actors WHERE id = current_setting('test.voice_actor_id')::BIGINT
  ) THEN
    RAISE EXCEPTION 'authenticated users lost public profile read access';
  END IF;

  BEGIN
    UPDATE public.voice_actors SET bio = 'Direct bypass'
    WHERE id = current_setting('test.voice_actor_id')::BIGINT;
    RAISE EXCEPTION 'authenticated admin performed a direct update';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    INSERT INTO public.voice_actors (firstname, lastname) VALUES ('Direct', 'Insert');
    RAISE EXCEPTION 'authenticated admin performed a direct insert';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    DELETE FROM public.voice_actors WHERE id = current_setting('test.voice_actor_id')::BIGINT;
    RAISE EXCEPTION 'authenticated admin performed a direct delete';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF (SELECT bio FROM public.voice_actors WHERE id = current_setting('test.voice_actor_id')::BIGINT)
       IS DISTINCT FROM 'Before' THEN
    RAISE EXCEPTION 'a denied direct write changed the persisted profile';
  END IF;

  BEGIN
    PERFORM public.controlled_update_voice_actor(
      '00000000-0000-0000-0000-000000563656',
      current_setting('test.voice_actor_id')::BIGINT,
      '{"bio":"Authenticated RPC update"}'::JSONB,
      clock_timestamp(), gen_random_uuid()
    );
    RAISE EXCEPTION 'authenticated executed the service-only voice actor RPC';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;
RESET ROLE;

SET LOCAL ROLE service_role;
DO $$
BEGIN
  UPDATE public.voice_actors
  SET profile_picture = 'test/picture.png'
  WHERE id = current_setting('test.picture_voice_actor_id')::BIGINT;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.voice_actors
    WHERE id = current_setting('test.picture_voice_actor_id')::BIGINT
      AND profile_picture = 'test/picture.png'
  ) THEN
    RAISE EXCEPTION 'service-role picture upload compatibility was broken';
  END IF;
END;
$$;

DO $$
DECLARE
  voice_actor_id BIGINT := current_setting('test.voice_actor_id')::BIGINT;
  linked_user UUID := '00000000-0000-0000-0000-000000563656';
  unlinked_user UUID := '00000000-0000-0000-0000-000000563657';
  admin_user UUID := '00000000-0000-0000-0000-000000563655';
  first_request UUID := '11111111-1111-4111-8111-111111111111';
  failed_request UUID := '22222222-2222-4222-8222-222222222222';
  failed_mutation_request UUID := '33333333-3333-4333-8333-333333333333';
  first_result JSONB;
  replay_result JSONB;
  before_row JSONB;
  current_row JSONB;
  expected_updated_at TIMESTAMPTZ;
  audit_count BIGINT;
BEGIN
  SELECT actor.updated_at INTO expected_updated_at
  FROM public.voice_actors AS actor WHERE actor.id = voice_actor_id;

  BEGIN
    PERFORM public.controlled_update_voice_actor(
      unlinked_user, voice_actor_id, '{"bio":"Unlinked update"}'::JSONB,
      expected_updated_at, gen_random_uuid()
    );
    RAISE EXCEPTION 'unlinked authenticated user changed a voice actor';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    PERFORM public.controlled_update_voice_actor(
      linked_user, voice_actor_id, '{"created_by":"00000000-0000-0000-0000-000000563657"}'::JSONB,
      expected_updated_at, gen_random_uuid()
    );
    RAISE EXCEPTION 'protected field modification was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN
    NULL;
  END;

  BEGIN
    PERFORM public.controlled_update_voice_actor(
      linked_user, voice_actor_id, '{"date_of_birth":"1815-02-31"}'::JSONB,
      expected_updated_at, gen_random_uuid()
    );
    RAISE EXCEPTION 'invalid calendar date was accepted';
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    NULL;
  END;

  BEGIN
    PERFORM public.controlled_update_voice_actor(
      linked_user, voice_actor_id, '{"firstname":"Protected name"}'::JSONB,
      expected_updated_at, gen_random_uuid()
    );
    RAISE EXCEPTION 'linked user changed an administrator-only field';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    PERFORM public.controlled_update_voice_actor(
      admin_user, voice_actor_id, '{"tmdb_id":9223372036854775808}'::JSONB,
      expected_updated_at, gen_random_uuid()
    );
    RAISE EXCEPTION 'out-of-range TMDB id was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN
    NULL;
  END;

  SELECT to_jsonb(actor) INTO before_row
  FROM public.voice_actors AS actor WHERE actor.id = voice_actor_id;

  first_result := public.controlled_update_voice_actor(
    linked_user,
    voice_actor_id,
    '{"bio":"Updated","date_of_birth":"1815-12-10","social_media_links":{"website":"https://example.test"}}'::JSONB,
    expected_updated_at,
    first_request
  );
  IF first_result -> 'record' ->> 'bio' <> 'Updated'
     OR first_result -> 'record' ->> 'updated_by' IS DISTINCT FROM linked_user::TEXT
     OR (first_result ->> 'changed')::BOOLEAN IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'authorized update did not return the attributed row';
  END IF;

  replay_result := public.controlled_update_voice_actor(
    linked_user,
    voice_actor_id,
    '{"bio":"Updated","date_of_birth":"1815-12-10","social_media_links":{"website":"https://example.test"}}'::JSONB,
    expected_updated_at,
    first_request
  );
  IF (replay_result ->> 'replayed')::BOOLEAN IS DISTINCT FROM TRUE
     OR replay_result ->> 'audit_log_id' IS DISTINCT FROM first_result ->> 'audit_log_id' THEN
    RAISE EXCEPTION 'identical request retry did not replay its original audit';
  END IF;

  SELECT actor.updated_at INTO expected_updated_at
  FROM public.voice_actors AS actor WHERE actor.id = voice_actor_id;

  BEGIN
    PERFORM public.controlled_update_voice_actor(
      linked_user, voice_actor_id, '{"bio":"Different payload"}'::JSONB,
      expected_updated_at, first_request
    );
    RAISE EXCEPTION 'request id was reused with a different patch';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  BEGIN
    PERFORM public.controlled_update_voice_actor(
      linked_user,
      voice_actor_id,
      '{"bio":"Stale update"}'::JSONB,
      '2000-01-01T00:00:00Z'::TIMESTAMPTZ,
      gen_random_uuid()
    );
    RAISE EXCEPTION 'stale update was accepted';
  EXCEPTION WHEN serialization_failure THEN
    NULL;
  END;

  BEGIN
    PERFORM set_config('test.fail_voice_actor_audit_actor', admin_user::TEXT, TRUE);
    PERFORM public.controlled_update_voice_actor(
      admin_user, voice_actor_id, '{"bio":"Audit failure"}'::JSONB,
      expected_updated_at, failed_request
    );
    RAISE EXCEPTION 'audit failure injection was not observed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'forced voice actor audit failure' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    PERFORM set_config('test.fail_voice_actor_update_id', voice_actor_id::TEXT, TRUE);
    PERFORM public.controlled_update_voice_actor(
      admin_user, voice_actor_id, '{"bio":"Mutation failure"}'::JSONB,
      expected_updated_at, failed_mutation_request
    );
    RAISE EXCEPTION 'mutation failure injection was not observed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'forced voice actor update failure' THEN
      RAISE;
    END IF;
  END;

  PERFORM public.controlled_update_voice_actor(
    admin_user, voice_actor_id, '{"status":"active","tmdb_id":88}'::JSONB,
    expected_updated_at, gen_random_uuid()
  );

  SELECT to_jsonb(actor) INTO current_row
  FROM public.voice_actors AS actor WHERE actor.id = voice_actor_id;
  IF current_row ->> 'bio' <> 'Updated'
     OR current_row ->> 'status' <> 'active'
     OR current_row ->> 'tmdb_id' <> '88' THEN
    RAISE EXCEPTION 'failed or authorized update left unexpected persisted values';
  END IF;

  SELECT count(*) INTO audit_count
  FROM public.audit_logs AS audit
  WHERE audit.user_id = linked_user
    AND audit.entity_type = 'voice_actor'
    AND audit.entity_id = voice_actor_id::TEXT
    AND audit.action = 'update'
    AND audit.previous_value = before_row
    AND audit.new_value ->> 'bio' = 'Updated'
    AND audit.new_value ->> 'updated_by' = linked_user::TEXT
    AND audit.created_at IS NOT NULL;
  IF audit_count <> 1 THEN
    RAISE EXCEPTION 'full before/after audit snapshot was not persisted once';
  END IF;

  PERFORM set_config('test.voice_actor_audit_id', first_result ->> 'audit_log_id', TRUE);
  PERFORM set_config('test.voice_actor_admin_audit_id', (current_row ->> 'id'), TRUE);
  PERFORM set_config('test.failed_request_id', failed_request::TEXT, TRUE);
END;
$$;
RESET ROLE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM private.voice_actor_write_requests
    WHERE actor_id = '00000000-0000-0000-0000-000000563655'
      AND request_id = current_setting('test.failed_request_id')::UUID
  ) OR EXISTS (
    SELECT 1 FROM private.voice_actor_write_requests
    WHERE actor_id = '00000000-0000-0000-0000-000000563655'
      AND request_id = '33333333-3333-4333-8333-333333333333'
  ) THEN
    RAISE EXCEPTION 'failed mutation or audit left idempotency metadata behind';
  END IF;
END;
$$;

SET LOCAL ROLE service_role;
UPDATE public.audit_logs
SET reverted_at = clock_timestamp()
WHERE id = (SELECT id FROM public.audit_logs WHERE entity_id = current_setting('test.voice_actor_id') AND entity_type = 'voice_actor' ORDER BY created_at LIMIT 1);
RESET ROLE;

CREATE ROLE controlled_voice_actor_audit_attacker NOLOGIN;
GRANT controlled_voice_actor_audit_attacker TO postgres;
GRANT authenticated TO controlled_voice_actor_audit_attacker;
GRANT SELECT, UPDATE, DELETE ON public.audit_logs TO controlled_voice_actor_audit_attacker;
CREATE POLICY "test attacker can update voice actor audit history"
  ON public.audit_logs FOR UPDATE TO controlled_voice_actor_audit_attacker
  USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "test attacker can delete voice actor audit history"
  ON public.audit_logs FOR DELETE TO controlled_voice_actor_audit_attacker
  USING (TRUE);
SET LOCAL ROLE controlled_voice_actor_audit_attacker;
DO $$
DECLARE
  audit_id UUID;
BEGIN
  SELECT id INTO audit_id FROM public.audit_logs
  WHERE entity_id = current_setting('test.voice_actor_id') AND entity_type = 'voice_actor'
  ORDER BY created_at LIMIT 1;
  BEGIN
    UPDATE public.audit_logs SET new_value = '{}'::JSONB WHERE id = audit_id;
    RAISE EXCEPTION 'voice actor audit modification was accepted';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    NULL;
  END;
  BEGIN
    DELETE FROM public.audit_logs WHERE id = audit_id;
    RAISE EXCEPTION 'voice actor audit deletion was accepted';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    NULL;
  END;
END;
$$;
RESET ROLE;

ROLLBACK;
