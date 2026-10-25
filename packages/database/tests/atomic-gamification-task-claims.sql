-- Run only against an isolated local database after applying all migrations.
-- Fixtures and claim mutations roll back at the end of this test.
\set ON_ERROR_STOP on
BEGIN;

CREATE FUNCTION public.test_complete_actor_during_task_claim()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.category = 'enrich_voice_actor' AND NEW.entity_id ~ '^[1-9][0-9]*$' THEN
    UPDATE public.voice_actors
    SET profile_picture = 'https://example.test/completed.jpg',
        nationality = 'Test',
        date_of_birth = DATE '2000-01-01',
        bio = 'Completed while the claim was being acquired'
    WHERE id = NEW.entity_id::BIGINT
      AND firstname = 'Atomic claim completed during acquisition';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER test_complete_actor_during_task_claim
BEFORE INSERT ON public.gamification_task_locks
FOR EACH ROW EXECUTE FUNCTION public.test_complete_actor_during_task_claim();

DO $$
DECLARE
  owner_id UUID := gen_random_uuid();
  other_user_id UUID := gen_random_uuid();
  first_claim RECORD;
  second_claim RECORD;
  recovered_claim RECORD;
  repeated_claim RECORD;
  skipped_claim RECORD;
  recovered_skip_claim RECORD;
  empty_claim RECORD;
  studio_fallback_claim RECORD;
  explicit_studio_empty RECORD;
  actor_fallback_claim RECORD;
  any_empty_claim RECORD;
  reassigned_claim RECORD;
  stale_task_claim RECORD;
  fairness_claim RECORD;
  consume_count INTEGER;
  studio_id BIGINT;
  actor_fallback_id BIGINT;
  expired_reassignment_id BIGINT;
  completed_during_claim_id BIGINT;
  sparse_base BIGINT;
  sparse_far_id BIGINT;
  selected_actor_id BIGINT;
  fairness_samples INTEGER := 4096;
  far_task_count INTEGER := 0;
  dense_task_counts INTEGER[] := array_fill(0, ARRAY[31]);
  sample_index INTEGER;
  dense_slot INTEGER;
  expired_reassignment_claim UUID := gen_random_uuid();
  voice_first_seed DOUBLE PRECISION;
  studio_first_seed DOUBLE PRECISION;
  random_value DOUBLE PRECISION;
  seed_index INTEGER;
