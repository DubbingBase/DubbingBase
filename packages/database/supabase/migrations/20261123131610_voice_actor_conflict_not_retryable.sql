-- PostgREST treats SQLSTATE 40001 (serialization_failure) as retryable and re-runs the call until
-- the gateway times out, so a stale `expected_updated_at` hung instead of returning a conflict.
-- `PT409` is PostgREST's custom code for "respond 409 immediately". Only the conflict raise in
-- controlled_update_voice_actor changes; the rest of the function is re-created verbatim.
--
-- Rollback: re-run this with the two literals swapped ('PT409' -> '40001').
DO $migration$
DECLARE
  v_signature CONSTANT regprocedure :=
    'public.controlled_update_voice_actor(uuid,bigint,jsonb,timestamptz,uuid)'::regprocedure;
  v_definition TEXT := pg_get_functiondef(v_signature);
BEGIN
  IF position($old$USING ERRCODE = '40001'$old$ IN v_definition) = 0 THEN
    RAISE EXCEPTION 'controlled_update_voice_actor no longer raises 40001; review this migration';
  END IF;
  EXECUTE replace(v_definition, $old$USING ERRCODE = '40001'$old$, $new$USING ERRCODE = 'PT409'$new$);
END
$migration$;
