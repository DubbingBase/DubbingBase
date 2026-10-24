-- Run only against an isolated local database after applying all migrations.
-- All fixtures, assertions, and failure-injection triggers roll back together.
\set ON_ERROR_STOP on
BEGIN;

CREATE FUNCTION public.reject_task_contribution_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $trigger$
BEGIN
  IF NEW.user_id::TEXT = current_setting('app.fail_task_audit_user', TRUE) THEN
    RAISE EXCEPTION 'forced task contribution audit failure';
  END IF;
  RETURN NEW;
END;
$trigger$;
CREATE TRIGGER reject_task_contribution_audit
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.reject_task_contribution_audit();

-- Points are persisted in audit_logs.points_awarded. This trigger isolates a
-- failure at that award value while the audit record is being written.
CREATE FUNCTION public.reject_task_contribution_points()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $trigger$
BEGIN
  IF NEW.points_awarded > 0
    AND NEW.user_id::TEXT = current_setting('app.fail_task_points_user', TRUE) THEN
    RAISE EXCEPTION 'forced task contribution points failure';
  END IF;
  RETURN NEW;
END;
$trigger$;
CREATE TRIGGER reject_task_contribution_points
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.reject_task_contribution_points();

CREATE FUNCTION public.reject_task_claim_consumption()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $trigger$
BEGIN
  IF OLD.claim_id::TEXT = current_setting('app.fail_task_claim_consumption', TRUE)
    AND OLD.consumed_at IS NULL AND NEW.consumed_at IS NOT NULL THEN
    RAISE EXCEPTION 'forced task claim consumption failure';
  END IF;
  RETURN NEW;
END;
$trigger$;
CREATE TRIGGER reject_task_claim_consumption
  BEFORE UPDATE ON public.gamification_task_locks
  FOR EACH ROW EXECUTE FUNCTION public.reject_task_claim_consumption();

CREATE FUNCTION public.reject_task_contribution_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $trigger$
BEGIN
  IF OLD.id::TEXT = current_setting('app.fail_task_entity_id', TRUE) THEN
    RAISE EXCEPTION 'forced task contribution update failure';
  END IF;
  RETURN NEW;
END;
$trigger$;
CREATE TRIGGER reject_task_contribution_update
  BEFORE UPDATE ON public.voice_actors
  FOR EACH ROW EXECUTE FUNCTION public.reject_task_contribution_update();

CREATE FUNCTION public.assert_task_submission_rollback(
  p_claim_id UUID,
  p_entity_type TEXT,
  p_entity_id TEXT,
  p_actor_id BIGINT,
  p_expected_claim_owner UUID,
  p_expected_expiry TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
AS $assertion$
DECLARE
  actor_bio TEXT;
  audit_count INTEGER;
  points_sum BIGINT;
  actual_owner UUID;
  actual_expiry TIMESTAMPTZ;
  actual_consumed_at TIMESTAMPTZ;
BEGIN
  SELECT actor.bio INTO actor_bio
  FROM public.voice_actors AS actor
  WHERE actor.id = p_actor_id;
  IF NOT FOUND OR actor_bio IS NOT NULL THEN
    RAISE EXCEPTION 'failed submission left a contribution update';
  END IF;

  SELECT count(*), COALESCE(sum(audit.points_awarded), 0)
  INTO audit_count, points_sum
  FROM public.audit_logs AS audit
  WHERE audit.entity_type = p_entity_type AND audit.entity_id = p_entity_id;
  IF audit_count <> 0 OR points_sum <> 0 THEN
    RAISE EXCEPTION 'failed submission left an audit or points award';
  END IF;

  IF p_expected_claim_owner IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.gamification_task_locks AS claim
      WHERE claim.claim_id IS NOT DISTINCT FROM p_claim_id
    ) THEN
      RAISE EXCEPTION 'failed submission changed a missing claim';
    END IF;
  ELSE
    SELECT claim.user_id, claim.expires_at, claim.consumed_at
    INTO actual_owner, actual_expiry, actual_consumed_at
    FROM public.gamification_task_locks AS claim
    WHERE claim.claim_id = p_claim_id;
    IF NOT FOUND
      OR actual_owner IS DISTINCT FROM p_expected_claim_owner
      OR actual_expiry IS DISTINCT FROM p_expected_expiry
      OR actual_consumed_at IS NOT NULL THEN
      RAISE EXCEPTION 'failed submission changed or consumed its claim';
    END IF;
  END IF;
