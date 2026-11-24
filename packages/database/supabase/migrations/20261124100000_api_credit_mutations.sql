-- Credit audit rows record where the change came from, and the public API applies a batch of
-- credit changes in one transaction.

-- The origin is a transaction-local setting so the existing audited functions stay unchanged:
-- the website never sets it ('website'), api_mutate_credits sets 'api'.
CREATE OR REPLACE FUNCTION public.audit_voice_actor_work_mutation(
  p_user_id UUID,
  p_request_id UUID,
  p_request_fingerprint TEXT,
  p_work_id BIGINT,
  p_action TEXT,
  p_before JSONB,
  p_after JSONB,
  p_metadata JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_audit_id UUID := pg_catalog.gen_random_uuid();
BEGIN
  INSERT INTO public.audit_logs (
    id, user_id, entity_type, entity_id, action,
    previous_value, new_value, changed_fields,
    request_id, request_fingerprint, metadata
  ) VALUES (
    v_audit_id, p_user_id, 'work', p_work_id::TEXT, p_action,
    p_before, p_after, ARRAY[]::TEXT[],
    p_request_id, p_request_fingerprint,
    COALESCE(p_metadata, '{}'::JSONB) || pg_catalog.jsonb_build_object(
      'source', 'voice_actor_work_mutation',
      'operation', p_action,
      'origin', COALESCE(NULLIF(pg_catalog.current_setting('app.mutation_origin', TRUE), ''), 'website'),
      'transaction_id', pg_catalog.pg_current_xact_id()::TEXT
    )
  );
  RETURN v_audit_id;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_voice_actor_work_mutation(UUID, UUID, TEXT, BIGINT, TEXT, JSONB, JSONB, JSONB)
  FROM PUBLIC, anon, authenticated, service_role;

-- Applies up to 50 credit changes as the token owner, all or nothing. `create` items hold
-- voice_actor_id, content_id, content_type, language, actor_person_id, game_character_id,
-- character_name and performance; `update` items work_id, expected_updated_at and performance;
-- Returns one {work_id, created} per item. A
-- rejected item aborts everything and names its position in the error HINT.
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
  v_results JSONB := '[]'::JSONB;
BEGIN
  IF p_user_id IS NULL
     OR p_operation IS NULL OR p_operation NOT IN ('create', 'update')
     OR p_items IS NULL OR pg_catalog.jsonb_typeof(p_items) <> 'array'
     OR pg_catalog.jsonb_array_length(p_items) NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'Credit mutation request is invalid' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.set_config('app.mutation_origin', 'api', TRUE);

  FOR v_item IN SELECT item.value FROM pg_catalog.jsonb_array_elements(p_items) AS item(value) LOOP
    BEGIN
      v_created := FALSE;
      IF p_operation = 'create' THEN
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
        SELECT audit.action = 'create' INTO v_created
        FROM public.audit_logs AS audit WHERE audit.id = v_row.audit_log_id;
      ELSIF p_operation = 'update' THEN
        SELECT * INTO v_row FROM public.update_voice_actor_work_performance(
          p_user_id, pg_catalog.gen_random_uuid(),
          (v_item ->> 'work_id')::BIGINT,
          (v_item ->> 'expected_updated_at')::TIMESTAMPTZ,
          v_item ->> 'performance'
        );
      END IF;
      v_results := v_results || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object('work_id', v_row.work_id, 'created', v_created)
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

REVOKE ALL ON FUNCTION public.api_mutate_credits(UUID, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_mutate_credits(UUID, TEXT, JSONB) TO service_role;
