CREATE TABLE public.gamification_task_submission_results (
  claim_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submission_fingerprint TEXT NOT NULL
    CHECK (submission_fingerprint ~ '^[0-9a-f]{64}$'),
  points_awarded INTEGER NOT NULL CHECK (points_awarded >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE public.gamification_task_submission_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.gamification_task_submission_results
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.gamification_task_submission_results
  TO service_role;

COMMENT ON TABLE public.gamification_task_submission_results IS
  'Durable idempotency receipts for successful contribution submissions, retained after temporary task-lock rows are reused.';

CREATE OR REPLACE FUNCTION public.claim_gamification_task_retry_safe(
  p_category TEXT,
  p_user_id UUID
)
RETURNS TABLE(task JSONB, category TEXT, claim_id UUID, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  existing_claim public.gamification_task_locks%ROWTYPE;
  existing_task JSONB;
BEGIN
  IF p_user_id IS NULL OR p_category IS NULL
    OR p_category NOT IN ('any', 'enrich_voice_actor', 'enrich_studio') THEN
    RAISE EXCEPTION 'Invalid task claim request';
  END IF;

  -- Serialize acquisitions from one contributor so a lost response or
  -- concurrent retry returns the first claim instead of reserving another.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('contribution-task-claim:' || p_user_id::TEXT, 0)
  );

  SELECT task_claim.* INTO existing_claim
  FROM public.gamification_task_locks AS task_claim
  WHERE task_claim.user_id = p_user_id
    AND task_claim.expires_at > clock_timestamp()
    AND task_claim.consumed_at IS NULL
    AND (p_category = 'any' OR task_claim.category = p_category)
  ORDER BY task_claim.locked_at DESC, task_claim.claim_id
  LIMIT 1;

  IF FOUND THEN
    IF existing_claim.entity_id ~ '^[1-9][0-9]{0,18}$' THEN
      IF existing_claim.entity_id::NUMERIC <= 9223372036854775807::NUMERIC THEN
        IF existing_claim.category = 'enrich_voice_actor' THEN
          SELECT pg_catalog.to_jsonb(actor) INTO existing_task
          FROM public.voice_actors AS actor
          WHERE actor.id = existing_claim.entity_id::BIGINT
            AND (actor.profile_picture IS NULL OR actor.nationality IS NULL
              OR actor.date_of_birth IS NULL OR actor.bio IS NULL);
        ELSE
          SELECT pg_catalog.to_jsonb(studio) INTO existing_task
          FROM public.studios AS studio
          WHERE studio.id = existing_claim.entity_id::BIGINT
            AND (studio.logo_url IS NULL OR studio.country IS NULL
              OR studio.city IS NULL OR studio.website_url IS NULL);
        END IF;
      END IF;
    END IF;

    IF existing_task IS NOT NULL THEN
      RETURN QUERY SELECT
        existing_task,
        existing_claim.category,
        existing_claim.claim_id,
        existing_claim.expires_at;
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  SELECT * FROM public.claim_gamification_task(p_category, p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_gamification_task_retry_safe(TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_gamification_task_retry_safe(TEXT, UUID)
  TO service_role;

COMMENT ON FUNCTION public.claim_gamification_task_retry_safe(TEXT, UUID) IS
  'Returns the owner’s existing active claim for the requested category on retry and serializes same-owner acquisitions; otherwise delegates to the atomic claim selector.';

CREATE OR REPLACE FUNCTION public.skip_gamification_task_retry_safe(
  p_category TEXT,
  p_user_id UUID,
  p_skip_claim_id UUID
)
RETURNS TABLE(task JSONB, category TEXT, claim_id UUID, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  skipped_claim public.gamification_task_locks%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_category IS NULL OR p_skip_claim_id IS NULL
    OR p_category NOT IN ('any', 'enrich_voice_actor', 'enrich_studio') THEN
    RAISE EXCEPTION 'Invalid task skip request';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('contribution-task-claim:' || p_user_id::TEXT, 0)
  );

  SELECT claim.* INTO skipped_claim
  FROM public.gamification_task_locks AS claim
  WHERE claim.claim_id = p_skip_claim_id
    AND claim.user_id = p_user_id
    AND (p_category = 'any' OR claim.category = p_category)
  FOR UPDATE;

  -- Keep the entity reserved until its original lease ends, so the selector
  -- cannot immediately return the task the contributor chose to skip.
  IF FOUND AND skipped_claim.consumed_at IS NULL
    AND skipped_claim.expires_at > clock_timestamp() THEN
    UPDATE public.gamification_task_locks AS claim
    SET consumed_at = clock_timestamp()
    WHERE claim.claim_id = p_skip_claim_id
      AND claim.user_id = p_user_id
      AND claim.consumed_at IS NULL;
  END IF;

  -- The regular retry-safe selector returns the new claim on a lost Skip
  -- response, while the skipped (consumed) claim is no longer user-active.
  RETURN QUERY
  SELECT * FROM public.claim_gamification_task_retry_safe(p_category, p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.skip_gamification_task_retry_safe(TEXT, UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.skip_gamification_task_retry_safe(TEXT, UUID, UUID)
  TO service_role;

COMMENT ON FUNCTION public.skip_gamification_task_retry_safe(TEXT, UUID, UUID) IS
  'Consumes an owner-bound active claim without releasing its entity lease, then returns a different claim; replaying the Skip request recovers the next active claim.';

CREATE OR REPLACE FUNCTION public.submit_gamification_task_contribution_retry_safe(
  p_claim_id UUID,
  p_user_id UUID,
  p_updates JSONB,
  p_is_admin BOOLEAN,
  p_submission_fingerprint TEXT
)
RETURNS TABLE(status TEXT, points_awarded INTEGER, replayed BOOLEAN)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  task_claim public.gamification_task_locks%ROWTYPE;
  submission_result public.gamification_task_submission_results%ROWTYPE;
  result_status TEXT;
  result_points INTEGER;
BEGIN
  IF p_claim_id IS NULL OR p_user_id IS NULL
    OR p_submission_fingerprint IS NULL
    OR p_submission_fingerprint !~ '^[0-9a-f]{64}$' THEN
    RETURN QUERY SELECT 'invalid_claim'::TEXT, 0, FALSE;
    RETURN;
  END IF;

  SELECT claim.* INTO task_claim
  FROM public.gamification_task_locks AS claim
  WHERE claim.claim_id = p_claim_id
    AND claim.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    SELECT result.* INTO submission_result
    FROM public.gamification_task_submission_results AS result
    WHERE result.claim_id = p_claim_id
      AND result.user_id = p_user_id;
    IF FOUND AND submission_result.submission_fingerprint = p_submission_fingerprint THEN
      RETURN QUERY SELECT 'submitted'::TEXT, submission_result.points_awarded, TRUE;
    ELSE
      RETURN QUERY SELECT 'invalid_claim'::TEXT, 0, FALSE;
    END IF;
    RETURN;
  END IF;

  -- A second request may have waited on the claim row while the first
  -- submission committed. Its receipt is durable even if another claimant
  -- has already reused the lock row.
  SELECT result.* INTO submission_result
  FROM public.gamification_task_submission_results AS result
  WHERE result.claim_id = p_claim_id
    AND result.user_id = p_user_id;
  IF FOUND THEN
    IF submission_result.submission_fingerprint = p_submission_fingerprint THEN
      RETURN QUERY SELECT 'submitted'::TEXT, submission_result.points_awarded, TRUE;
    ELSE
      RETURN QUERY SELECT 'invalid_claim'::TEXT, 0, FALSE;
    END IF;
    RETURN;
  END IF;

  IF task_claim.consumed_at IS NOT NULL THEN
    RETURN QUERY SELECT 'invalid_claim'::TEXT, 0, FALSE;
    RETURN;
  END IF;

  IF task_claim.expires_at <= clock_timestamp() THEN
    RETURN QUERY SELECT 'invalid_claim'::TEXT, 0, FALSE;
    RETURN;
  END IF;

  SELECT submission.status, submission.points_awarded
  INTO result_status, result_points
  FROM public.submit_gamification_task_contribution(
    p_claim_id,
    p_user_id,
    p_updates,
    p_is_admin
  ) AS submission;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task submission returned no result';
  END IF;

  IF result_status = 'submitted' THEN
    INSERT INTO public.gamification_task_submission_results (
      claim_id, user_id, submission_fingerprint, points_awarded
    ) VALUES (
      p_claim_id, p_user_id, p_submission_fingerprint, result_points
    );
  END IF;

  RETURN QUERY SELECT result_status, result_points, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_gamification_task_contribution_retry_safe(
  UUID, UUID, JSONB, BOOLEAN, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_gamification_task_contribution_retry_safe(
  UUID, UUID, JSONB, BOOLEAN, TEXT
) TO service_role;

COMMENT ON FUNCTION public.submit_gamification_task_contribution_retry_safe(
  UUID, UUID, JSONB, BOOLEAN, TEXT
) IS
  'Atomically records the validated submission fingerprint and points with the existing contribution write; identical owner-bound retries return the committed result without repeating side effects.';