END;
$assertion$;

DO $$
DECLARE
  owner_id UUID := gen_random_uuid();
  other_user_id UUID := gen_random_uuid();
  audit_failure_user_id UUID := gen_random_uuid();
  points_failure_user_id UUID := gen_random_uuid();
  consumption_failure_user_id UUID := gen_random_uuid();
  update_failure_user_id UUID := gen_random_uuid();
  retry_user_id UUID := gen_random_uuid();
  future_expiry TIMESTAMPTZ := clock_timestamp() + INTERVAL '5 minutes';
  expired_expiry TIMESTAMPTZ := clock_timestamp() - INTERVAL '1 minute';
  valid_actor_id BIGINT;
  wrong_owner_actor_id BIGINT;
  expired_actor_id BIGINT;
  relationship_actor_id BIGINT;
  invalid_fields_actor_id BIGINT;
  audit_actor_id BIGINT;
  points_actor_id BIGINT;
  consumption_actor_id BIGINT;
  update_actor_id BIGINT;
  retry_actor_id BIGINT;
  idempotent_actor_id BIGINT;
  stale_retry_actor_id BIGINT;
  valid_claim_id UUID := gen_random_uuid();
  wrong_owner_claim_id UUID := gen_random_uuid();
  expired_claim_id UUID := gen_random_uuid();
  relationship_claim_id UUID := gen_random_uuid();
  invalid_fields_claim_id UUID := gen_random_uuid();
  audit_failure_claim_id UUID := gen_random_uuid();
  points_failure_claim_id UUID := gen_random_uuid();
  consumption_failure_claim_id UUID := gen_random_uuid();
  update_failure_claim_id UUID := gen_random_uuid();
  retry_claim_id UUID := gen_random_uuid();
  idempotent_claim_id UUID := gen_random_uuid();
  stale_retry_claim_id UUID := gen_random_uuid();
  missing_claim_id UUID := gen_random_uuid();
  result_status TEXT;
  result_points INTEGER;
  safe_retry_status TEXT;
  safe_retry_points INTEGER;
  safe_retry_replayed BOOLEAN;
  safe_retry_fingerprint TEXT := repeat('c', 64);
  audit_count INTEGER;
  points_sum BIGINT;
  claim_consumed_at TIMESTAMPTZ;
  claim_expiry TIMESTAMPTZ;
  actor_row public.voice_actors%ROWTYPE;
