-- Run only against an isolated local database after applying all migrations.
-- The synthetic rows and statistics remain local to this disposable rehearsal.
\set ON_ERROR_STOP on
BEGIN;

INSERT INTO public.voice_actors (firstname, lastname)
SELECT 'Atomic claim plan actor ' || actor_number::TEXT, 'Fixture'
FROM generate_series(1, 20000) AS actor_number;

INSERT INTO public.studios (name)
SELECT 'Atomic claim plan studio ' || studio_number::TEXT
FROM generate_series(1, 5000) AS studio_number;

ANALYZE public.voice_actors;
ANALYZE public.studios;

-- Baseline: the former random ordering must visit and sort the full eligible set.
EXPLAIN (ANALYZE, BUFFERS, COSTS, VERBOSE, TIMING OFF, SUMMARY ON)
SELECT to_jsonb(va) AS task, va.id::TEXT AS entity_id
FROM public.voice_actors AS va
WHERE va.profile_picture IS NULL OR va.nationality IS NULL
  OR va.date_of_birth IS NULL OR va.bio IS NULL
ORDER BY random();

-- Current candidate page seeks from a random hash pivot, excludes active
-- claims, and reads at most 64 IDs from the partial expression index.
EXPLAIN (ANALYZE, BUFFERS, COSTS, VERBOSE, TIMING OFF, SUMMARY ON)
SELECT pg_catalog.hashtextextended(va.id::TEXT, 0) AS candidate_hash, va.id
FROM public.voice_actors AS va
WHERE (va.profile_picture IS NULL OR va.nationality IS NULL
  OR va.date_of_birth IS NULL OR va.bio IS NULL)
  AND pg_catalog.hashtextextended(va.id::TEXT, 0) >= 0
  AND (pg_catalog.hashtextextended(va.id::TEXT, 0), va.id) > (0, 0)
  AND NOT EXISTS (
    SELECT 1
    FROM public.gamification_task_locks AS active_claim
    WHERE active_claim.category = 'enrich_voice_actor'
      AND active_claim.entity_id = va.id::TEXT
      AND active_claim.expires_at > clock_timestamp()
  )
ORDER BY pg_catalog.hashtextextended(va.id::TEXT, 0), va.id
LIMIT 64;

EXPLAIN (ANALYZE, BUFFERS, COSTS, VERBOSE, TIMING OFF, SUMMARY ON)
SELECT pg_catalog.hashtextextended(s.id::TEXT, 0) AS candidate_hash, s.id
FROM public.studios AS s
WHERE (s.logo_url IS NULL OR s.country IS NULL OR s.city IS NULL
  OR s.website_url IS NULL)
  AND pg_catalog.hashtextextended(s.id::TEXT, 0) >= 0
  AND (pg_catalog.hashtextextended(s.id::TEXT, 0), s.id) > (0, 0)
  AND NOT EXISTS (
    SELECT 1
    FROM public.gamification_task_locks AS active_claim
    WHERE active_claim.category = 'enrich_studio'
      AND active_claim.entity_id = s.id::TEXT
      AND active_claim.expires_at > clock_timestamp()
  )
ORDER BY pg_catalog.hashtextextended(s.id::TEXT, 0), s.id
LIMIT 64;

ROLLBACK;
