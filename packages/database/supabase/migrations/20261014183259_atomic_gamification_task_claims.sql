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

CREATE INDEX voice_actors_incomplete_task_hash_idx
  ON public.voice_actors ((pg_catalog.hashtextextended(id::TEXT, 0)), id)
  WHERE profile_picture IS NULL OR nationality IS NULL
    OR date_of_birth IS NULL OR bio IS NULL;

CREATE INDEX studios_incomplete_task_hash_idx
  ON public.studios ((pg_catalog.hashtextextended(id::TEXT, 0)), id)
  WHERE logo_url IS NULL OR country IS NULL OR city IS NULL
    OR website_url IS NULL;

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
  candidate_cursor REFCURSOR;
  candidate_id BIGINT;
  candidate_hash BIGINT;
  candidate_sql TEXT;
  task_sql TEXT;
  next_claim_id UUID;
  next_expiration TIMESTAMPTZ;
  selected_category TEXT;
  categories TEXT[];
  start_hash BIGINT;
  cursor_hash BIGINT;
  cursor_id BIGINT;
  task_json JSONB;
  batch_size INTEGER;
  range_pass INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_category IS NULL
    OR p_category NOT IN ('any', 'enrich_voice_actor', 'enrich_studio') THEN
    RAISE EXCEPTION 'Invalid task claim request';
  END IF;

  IF p_category = 'any' THEN
    categories := CASE WHEN random() < 0.5
      THEN ARRAY['enrich_voice_actor', 'enrich_studio']
      ELSE ARRAY['enrich_studio', 'enrich_voice_actor'] END;
  ELSE
    categories := ARRAY[p_category];
  END IF;

  next_expiration := clock_timestamp() + INTERVAL '5 minutes';

  FOREACH selected_category IN ARRAY categories LOOP
    IF selected_category = 'enrich_voice_actor' THEN
      candidate_sql := 'SELECT pg_catalog.hashtextextended(va.id::TEXT, 0), va.id
        FROM public.voice_actors AS va
        WHERE (va.profile_picture IS NULL OR va.nationality IS NULL
          OR va.date_of_birth IS NULL OR va.bio IS NULL)
          AND pg_catalog.hashtextextended(va.id::TEXT, 0) >= $1
          AND (pg_catalog.hashtextextended(va.id::TEXT, 0), va.id) > ($2, $3)
          AND NOT EXISTS (
            SELECT 1
            FROM public.gamification_task_locks AS active_claim
            WHERE active_claim.category = $4
              AND active_claim.entity_id = va.id::TEXT
              AND active_claim.expires_at > clock_timestamp()
          )
        ORDER BY pg_catalog.hashtextextended(va.id::TEXT, 0), va.id
        LIMIT 64';
      task_sql := 'SELECT to_jsonb(va)
        FROM public.voice_actors AS va
        WHERE va.id = $1
          AND (va.profile_picture IS NULL OR va.nationality IS NULL
            OR va.date_of_birth IS NULL OR va.bio IS NULL)
        FOR UPDATE OF va SKIP LOCKED';
    ELSE
      candidate_sql := 'SELECT pg_catalog.hashtextextended(s.id::TEXT, 0), s.id
        FROM public.studios AS s
        WHERE (s.logo_url IS NULL OR s.country IS NULL
          OR s.city IS NULL OR s.website_url IS NULL)
          AND pg_catalog.hashtextextended(s.id::TEXT, 0) >= $1
          AND (pg_catalog.hashtextextended(s.id::TEXT, 0), s.id) > ($2, $3)
          AND NOT EXISTS (
            SELECT 1
            FROM public.gamification_task_locks AS active_claim
            WHERE active_claim.category = $4
              AND active_claim.entity_id = s.id::TEXT
              AND active_claim.expires_at > clock_timestamp()
          )
        ORDER BY pg_catalog.hashtextextended(s.id::TEXT, 0), s.id
        LIMIT 64';
      task_sql := 'SELECT to_jsonb(s)
        FROM public.studios AS s
        WHERE s.id = $1
          AND (s.logo_url IS NULL OR s.country IS NULL
            OR s.city IS NULL OR s.website_url IS NULL)
        FOR UPDATE OF s SKIP LOCKED';
    END IF;

    -- A random point in the full 64-bit hash domain makes sparse numeric IDs
    -- independent of their distance from neighboring candidates. The partial
    -- expression index supports bounded keyset pages without sorting or
    -- serializing every eligible entity. Hash-space gaps give each task a
    -- randomized interval; ties are ordered by entity ID.
    start_hash := floor(
      random()::NUMERIC * 18446744073709551616::NUMERIC
        - 9223372036854775808::NUMERIC
    )::BIGINT;

    FOR range_pass IN 1..2 LOOP
      cursor_hash := CASE WHEN range_pass = 1 THEN start_hash ELSE '-9223372036854775808'::BIGINT END;
      cursor_id := '-9223372036854775808'::BIGINT;

      LOOP
        batch_size := 0;
        candidate_cursor := NULL;
        IF range_pass = 1 THEN
          -- Start at the random hash pivot, then continue in bounded pages.
          OPEN candidate_cursor FOR EXECUTE candidate_sql
            USING start_hash, cursor_hash, cursor_id, selected_category;
        ELSE
          -- Wrap once to the beginning so lower hash keys cannot starve.
          OPEN candidate_cursor FOR EXECUTE replace(
            candidate_sql,
            ' >= $1',
            ' < $1'
          ) USING start_hash, cursor_hash, cursor_id, selected_category;
        END IF;

        LOOP
          FETCH candidate_cursor INTO candidate_hash, candidate_id;
          EXIT WHEN NOT FOUND;
          batch_size := batch_size + 1;
          cursor_hash := candidate_hash;
          cursor_id := candidate_id;
          next_claim_id := NULL;

          -- Try a deterministic per-entity transaction lock without waiting.
          -- This serializes expired-claim reassignment and closes the race
          -- between candidate filtering and insertion without cyclic waits.
          IF NOT pg_try_advisory_xact_lock(
            hashtextextended(selected_category || ':' || candidate_id::TEXT, 0)
          ) THEN
            CONTINUE;
          END IF;

          -- Only an expired row is updated. Active claims are screened above,
          -- advisory locks prevent concurrent claimers from waiting on the
          -- same expired row; insert conflicts never update active rows.
          UPDATE public.gamification_task_locks AS task_lock
          SET locked_at = clock_timestamp(),
              claim_id = gen_random_uuid(),
              user_id = p_user_id,
              expires_at = next_expiration,
              consumed_at = NULL
          WHERE task_lock.category = selected_category
            AND task_lock.entity_id = candidate_id::TEXT
            AND task_lock.expires_at <= clock_timestamp()
          RETURNING task_lock.claim_id INTO next_claim_id;

          IF next_claim_id IS NULL THEN
            INSERT INTO public.gamification_task_locks AS inserted_claim
              (category, entity_id, locked_at, claim_id, user_id, expires_at, consumed_at)
            VALUES
              (selected_category, candidate_id::TEXT, clock_timestamp(),
                gen_random_uuid(), p_user_id, next_expiration, NULL)
            ON CONFLICT ON CONSTRAINT gamification_task_locks_pkey DO NOTHING
            RETURNING inserted_claim.claim_id INTO next_claim_id;
          END IF;

          IF next_claim_id IS NOT NULL THEN
            task_json := NULL;
            EXECUTE task_sql INTO task_json USING candidate_id;
            IF task_json IS NOT NULL THEN
              CLOSE candidate_cursor;
              RETURN QUERY SELECT task_json, selected_category, next_claim_id, next_expiration;
              RETURN;
            END IF;
            DELETE FROM public.gamification_task_locks AS stale_claim
            WHERE stale_claim.claim_id = next_claim_id
              AND stale_claim.user_id = p_user_id;
          END IF;
        END LOOP;

        CLOSE candidate_cursor;
        EXIT WHEN batch_size = 0;
      END LOOP;
    END LOOP;
  END LOOP;

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