BEGIN
  IF has_function_privilege('anon', 'public.submit_gamification_task_contribution(uuid, uuid, jsonb, boolean)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.submit_gamification_task_contribution(uuid, uuid, jsonb, boolean)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.submit_gamification_task_contribution(uuid, uuid, jsonb, boolean)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.submit_gamification_task_contribution_retry_safe(uuid, uuid, jsonb, boolean, text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.submit_gamification_task_contribution_retry_safe(uuid, uuid, jsonb, boolean, text)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.submit_gamification_task_contribution_retry_safe(uuid, uuid, jsonb, boolean, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Submission RPC grants are not service-role only';
  END IF;

  IF has_table_privilege('anon', 'public.gamification_task_submission_results', 'SELECT')
    OR has_table_privilege('authenticated', 'public.gamification_task_submission_results', 'SELECT')
    OR NOT has_table_privilege('service_role', 'public.gamification_task_submission_results', 'SELECT')
    OR NOT has_table_privilege('service_role', 'public.gamification_task_submission_results', 'INSERT')
    OR has_table_privilege('service_role', 'public.gamification_task_submission_results', 'UPDATE')
    OR has_table_privilege('service_role', 'public.gamification_task_submission_results', 'DELETE')
    OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_class AS relation
      JOIN pg_catalog.pg_namespace AS schema ON schema.oid = relation.relnamespace
      WHERE schema.nspname = 'public'
        AND relation.relname = 'gamification_task_submission_results'
        AND relation.relrowsecurity
    ) THEN
    RAISE EXCEPTION 'Submission replay receipts are not protected for service-role access';
  END IF;

  INSERT INTO auth.users (id) VALUES
    (owner_id), (other_user_id), (audit_failure_user_id), (points_failure_user_id),
    (consumption_failure_user_id), (update_failure_user_id), (retry_user_id);

  INSERT INTO public.voice_actors (firstname, lastname)
  VALUES
    ('Atomic submission valid', 'Fixture'),
    ('Atomic submission wrong owner', 'Fixture'),
    ('Atomic submission expired', 'Fixture'),
    ('Atomic submission relationship', 'Fixture'),
    ('Atomic submission invalid fields', 'Fixture'),
    ('Atomic submission audit failure', 'Fixture'),
    ('Atomic submission points failure', 'Fixture'),
    ('Atomic submission consumption failure', 'Fixture'),
    ('Atomic submission update failure', 'Fixture'),
    ('Atomic submission retry', 'Fixture');

  SELECT id INTO valid_actor_id FROM public.voice_actors WHERE firstname = 'Atomic submission valid';
  SELECT id INTO wrong_owner_actor_id FROM public.voice_actors WHERE firstname = 'Atomic submission wrong owner';
  SELECT id INTO expired_actor_id FROM public.voice_actors WHERE firstname = 'Atomic submission expired';
  SELECT id INTO relationship_actor_id FROM public.voice_actors WHERE firstname = 'Atomic submission relationship';
  SELECT id INTO invalid_fields_actor_id FROM public.voice_actors WHERE firstname = 'Atomic submission invalid fields';
  SELECT id INTO audit_actor_id FROM public.voice_actors WHERE firstname = 'Atomic submission audit failure';
  SELECT id INTO points_actor_id FROM public.voice_actors WHERE firstname = 'Atomic submission points failure';
  SELECT id INTO consumption_actor_id FROM public.voice_actors WHERE firstname = 'Atomic submission consumption failure';
  SELECT id INTO update_actor_id FROM public.voice_actors WHERE firstname = 'Atomic submission update failure';
  SELECT id INTO retry_actor_id FROM public.voice_actors WHERE firstname = 'Atomic submission retry';

  IF EXISTS (SELECT 1 FROM public.studios WHERE id = relationship_actor_id) THEN
    RAISE EXCEPTION 'relationship fixture requires no studio with the voice actor id';
  END IF;

  INSERT INTO public.gamification_task_locks
    (category, entity_id, locked_at, claim_id, user_id, expires_at)
  VALUES
    ('enrich_voice_actor', valid_actor_id::TEXT, clock_timestamp(), valid_claim_id, owner_id, future_expiry),
    ('enrich_voice_actor', wrong_owner_actor_id::TEXT, clock_timestamp(), wrong_owner_claim_id, other_user_id, future_expiry),
    ('enrich_voice_actor', expired_actor_id::TEXT, clock_timestamp(), expired_claim_id, owner_id, expired_expiry),
    ('enrich_studio', relationship_actor_id::TEXT, clock_timestamp(), relationship_claim_id, owner_id, future_expiry),
    ('enrich_voice_actor', invalid_fields_actor_id::TEXT, clock_timestamp(), invalid_fields_claim_id, owner_id, future_expiry),
    ('enrich_voice_actor', audit_actor_id::TEXT, clock_timestamp(), audit_failure_claim_id, audit_failure_user_id, future_expiry),
    ('enrich_voice_actor', points_actor_id::TEXT, clock_timestamp(), points_failure_claim_id, points_failure_user_id, future_expiry),
    ('enrich_voice_actor', consumption_actor_id::TEXT, clock_timestamp(), consumption_failure_claim_id, consumption_failure_user_id, future_expiry),
    ('enrich_voice_actor', update_actor_id::TEXT, clock_timestamp(), update_failure_claim_id, update_failure_user_id, future_expiry),
    ('enrich_voice_actor', retry_actor_id::TEXT, clock_timestamp(), retry_claim_id, retry_user_id, future_expiry);

  SELECT status, points_awarded INTO result_status, result_points
  FROM public.submit_gamification_task_contribution(NULL, owner_id, '{"bio":"Missing claim"}'::JSONB, FALSE);
  IF result_status <> 'invalid_claim' OR result_points <> 0 THEN
    RAISE EXCEPTION 'Null claim returned %, % points', result_status, result_points;
  END IF;
  PERFORM public.assert_task_submission_rollback(NULL, 'voice_actor', valid_actor_id::TEXT, valid_actor_id, NULL, NULL);

  SELECT status, points_awarded INTO result_status, result_points
  FROM public.submit_gamification_task_contribution(missing_claim_id, owner_id, '{"bio":"Unknown claim"}'::JSONB, FALSE);
  IF result_status <> 'invalid_claim' OR result_points <> 0 THEN
    RAISE EXCEPTION 'Unknown claim returned %, % points', result_status, result_points;
  END IF;
  PERFORM public.assert_task_submission_rollback(missing_claim_id, 'voice_actor', valid_actor_id::TEXT, valid_actor_id, NULL, NULL);

  SELECT status, points_awarded INTO result_status, result_points
  FROM public.submit_gamification_task_contribution(wrong_owner_claim_id, owner_id, '{"bio":"Wrong owner"}'::JSONB, FALSE);
  IF result_status <> 'invalid_claim' OR result_points <> 0 THEN
    RAISE EXCEPTION 'Wrong-owner claim returned %, % points', result_status, result_points;
  END IF;
  PERFORM public.assert_task_submission_rollback(wrong_owner_claim_id, 'voice_actor', wrong_owner_actor_id::TEXT, wrong_owner_actor_id, other_user_id, future_expiry);

  SELECT status, points_awarded INTO result_status, result_points
  FROM public.submit_gamification_task_contribution(expired_claim_id, owner_id, '{"bio":"Expired claim"}'::JSONB, FALSE);
  IF result_status <> 'invalid_claim' OR result_points <> 0 THEN
    RAISE EXCEPTION 'Expired claim returned %, % points', result_status, result_points;
  END IF;
  PERFORM public.assert_task_submission_rollback(expired_claim_id, 'voice_actor', expired_actor_id::TEXT, expired_actor_id, owner_id, expired_expiry);

  SELECT status, points_awarded INTO result_status, result_points
  FROM public.submit_gamification_task_contribution(relationship_claim_id, owner_id, '{"country":"France"}'::JSONB, FALSE);
  IF result_status <> 'stale_task' OR result_points <> 0 THEN
    RAISE EXCEPTION 'Invalid category/entity relationship returned %, % points', result_status, result_points;
  END IF;
  PERFORM public.assert_task_submission_rollback(relationship_claim_id, 'studio', relationship_actor_id::TEXT, relationship_actor_id, owner_id, future_expiry);

  SELECT status, points_awarded INTO result_status, result_points
  FROM public.submit_gamification_task_contribution(invalid_fields_claim_id, owner_id, '{"country":"France"}'::JSONB, FALSE);
  IF result_status <> 'stale_task' OR result_points <> 0 THEN
    RAISE EXCEPTION 'Invalid contribution field returned %, % points', result_status, result_points;
  END IF;
  PERFORM public.assert_task_submission_rollback(invalid_fields_claim_id, 'voice_actor', invalid_fields_actor_id::TEXT, invalid_fields_actor_id, owner_id, future_expiry);

  SELECT status, points_awarded INTO result_status, result_points
  FROM public.submit_gamification_task_contribution(
    valid_claim_id,
    owner_id,
    '{"nationality":"French","bio":"Voice actor bio"}'::JSONB,
    FALSE
  );
  IF result_status <> 'submitted' OR result_points <> 15 THEN
    RAISE EXCEPTION 'Valid contribution returned %, % points', result_status, result_points;
  END IF;

  SELECT * INTO actor_row FROM public.voice_actors WHERE id = valid_actor_id;
  IF actor_row.nationality <> 'French' OR actor_row.bio <> 'Voice actor bio' OR actor_row.updated_by <> owner_id THEN
    RAISE EXCEPTION 'Contribution fields or editor were not persisted accurately';
  END IF;
  SELECT count(*), COALESCE(sum(points_awarded), 0)
  INTO audit_count, points_sum
  FROM public.audit_logs
  WHERE user_id = owner_id AND entity_type = 'voice_actor' AND entity_id = valid_actor_id::TEXT;
  IF audit_count <> 1 OR points_sum <> 15 THEN
    RAISE EXCEPTION 'Expected one successful audit and 15 points, got % and %', audit_count, points_sum;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_logs
    WHERE user_id = owner_id AND entity_type = 'voice_actor' AND entity_id = valid_actor_id::TEXT
      AND previous_value = '{"nationality":null,"bio":null}'::JSONB
      AND new_value = '{"nationality":"French","bio":"Voice actor bio"}'::JSONB
      AND points_awarded = 15
  ) THEN
    RAISE EXCEPTION 'Audit values or points do not match the persisted write';
  END IF;
  SELECT consumed_at, expires_at INTO claim_consumed_at, claim_expiry
  FROM public.gamification_task_locks WHERE claim_id = valid_claim_id;
  IF claim_consumed_at IS NULL OR claim_expiry > clock_timestamp() THEN
    RAISE EXCEPTION 'Successful contribution did not consume and release its claim';
  END IF;

  SELECT status, points_awarded INTO result_status, result_points
  FROM public.submit_gamification_task_contribution(valid_claim_id, owner_id, '{"bio":"Replay"}'::JSONB, FALSE);
  IF result_status <> 'invalid_claim' OR result_points <> 0 THEN
    RAISE EXCEPTION 'Duplicate submission returned %, % points', result_status, result_points;
  END IF;
  SELECT count(*), COALESCE(sum(points_awarded), 0)
  INTO audit_count, points_sum
  FROM public.audit_logs
  WHERE user_id = owner_id AND entity_type = 'voice_actor' AND entity_id = valid_actor_id::TEXT;
  IF audit_count <> 1 OR points_sum <> 15
    OR NOT EXISTS (
      SELECT 1 FROM public.voice_actors
      WHERE id = valid_actor_id AND bio = 'Voice actor bio' AND nationality = 'French'
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.gamification_task_locks
      WHERE claim_id = valid_claim_id AND consumed_at = claim_consumed_at AND expires_at = claim_expiry
    ) THEN
    RAISE EXCEPTION 'Duplicate submission changed one of the committed effects';
  END IF;

  PERFORM set_config('app.fail_task_audit_user', audit_failure_user_id::TEXT, TRUE);
  BEGIN
    PERFORM * FROM public.submit_gamification_task_contribution(
      audit_failure_claim_id, audit_failure_user_id, '{"bio":"Must roll back audit"}'::JSONB, FALSE
    );
    RAISE EXCEPTION 'expected audit trigger failure';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'forced task contribution audit failure' THEN RAISE; END IF;
  END;
  PERFORM public.assert_task_submission_rollback(audit_failure_claim_id, 'voice_actor', audit_actor_id::TEXT, audit_actor_id, audit_failure_user_id, future_expiry);

  PERFORM set_config('app.fail_task_points_user', points_failure_user_id::TEXT, TRUE);
  BEGIN
    PERFORM * FROM public.submit_gamification_task_contribution(
      points_failure_claim_id, points_failure_user_id, '{"bio":"Must roll back points"}'::JSONB, FALSE
    );
    RAISE EXCEPTION 'expected points trigger failure';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'forced task contribution points failure' THEN RAISE; END IF;
  END;
  PERFORM public.assert_task_submission_rollback(points_failure_claim_id, 'voice_actor', points_actor_id::TEXT, points_actor_id, points_failure_user_id, future_expiry);

  PERFORM set_config('app.fail_task_claim_consumption', consumption_failure_claim_id::TEXT, TRUE);
  BEGIN
    PERFORM * FROM public.submit_gamification_task_contribution(
      consumption_failure_claim_id, consumption_failure_user_id, '{"bio":"Must roll back claim"}'::JSONB, FALSE
    );
    RAISE EXCEPTION 'expected claim consumption trigger failure';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'forced task claim consumption failure' THEN RAISE; END IF;
  END;
  PERFORM public.assert_task_submission_rollback(consumption_failure_claim_id, 'voice_actor', consumption_actor_id::TEXT, consumption_actor_id, consumption_failure_user_id, future_expiry);

  PERFORM set_config('app.fail_task_entity_id', update_actor_id::TEXT, TRUE);
  BEGIN
    PERFORM * FROM public.submit_gamification_task_contribution(
      update_failure_claim_id, update_failure_user_id, '{"bio":"Must roll back update"}'::JSONB, FALSE
    );
    RAISE EXCEPTION 'expected entity update trigger failure';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'forced task contribution update failure' THEN RAISE; END IF;
  END;
  PERFORM public.assert_task_submission_rollback(update_failure_claim_id, 'voice_actor', update_actor_id::TEXT, update_actor_id, update_failure_user_id, future_expiry);

  PERFORM set_config('app.fail_task_audit_user', retry_user_id::TEXT, TRUE);
  BEGIN
    PERFORM * FROM public.submit_gamification_task_contribution(
      retry_claim_id, retry_user_id, '{"bio":"Retry after rollback"}'::JSONB, FALSE
    );
    RAISE EXCEPTION 'expected retry setup audit failure';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'forced task contribution audit failure' THEN RAISE; END IF;
  END;
  PERFORM public.assert_task_submission_rollback(retry_claim_id, 'voice_actor', retry_actor_id::TEXT, retry_actor_id, retry_user_id, future_expiry);

  PERFORM set_config('app.fail_task_audit_user', '', TRUE);
  SELECT status, points_awarded INTO result_status, result_points
  FROM public.submit_gamification_task_contribution(
    retry_claim_id, retry_user_id, '{"bio":"Retry after rollback"}'::JSONB, FALSE
  );
  IF result_status <> 'submitted' OR result_points <> 10 THEN
    RAISE EXCEPTION 'Retry after failed transaction returned %, % points', result_status, result_points;
  END IF;
  SELECT * INTO actor_row FROM public.voice_actors WHERE id = retry_actor_id;
  SELECT count(*), COALESCE(sum(points_awarded), 0)
  INTO audit_count, points_sum
  FROM public.audit_logs
  WHERE user_id = retry_user_id AND entity_type = 'voice_actor' AND entity_id = retry_actor_id::TEXT;
  IF actor_row.bio <> 'Retry after rollback' OR actor_row.updated_by <> retry_user_id
    OR audit_count <> 1 OR points_sum <> 10
    OR NOT EXISTS (
      SELECT 1 FROM public.gamification_task_locks
      WHERE claim_id = retry_claim_id AND consumed_at IS NOT NULL AND expires_at <= clock_timestamp()
    ) THEN
    RAISE EXCEPTION 'Retry did not atomically persist all four successful effects';
  END IF;

  INSERT INTO public.voice_actors (firstname, lastname)
  VALUES ('Atomic idempotent submission', 'Fixture')
  RETURNING id INTO idempotent_actor_id;
  INSERT INTO public.gamification_task_locks
    (category, entity_id, locked_at, claim_id, user_id, expires_at)
  VALUES
    ('enrich_voice_actor', idempotent_actor_id::TEXT, clock_timestamp(),
      idempotent_claim_id, retry_user_id, future_expiry);

  SELECT status, points_awarded, replayed
  INTO safe_retry_status, safe_retry_points, safe_retry_replayed
  FROM public.submit_gamification_task_contribution_retry_safe(
    idempotent_claim_id, retry_user_id, '{"bio":"Response lost"}'::JSONB,
    FALSE, safe_retry_fingerprint
  );
  IF safe_retry_status <> 'submitted' OR safe_retry_points <> 10 OR safe_retry_replayed THEN
    RAISE EXCEPTION 'Initial retry-safe submission returned %, %, replayed %',
      safe_retry_status, safe_retry_points, safe_retry_replayed;
  END IF;

  SELECT status, points_awarded, replayed
  INTO safe_retry_status, safe_retry_points, safe_retry_replayed
  FROM public.submit_gamification_task_contribution_retry_safe(
    idempotent_claim_id, retry_user_id, '{}'::JSONB,
    FALSE, safe_retry_fingerprint
  );
  IF safe_retry_status <> 'submitted' OR safe_retry_points <> 10 OR NOT safe_retry_replayed THEN
    RAISE EXCEPTION 'Identical retry did not return the committed result: %, %, replayed %',
      safe_retry_status, safe_retry_points, safe_retry_replayed;
  END IF;

  SELECT status, points_awarded, replayed
  INTO safe_retry_status, safe_retry_points, safe_retry_replayed
  FROM public.submit_gamification_task_contribution_retry_safe(
    idempotent_claim_id, retry_user_id, '{}'::JSONB,
    FALSE, repeat('d', 64)
  );
  IF safe_retry_status <> 'invalid_claim' OR safe_retry_points <> 0 OR safe_retry_replayed THEN
    RAISE EXCEPTION 'Different-payload retry returned %, %, replayed %',
      safe_retry_status, safe_retry_points, safe_retry_replayed;
  END IF;

  SELECT status, points_awarded, replayed
  INTO safe_retry_status, safe_retry_points, safe_retry_replayed
  FROM public.submit_gamification_task_contribution_retry_safe(
    idempotent_claim_id, other_user_id, '{}'::JSONB,
    FALSE, safe_retry_fingerprint
  );
  IF safe_retry_status <> 'invalid_claim' OR safe_retry_points <> 0 OR safe_retry_replayed THEN
    RAISE EXCEPTION 'Wrong-owner replay returned %, %, replayed %',
      safe_retry_status, safe_retry_points, safe_retry_replayed;
  END IF;

  UPDATE public.gamification_task_locks AS claim
  SET claim_id = gen_random_uuid(),
      user_id = other_user_id,
      locked_at = clock_timestamp(),
      expires_at = future_expiry,
      consumed_at = NULL
  WHERE claim.claim_id = idempotent_claim_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Could not simulate reuse of the temporary claim row';
  END IF;

  SELECT status, points_awarded, replayed
  INTO safe_retry_status, safe_retry_points, safe_retry_replayed
  FROM public.submit_gamification_task_contribution_retry_safe(
    idempotent_claim_id, retry_user_id, '{}'::JSONB,
    FALSE, safe_retry_fingerprint
  );
  IF safe_retry_status <> 'submitted' OR safe_retry_points <> 10 OR NOT safe_retry_replayed THEN
    RAISE EXCEPTION 'Replay receipt did not survive temporary claim-row reuse: %, %, replayed %',
      safe_retry_status, safe_retry_points, safe_retry_replayed;
  END IF;

  SELECT status, points_awarded, replayed
  INTO safe_retry_status, safe_retry_points, safe_retry_replayed
  FROM public.submit_gamification_task_contribution_retry_safe(
    idempotent_claim_id, other_user_id, '{}'::JSONB,
    FALSE, safe_retry_fingerprint
  );
  IF safe_retry_status <> 'invalid_claim' OR safe_retry_points <> 0 OR safe_retry_replayed THEN
    RAISE EXCEPTION 'Reassigned owner could replay another user’s receipt: %, %, replayed %',
      safe_retry_status, safe_retry_points, safe_retry_replayed;
  END IF;

  INSERT INTO public.voice_actors (firstname, lastname)
  VALUES ('Atomic stale retry submission', 'Fixture')
  RETURNING id INTO stale_retry_actor_id;
  INSERT INTO public.gamification_task_locks
    (category, entity_id, locked_at, claim_id, user_id, expires_at)
  VALUES
    ('enrich_voice_actor', stale_retry_actor_id::TEXT, clock_timestamp(),
      stale_retry_claim_id, retry_user_id, future_expiry);

  SELECT status, points_awarded, replayed
  INTO safe_retry_status, safe_retry_points, safe_retry_replayed
  FROM public.submit_gamification_task_contribution_retry_safe(
    stale_retry_claim_id, retry_user_id, '{"unexpected":"value"}'::JSONB,
    FALSE, repeat('e', 64)
  );
  IF safe_retry_status <> 'stale_task' OR safe_retry_points <> 0 OR safe_retry_replayed
    OR EXISTS (
      SELECT 1 FROM public.gamification_task_locks
      WHERE claim_id = stale_retry_claim_id AND consumed_at IS NOT NULL
    ) THEN
    RAISE EXCEPTION 'Stale retry-safe submission returned %, %, replayed %',
      safe_retry_status, safe_retry_points, safe_retry_replayed;
  END IF;

  SELECT count(*), COALESCE(sum(points_awarded), 0)
  INTO audit_count, points_sum
  FROM public.audit_logs
  WHERE user_id = retry_user_id AND entity_type = 'voice_actor'
    AND entity_id = idempotent_actor_id::TEXT;
  IF audit_count <> 1 OR points_sum <> 10
    OR NOT EXISTS (
      SELECT 1 FROM public.voice_actors
      WHERE id = idempotent_actor_id AND bio = 'Response lost' AND updated_by = retry_user_id
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.gamification_task_submission_results
      WHERE claim_id = idempotent_claim_id
        AND user_id = retry_user_id
        AND submission_fingerprint = safe_retry_fingerprint
        AND points_awarded = 10
    ) THEN
    RAISE EXCEPTION 'Retry-safe replay changed or lost committed submission state';
  END IF;
END;
$$;

ROLLBACK;
