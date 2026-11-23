-- PostgREST treats SQLSTATE 40001 (serialization_failure) as retryable and re-runs the call until
-- the gateway times out, so a stale version check hung instead of returning a conflict.
-- `PT409` is PostgREST's custom code for "respond 409 immediately". Same fix as
-- 20261123131610_voice_actor_conflict_not_retryable.sql, applied to the remaining functions.
-- Each function is re-created verbatim from its CURRENT definition with only the error code swapped
-- (CREATE OR REPLACE keeps grants, SECURITY DEFINER and SET search_path). The migration fails loudly
-- if a function no longer contains exactly the expected number of 40001 raises.
--
-- Rollback: re-run this with the two literals swapped ('PT409' -> '40001') in the pattern/replacement.
DO $migration$
DECLARE
  v_target RECORD;
  v_definition TEXT;
BEGIN
  FOR v_target IN
    SELECT * FROM (VALUES
      ('public.update_voice_actor_work_performance(uuid,uuid,bigint,timestamptz,text)'::regprocedure, 1),
      ('public.save_regional_project_actor_assignments(bigint,text,text,jsonb,uuid,uuid)'::regprocedure, 6),
      ('public.delete_voice_actor_work_link(uuid,uuid,bigint,timestamptz)'::regprocedure, 1),
      ('public.merge_work_duplicates_atomic(bigint,bigint[],jsonb,uuid)'::regprocedure, 2),
      ('public.update_work_review_status_controlled(uuid,uuid,bigint,timestamptz,text)'::regprocedure, 1),
      ('public.controlled_save_studio(uuid,bigint,timestamp,uuid,jsonb)'::regprocedure, 1),
      ('public.controlled_set_voice_actor_picture(uuid,bigint,text,text)'::regprocedure, 1)
    ) AS t(signature, expected_raises)
  LOOP
    v_definition := pg_get_functiondef(v_target.signature);
    IF (length(v_definition) - length(replace(v_definition, $old$USING ERRCODE = '40001'$old$, '')))
         / length($old$USING ERRCODE = '40001'$old$) <> v_target.expected_raises
       OR position('40001' IN replace(v_definition, $old$USING ERRCODE = '40001'$old$, '')) <> 0 THEN
      RAISE EXCEPTION '% no longer raises 40001 exactly % time(s); review this migration',
        v_target.signature, v_target.expected_raises;
    END IF;
    EXECUTE replace(v_definition, $old$USING ERRCODE = '40001'$old$, $new$USING ERRCODE = 'PT409'$new$);
  END LOOP;
END
$migration$;
