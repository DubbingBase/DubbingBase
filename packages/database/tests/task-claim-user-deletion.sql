-- Run against an isolated local database after applying all migrations.
-- Synthetic auth and claim rows roll back at the end of this test.
\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
  claimant_id UUID := gen_random_uuid();
  test_claim_id UUID := gen_random_uuid();
  entity_id TEXT := 'account-deletion-' || gen_random_uuid()::TEXT;
BEGIN
  INSERT INTO auth.users (id) VALUES (claimant_id);

  INSERT INTO public.gamification_task_locks (
    category, entity_id, claim_id, user_id, expires_at
  ) VALUES (
    'enrich_voice_actor', entity_id, test_claim_id, claimant_id,
    clock_timestamp() - INTERVAL '1 second'
  );

  DELETE FROM auth.users WHERE id = claimant_id;

  IF EXISTS (
    SELECT 1 FROM public.gamification_task_locks AS task_claim
    WHERE task_claim.claim_id = test_claim_id
  ) THEN
    RAISE EXCEPTION 'Deleting a user left an expired task claim behind';
  END IF;
END;
$$;

ROLLBACK;
