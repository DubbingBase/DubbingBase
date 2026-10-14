-- Run only against an isolated local database after applying all migrations.
-- Fixtures and claim mutations roll back at the end of this test.
\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
  owner_id UUID := gen_random_uuid();
  other_user_id UUID := gen_random_uuid();
  first_claim RECORD;
  second_claim RECORD;
  empty_claim RECORD;
  consume_count INTEGER;
BEGIN
  IF has_function_privilege('anon', 'public.claim_gamification_task(text, uuid)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.claim_gamification_task(text, uuid)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.claim_gamification_task(text, uuid)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.consume_gamification_task_claim(uuid, uuid)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.consume_gamification_task_claim(uuid, uuid)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.consume_gamification_task_claim(uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Task claim RPC grants are not service-role only';
  END IF;

  INSERT INTO auth.users (id) VALUES (owner_id), (other_user_id);
  INSERT INTO public.voice_actors (firstname, lastname)
  VALUES ('Atomic claim fixture A', 'Test'), ('Atomic claim fixture B', 'Test');

  SELECT * INTO first_claim
  FROM public.claim_gamification_task('enrich_voice_actor', owner_id);
  SELECT * INTO second_claim
  FROM public.claim_gamification_task('enrich_voice_actor', other_user_id);

  IF first_claim.claim_id IS NULL OR second_claim.claim_id IS NULL
    OR first_claim.task->>'id' = second_claim.task->>'id'
    OR first_claim.category <> 'enrich_voice_actor'
    OR first_claim.expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'Two active claimants were not given distinct owned tasks';
  END IF;

  SELECT * INTO empty_claim
  FROM public.claim_gamification_task('enrich_voice_actor', owner_id);
  IF empty_claim.task IS NOT NULL OR empty_claim.claim_id IS NOT NULL
    OR empty_claim.expires_at IS NOT NULL
    OR empty_claim.category <> 'enrich_voice_actor' THEN
    RAISE EXCEPTION 'No-task result did not retain a concrete category and null claim fields';
  END IF;

  SELECT count(*) INTO consume_count
  FROM public.consume_gamification_task_claim(first_claim.claim_id, other_user_id);
  IF consume_count <> 0 THEN
    RAISE EXCEPTION 'Wrong owner consumed another user claim';
  END IF;

  SELECT count(*) INTO consume_count
  FROM public.consume_gamification_task_claim(gen_random_uuid(), owner_id);
  IF consume_count <> 0 THEN
    RAISE EXCEPTION 'Unknown claim id was consumed';
  END IF;

  UPDATE public.gamification_task_locks
  SET expires_at = clock_timestamp() - INTERVAL '1 second'
  WHERE claim_id = first_claim.claim_id;
  SELECT count(*) INTO consume_count
  FROM public.consume_gamification_task_claim(first_claim.claim_id, owner_id);
  IF consume_count <> 0 THEN
    RAISE EXCEPTION 'Expired claim was consumed';
  END IF;

  UPDATE public.gamification_task_locks
  SET expires_at = clock_timestamp() + INTERVAL '1 minute'
  WHERE claim_id = first_claim.claim_id;
  SELECT count(*) INTO consume_count
  FROM public.consume_gamification_task_claim(first_claim.claim_id, owner_id);
  IF consume_count <> 1 THEN
    RAISE EXCEPTION 'Valid owner could not consume claim';
  END IF;
  SELECT count(*) INTO consume_count
  FROM public.consume_gamification_task_claim(first_claim.claim_id, owner_id);
  IF consume_count <> 0 THEN
    RAISE EXCEPTION 'Replayed claim was consumed';
  END IF;
END;
$$;

ROLLBACK;
