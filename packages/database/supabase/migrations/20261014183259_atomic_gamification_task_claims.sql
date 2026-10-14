ALTER TABLE public.gamification_task_locks
  ADD COLUMN claim_id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN user_id UUID REFERENCES auth.users(id),
  ADD COLUMN expires_at TIMESTAMPTZ,
  ADD COLUMN consumed_at TIMESTAMPTZ;

UPDATE public.gamification_task_locks
SET expires_at = COALESCE(locked_at, '-infinity'::TIMESTAMPTZ) + INTERVAL '5 minutes';

ALTER TABLE public.gamification_task_locks
  ALTER COLUMN expires_at SET NOT NULL,
  ALTER COLUMN expires_at SET DEFAULT (now() + INTERVAL '5 minutes');

CREATE UNIQUE INDEX gamification_task_locks_claim_id_key
  ON public.gamification_task_locks (claim_id);

CREATE OR REPLACE FUNCTION public.claim_gamification_task(
  p_category TEXT,
  p_user_id UUID
)
RETURNS TABLE(task JSONB, category TEXT, claim_id UUID, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  candidate RECORD;
  next_claim_id UUID;
  next_expiration TIMESTAMPTZ;
  selected_category TEXT;
BEGIN
  IF p_user_id IS NULL OR p_category IS NULL
    OR p_category NOT IN ('any', 'enrich_voice_actor', 'enrich_studio') THEN
    RAISE EXCEPTION 'Invalid task claim request';
  END IF;

  selected_category := p_category;
  IF selected_category = 'any' THEN
    selected_category := CASE WHEN random() < 0.5
      THEN 'enrich_voice_actor' ELSE 'enrich_studio' END;
  END IF;

  next_expiration := clock_timestamp() + INTERVAL '5 minutes';

  IF selected_category = 'enrich_voice_actor' THEN
    FOR candidate IN
      SELECT to_jsonb(va) AS task, va.id::TEXT AS entity_id
      FROM public.voice_actors AS va
      WHERE va.profile_picture IS NULL OR va.nationality IS NULL
        OR va.date_of_birth IS NULL OR va.bio IS NULL
      ORDER BY random()
    LOOP
      INSERT INTO public.gamification_task_locks AS task_lock
        (category, entity_id, locked_at, claim_id, user_id, expires_at, consumed_at)
      VALUES
        (selected_category, candidate.entity_id, clock_timestamp(), gen_random_uuid(), p_user_id, next_expiration, NULL)
      ON CONFLICT ON CONSTRAINT gamification_task_locks_pkey DO UPDATE
        SET locked_at = EXCLUDED.locked_at,
            claim_id = EXCLUDED.claim_id,
            user_id = EXCLUDED.user_id,
            expires_at = EXCLUDED.expires_at,
            consumed_at = NULL
        WHERE task_lock.expires_at <= clock_timestamp()
      RETURNING task_lock.claim_id
        INTO next_claim_id;

      IF next_claim_id IS NOT NULL THEN
        RETURN QUERY SELECT candidate.task, selected_category, next_claim_id, next_expiration;
        RETURN;
      END IF;
      next_claim_id := NULL;
    END LOOP;
  ELSE
    FOR candidate IN
      SELECT to_jsonb(s) AS task, s.id::TEXT AS entity_id
      FROM public.studios AS s
      WHERE s.logo_url IS NULL OR s.country IS NULL OR s.city IS NULL
        OR s.website_url IS NULL
      ORDER BY random()
    LOOP
      INSERT INTO public.gamification_task_locks AS task_lock
        (category, entity_id, locked_at, claim_id, user_id, expires_at, consumed_at)
      VALUES
        (selected_category, candidate.entity_id, clock_timestamp(), gen_random_uuid(), p_user_id, next_expiration, NULL)
      ON CONFLICT ON CONSTRAINT gamification_task_locks_pkey DO UPDATE
        SET locked_at = EXCLUDED.locked_at,
            claim_id = EXCLUDED.claim_id,
            user_id = EXCLUDED.user_id,
            expires_at = EXCLUDED.expires_at,
            consumed_at = NULL
        WHERE task_lock.expires_at <= clock_timestamp()
      RETURNING task_lock.claim_id
        INTO next_claim_id;

      IF next_claim_id IS NOT NULL THEN
        RETURN QUERY SELECT candidate.task, selected_category, next_claim_id, next_expiration;
        RETURN;
      END IF;
      next_claim_id := NULL;
    END LOOP;
  END IF;
  RETURN QUERY SELECT NULL::JSONB, selected_category, NULL::UUID, NULL::TIMESTAMPTZ;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_gamification_task_claim(
  p_claim_id UUID,
  p_user_id UUID
)
RETURNS TABLE(category TEXT, entity_id TEXT)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  UPDATE public.gamification_task_locks AS claim
  SET consumed_at = clock_timestamp()
  WHERE claim.claim_id = p_claim_id
    AND claim.user_id = p_user_id
    AND claim.expires_at > clock_timestamp()
    AND claim.consumed_at IS NULL
  RETURNING claim.category, claim.entity_id;
$$;

REVOKE ALL ON FUNCTION public.claim_gamification_task(TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_gamification_task_claim(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_gamification_task(TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_gamification_task_claim(UUID, UUID) TO service_role;

COMMENT ON FUNCTION public.consume_gamification_task_claim(UUID, UUID) IS
  'Returns category and entity_id only when it atomically marks an unexpired, unused claim for its owner consumed. Call within the same Postgres transaction as task mutation, audit and points so any failure rolls back consumption.';
