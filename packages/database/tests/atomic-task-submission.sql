-- Run only against an isolated local database after applying all migrations.
-- Fixtures, claim consumption, audit rows and the trigger failure all roll back.
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

DO $$
DECLARE
  owner_id UUID := gen_random_uuid();
  other_user_id UUID := gen_random_uuid();
  audit_failure_user_id UUID := gen_random_uuid();
  actor_id BIGINT;
  audit_actor_id BIGINT;
  valid_claim_id UUID := gen_random_uuid();
  wrong_owner_claim_id UUID := gen_random_uuid();
  expired_claim_id UUID := gen_random_uuid();
  audit_failure_claim_id UUID := gen_random_uuid();
  result_status TEXT;
  result_points INTEGER;
  audit_count INTEGER;
  actor_row public.voice_actors%ROWTYPE;
BEGIN
  INSERT INTO auth.users (id) VALUES (owner_id), (other_user_id), (audit_failure_user_id);
  INSERT INTO public.voice_actors (firstname, lastname)
  VALUES ('Atomic submission fixture', 'Test')
  RETURNING id INTO actor_id;
  INSERT INTO public.voice_actors (firstname, lastname)
  VALUES ('Atomic audit failure fixture', 'Test')
  RETURNING id INTO audit_actor_id;

  INSERT INTO public.gamification_task_locks
    (category, entity_id, locked_at, claim_id, user_id, expires_at)
  VALUES
    ('enrich_voice_actor', actor_id::TEXT, clock_timestamp(), valid_claim_id, owner_id, clock_timestamp() + INTERVAL '5 minutes'),
    ('enrich_voice_actor', actor_id::TEXT || '-wrong-owner', clock_timestamp(), wrong_owner_claim_id, other_user_id, clock_timestamp() + INTERVAL '5 minutes'),
    ('enrich_voice_actor', actor_id::TEXT || '-expired', clock_timestamp(), expired_claim_id, owner_id, clock_timestamp() - INTERVAL '1 second'),
    ('enrich_voice_actor', audit_actor_id::TEXT, clock_timestamp(), audit_failure_claim_id, audit_failure_user_id, clock_timestamp() + INTERVAL '5 minutes');

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
  IF NOT EXISTS (
    SELECT 1 FROM public.gamification_task_locks
    WHERE claim_id = valid_claim_id AND consumed_at IS NOT NULL
      AND expires_at <= clock_timestamp()
  ) THEN
    RAISE EXCEPTION 'Successful contribution did not consume and release its claim';
  END IF;

  SELECT * INTO actor_row FROM public.voice_actors WHERE id = actor_id;
  IF actor_row.nationality <> 'French' OR actor_row.bio <> 'Voice actor bio' OR actor_row.updated_by <> owner_id THEN
    RAISE EXCEPTION 'Contribution fields or editor were not persisted accurately';
  END IF;

  SELECT count(*) INTO audit_count
  FROM public.audit_logs
  WHERE user_id = owner_id AND entity_type = 'voice_actor' AND entity_id = actor_id::TEXT;
  IF audit_count <> 1 THEN
    RAISE EXCEPTION 'Expected one audit for the successful contribution, got %', audit_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.audit_logs
    WHERE user_id = owner_id AND entity_id = actor_id::TEXT
      AND previous_value = '{"nationality":null,"bio":null}'::JSONB
      AND new_value = '{"nationality":"French","bio":"Voice actor bio"}'::JSONB
      AND points_awarded = 15
  ) THEN
    RAISE EXCEPTION 'Audit values or points do not match the persisted write';
  END IF;

  SELECT status INTO result_status
  FROM public.submit_gamification_task_contribution(
    valid_claim_id, owner_id, '{"nationality":"Other"}'::JSONB, FALSE
  );
  IF result_status <> 'invalid_claim' THEN
    RAISE EXCEPTION 'Replayed claim returned %', result_status;
  END IF;

  SELECT count(*) INTO audit_count
  FROM public.audit_logs
  WHERE user_id = owner_id AND entity_type = 'voice_actor' AND entity_id = actor_id::TEXT;
  IF audit_count <> 1 THEN
    RAISE EXCEPTION 'Replayed claim created another audit row';
  END IF;

  SELECT status INTO result_status
  FROM public.submit_gamification_task_contribution(
    wrong_owner_claim_id, owner_id, '{"bio":"Wrong owner"}'::JSONB, FALSE
  );
  IF result_status <> 'invalid_claim' THEN
    RAISE EXCEPTION 'Wrong-owner claim returned %', result_status;
  END IF;

  SELECT status INTO result_status
  FROM public.submit_gamification_task_contribution(
    expired_claim_id, owner_id, '{"bio":"Expired claim"}'::JSONB, FALSE
  );
  IF result_status <> 'invalid_claim' THEN
    RAISE EXCEPTION 'Expired claim returned %', result_status;
  END IF;

  PERFORM set_config('app.fail_task_audit_user', audit_failure_user_id::TEXT, TRUE);

  BEGIN
    PERFORM * FROM public.submit_gamification_task_contribution(
      audit_failure_claim_id, audit_failure_user_id, '{"bio":"Must roll back"}'::JSONB, FALSE
    );
    RAISE EXCEPTION 'Expected the audit failure to abort the contribution';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Expected the audit failure to abort the contribution' THEN
      RAISE;
    END IF;
  END;

  SELECT * INTO actor_row FROM public.voice_actors WHERE id = audit_actor_id;
  IF actor_row.bio IS NOT NULL THEN
    RAISE EXCEPTION 'Failed audit left a partial entity update';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.gamification_task_locks
    WHERE claim_id = audit_failure_claim_id AND consumed_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Failed audit left the claim consumed';
  END IF;
END;
$$;

ROLLBACK;