BEGIN
  IF has_function_privilege('anon', 'public.claim_gamification_task(text, uuid)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.claim_gamification_task(text, uuid)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.claim_gamification_task(text, uuid)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.claim_gamification_task_retry_safe(text, uuid)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.claim_gamification_task_retry_safe(text, uuid)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.claim_gamification_task_retry_safe(text, uuid)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.skip_gamification_task_retry_safe(text, uuid, uuid)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.skip_gamification_task_retry_safe(text, uuid, uuid)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.skip_gamification_task_retry_safe(text, uuid, uuid)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.consume_gamification_task_claim(uuid, uuid)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.consume_gamification_task_claim(uuid, uuid)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.consume_gamification_task_claim(uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Task claim RPC grants are not service-role only';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'voice_actors_incomplete_task_hash_idx'
      AND indexdef LIKE '%hashtextextended%'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'studios_incomplete_task_hash_idx'
      AND indexdef LIKE '%hashtextextended%'
  ) THEN
    RAISE EXCEPTION 'Indexed hash-key candidate access is missing';
  END IF;

  INSERT INTO auth.users (id) VALUES (owner_id), (other_user_id);

  -- Isolate this distribution check from any pre-existing incomplete actors.
  -- The transaction rolls these synthetic updates back with the fixture.
  UPDATE public.voice_actors
  SET profile_picture = COALESCE(profile_picture, 'https://example.test/completed.jpg'),
      nationality = COALESCE(nationality, 'Test'),
      date_of_birth = COALESCE(date_of_birth, DATE '2000-01-01'),
      bio = COALESCE(bio, 'Completed before sparse-ID fairness test')
  WHERE profile_picture IS NULL OR nationality IS NULL
    OR date_of_birth IS NULL OR bio IS NULL;

  SELECT COALESCE(max(id), 0) + 1000 INTO sparse_base
  FROM public.voice_actors;
  sparse_far_id := sparse_base + 1000000000000;

  INSERT INTO public.voice_actors (id, firstname, lastname)
  OVERRIDING SYSTEM VALUE
  SELECT sparse_base + actor_number, 'Sparse fairness actor ' || actor_number::TEXT, 'Dense'
  FROM generate_series(0, 30) AS actor_number
  UNION ALL
  SELECT sparse_far_id, 'Sparse fairness distant actor', 'Far';

  -- A numeric-ID pivot overwhelmingly favored the distant row because of its
  -- large gap. Hash-key pivots should distribute claims across the sparse set.
  FOR sample_index IN 1..fairness_samples LOOP
    SELECT * INTO fairness_claim
    FROM public.claim_gamification_task('enrich_voice_actor', owner_id);
    IF fairness_claim.claim_id IS NULL OR fairness_claim.task IS NULL THEN
      RAISE EXCEPTION 'Sparse-ID fairness sampling returned no task at sample %', sample_index;
    END IF;

    selected_actor_id := (fairness_claim.task->>'id')::BIGINT;
    IF selected_actor_id = sparse_far_id THEN
      far_task_count := far_task_count + 1;
    ELSIF selected_actor_id BETWEEN sparse_base AND sparse_base + 30 THEN
      dense_slot := (selected_actor_id - sparse_base + 1)::INTEGER;
      dense_task_counts[dense_slot] := dense_task_counts[dense_slot] + 1;
    ELSE
      RAISE EXCEPTION 'Fairness sampling escaped its sparse fixture: %', selected_actor_id;
    END IF;

    DELETE FROM public.gamification_task_locks
    WHERE claim_id = fairness_claim.claim_id;
  END LOOP;

  IF far_task_count > fairness_samples / 4
    OR (SELECT count(*) FROM unnest(dense_task_counts) AS samples(sample_count)
        WHERE sample_count > 0) < 28 THEN
    RAISE EXCEPTION
      'Sparse-ID selection is biased: distant row selected %, distinct dense rows selected %',
      far_task_count,
      (SELECT count(*) FROM unnest(dense_task_counts) AS samples(sample_count)
       WHERE sample_count > 0);
  END IF;

  UPDATE public.voice_actors
  SET profile_picture = 'https://example.test/completed.jpg',
      nationality = 'Test',
      date_of_birth = DATE '2000-01-01',
      bio = 'Completed after sparse-ID fairness test'
  WHERE id BETWEEN sparse_base AND sparse_base + 30
     OR id = sparse_far_id;

  FOR seed_index IN 0..1000 LOOP
    PERFORM setseed(seed_index::DOUBLE PRECISION / 1000);
    random_value := random();
    IF random_value < 0.5 AND voice_first_seed IS NULL THEN
      voice_first_seed := seed_index::DOUBLE PRECISION / 1000;
    ELSIF random_value >= 0.5 AND studio_first_seed IS NULL THEN
      studio_first_seed := seed_index::DOUBLE PRECISION / 1000;
    END IF;
    EXIT WHEN voice_first_seed IS NOT NULL AND studio_first_seed IS NOT NULL;
  END LOOP;
  IF voice_first_seed IS NULL OR studio_first_seed IS NULL THEN
    RAISE EXCEPTION 'Could not establish both deterministic randomized category orders';
  END IF;

  INSERT INTO public.voice_actors (firstname, lastname)
  VALUES ('Atomic claim fixture A', 'Test'), ('Atomic claim fixture B', 'Test'),
    ('Atomic claim fixture C', 'Test');

  SELECT * INTO first_claim
  FROM public.claim_gamification_task('enrich_voice_actor', owner_id);
  SELECT * INTO recovered_claim
  FROM public.claim_gamification_task_retry_safe('enrich_voice_actor', owner_id);
  SELECT * INTO repeated_claim
  FROM public.claim_gamification_task_retry_safe('enrich_voice_actor', owner_id);
  SELECT * INTO second_claim
  FROM public.claim_gamification_task('enrich_voice_actor', other_user_id);
  SELECT * INTO skipped_claim
  FROM public.skip_gamification_task_retry_safe('any', other_user_id, second_claim.claim_id);
  SELECT * INTO recovered_skip_claim
  FROM public.skip_gamification_task_retry_safe('any', other_user_id, second_claim.claim_id);

  IF first_claim.claim_id IS NULL OR second_claim.claim_id IS NULL
    OR first_claim.task->>'id' = second_claim.task->>'id'
    OR recovered_claim.claim_id IS DISTINCT FROM first_claim.claim_id
    OR recovered_claim.task->>'id' IS DISTINCT FROM first_claim.task->>'id'
    OR repeated_claim.claim_id IS DISTINCT FROM first_claim.claim_id
    OR repeated_claim.task->>'id' IS DISTINCT FROM first_claim.task->>'id'
    OR skipped_claim.claim_id IS NULL
    OR skipped_claim.claim_id = second_claim.claim_id
    OR skipped_claim.task->>'id' IS NOT DISTINCT FROM second_claim.task->>'id'
    OR recovered_skip_claim.claim_id IS DISTINCT FROM skipped_claim.claim_id
    OR recovered_skip_claim.task->>'id' IS DISTINCT FROM skipped_claim.task->>'id'
    OR NOT EXISTS (
      SELECT 1 FROM public.gamification_task_locks AS claim
      WHERE claim.claim_id = second_claim.claim_id
        AND claim.user_id = other_user_id
        AND claim.consumed_at IS NOT NULL
        AND claim.expires_at > clock_timestamp()
    )
    OR (SELECT count(*) FROM public.gamification_task_locks AS claim
        WHERE claim.user_id = other_user_id AND claim.expires_at > clock_timestamp()
          AND claim.consumed_at IS NULL) <> 1
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

  INSERT INTO public.studios (name)
  VALUES ('Atomic claim fallback studio')
  RETURNING id INTO studio_id;

  -- With voice-actor tasks already active, force the random order to try
  -- voice actors first and verify that `any` falls through to studios.
  PERFORM setseed(voice_first_seed);
  SELECT * INTO studio_fallback_claim
  FROM public.claim_gamification_task('any', owner_id);
  IF studio_fallback_claim.task->>'id' IS DISTINCT FROM studio_id::TEXT
    OR studio_fallback_claim.category <> 'enrich_studio'
    OR studio_fallback_claim.claim_id IS NULL THEN
    RAISE EXCEPTION '`any` did not fall back from active voice actors to the available studio';
  END IF;

  INSERT INTO public.voice_actors (firstname, lastname)
  VALUES ('Atomic claim fallback actor', 'Test')
  RETURNING id INTO actor_fallback_id;

  -- Explicit studio requests must stay within that category even when an
  -- actor can be claimed; `any` with studio-first order must then fall through.
  SELECT * INTO explicit_studio_empty
  FROM public.claim_gamification_task('enrich_studio', owner_id);
  IF explicit_studio_empty.task IS NOT NULL OR explicit_studio_empty.claim_id IS NOT NULL
    OR explicit_studio_empty.category <> 'enrich_studio' THEN
    RAISE EXCEPTION 'An explicit studio request escaped into another category';
  END IF;

  PERFORM setseed(studio_first_seed);
  SELECT * INTO actor_fallback_claim
  FROM public.claim_gamification_task('any', other_user_id);
  IF actor_fallback_claim.task->>'id' IS DISTINCT FROM actor_fallback_id::TEXT
    OR actor_fallback_claim.category <> 'enrich_voice_actor'
    OR actor_fallback_claim.claim_id IS NULL THEN
    RAISE EXCEPTION '`any` did not fall back from the active studio to the available voice actor';
  END IF;

  SELECT * INTO any_empty_claim
  FROM public.claim_gamification_task('any', owner_id);
  IF any_empty_claim.task IS NOT NULL OR any_empty_claim.claim_id IS NOT NULL
    OR any_empty_claim.expires_at IS NOT NULL
    OR any_empty_claim.category NOT IN ('enrich_voice_actor', 'enrich_studio') THEN
    RAISE EXCEPTION '`any` did not return no-task after both categories had only active claims';
  END IF;

  INSERT INTO public.voice_actors (firstname, lastname)
  VALUES ('Atomic claim expired reassignment', 'Test')
  RETURNING id INTO expired_reassignment_id;
  INSERT INTO public.gamification_task_locks
    (category, entity_id, locked_at, claim_id, user_id, expires_at)
  VALUES
    ('enrich_voice_actor', expired_reassignment_id::TEXT, clock_timestamp(),
      expired_reassignment_claim, owner_id, clock_timestamp() - INTERVAL '1 second');

  SELECT * INTO reassigned_claim
  FROM public.claim_gamification_task('enrich_voice_actor', other_user_id);
  IF reassigned_claim.task->>'id' IS DISTINCT FROM expired_reassignment_id::TEXT
    OR reassigned_claim.claim_id IS NULL
    OR reassigned_claim.claim_id = expired_reassignment_claim
    OR reassigned_claim.expires_at <= clock_timestamp()
    OR NOT EXISTS (
      SELECT 1 FROM public.gamification_task_locks AS claim
      WHERE claim.category = 'enrich_voice_actor'
        AND claim.entity_id = expired_reassignment_id::TEXT
        AND claim.claim_id = reassigned_claim.claim_id
        AND claim.user_id = other_user_id
        AND claim.expires_at > clock_timestamp()
    ) THEN
    RAISE EXCEPTION 'Expired task claim was not reassigned to the new owner';
  END IF;

  INSERT INTO public.voice_actors (firstname, lastname)
  VALUES ('Atomic claim completed during acquisition', 'Test')
  RETURNING id INTO completed_during_claim_id;
  SELECT * INTO stale_task_claim
  FROM public.claim_gamification_task('enrich_voice_actor', owner_id);
  IF stale_task_claim.task IS NOT NULL OR stale_task_claim.claim_id IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM public.gamification_task_locks AS claim
      WHERE claim.category = 'enrich_voice_actor'
        AND claim.entity_id = completed_during_claim_id::TEXT
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.voice_actors AS actor
      WHERE actor.id = completed_during_claim_id
        AND actor.profile_picture IS NOT NULL
        AND actor.nationality IS NOT NULL
        AND actor.date_of_birth IS NOT NULL
        AND actor.bio IS NOT NULL
    ) THEN
    RAISE EXCEPTION 'A task completed during acquisition was returned or left claimed';
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
