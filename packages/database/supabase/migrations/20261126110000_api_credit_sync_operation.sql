-- `sync` operation for api_mutate_credits: creates and in-place updates of one request run in a single
-- transaction, so a rejected item rolls back the creates too. Items with a `work_id` are updates.
CREATE OR REPLACE FUNCTION public.api_mutate_credits(p_user_id UUID, p_operation TEXT, p_items JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item JSONB;
  v_index INTEGER := 0;
  v_row RECORD;
  v_created BOOLEAN;
  v_after JSONB;
  v_results JSONB := '[]'::JSONB;
BEGIN
  IF p_user_id IS NULL
     OR p_operation IS NULL OR p_operation NOT IN ('create', 'update', 'sync')
     OR p_items IS NULL OR pg_catalog.jsonb_typeof(p_items) <> 'array'
     OR pg_catalog.jsonb_array_length(p_items) NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'Credit mutation request is invalid' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.set_config('app.mutation_origin', 'api', TRUE);

  FOR v_item IN SELECT item.value FROM pg_catalog.jsonb_array_elements(p_items) AS item(value) LOOP
    BEGIN
      v_created := FALSE;
      -- `sync` items are creates, or updates when they carry a work_id, in one transaction.
      IF p_operation = 'create' OR (p_operation = 'sync' AND NOT v_item ? 'work_id') THEN
        SELECT * INTO v_row FROM public.create_voice_actor_work_link(
          p_user_id, pg_catalog.gen_random_uuid(),
          (v_item ->> 'voice_actor_id')::BIGINT,
          (v_item ->> 'content_id')::BIGINT,
          v_item ->> 'content_type',
          v_item ->> 'language',
          (v_item ->> 'actor_person_id')::BIGINT,
          (v_item ->> 'game_character_id')::UUID,
          v_item ->> 'character_name',
          v_item ->> 'performance'
        );
        SELECT audit.action = 'create', audit.new_value INTO v_created, v_after
        FROM public.audit_logs AS audit WHERE audit.id = v_row.audit_log_id;
        -- A credit created with highlight = true is flagged right after, as its own audited
        -- update in the same transaction. A credit that already existed is left alone: use
        -- the update operation to change it.
        IF v_created AND COALESCE((v_item ->> 'highlight')::BOOLEAN, FALSE) THEN
          SELECT * INTO v_row FROM public.update_voice_actor_work_credit(
            p_user_id, pg_catalog.gen_random_uuid(),
            v_row.work_id,
            (SELECT work.updated_at FROM public.work AS work WHERE work.id = v_row.work_id),
            pg_catalog.jsonb_build_object('highlight', TRUE)
          );
          SELECT audit.new_value INTO v_after
          FROM public.audit_logs AS audit WHERE audit.id = v_row.audit_log_id;
        END IF;
      ELSE
        SELECT * INTO v_row FROM public.update_voice_actor_work_credit(
          p_user_id, pg_catalog.gen_random_uuid(),
          (v_item ->> 'work_id')::BIGINT,
          (v_item ->> 'expected_updated_at')::TIMESTAMPTZ,
          v_item - 'work_id' - 'expected_updated_at'
        );
        SELECT audit.new_value INTO v_after
        FROM public.audit_logs AS audit WHERE audit.id = v_row.audit_log_id;
      END IF;
      v_results := v_results || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object('work_id', v_row.work_id, 'created', v_created, 'after', v_after)
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Credit % was rejected', v_index
        USING ERRCODE = SQLSTATE, HINT = v_index::TEXT;
    END;
    v_index := v_index + 1;
  END LOOP;
  RETURN v_results;
END;
$$;
