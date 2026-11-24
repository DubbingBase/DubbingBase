-- Credit audit rows record where the change came from, and the public API applies a batch of
-- credit changes in one transaction.

-- Every audit row records where the change came from. The origin is a transaction-local setting:
-- the website never sets it ('website'), the API wrappers below set 'api'.
CREATE OR REPLACE FUNCTION private.stamp_audit_origin()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.metadata := COALESCE(NEW.metadata, '{}'::JSONB) || pg_catalog.jsonb_build_object(
    'origin',
    COALESCE(NULLIF(pg_catalog.current_setting('app.mutation_origin', TRUE), ''), 'website')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_audit_origin ON public.audit_logs;
CREATE TRIGGER stamp_audit_origin
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION private.stamp_audit_origin();

-- Applies up to 50 credit changes as the token owner, all or nothing. `create` items hold
-- voice_actor_id, content_id, content_type, language, actor_person_id, game_character_id,
-- character_name and performance; `update` items work_id, expected_updated_at and performance;
-- Returns one {work_id, created, after} per item, `after` being the credit row as written. A
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
  v_after JSONB;
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
        SELECT audit.action = 'create', audit.new_value INTO v_created, v_after
        FROM public.audit_logs AS audit WHERE audit.id = v_row.audit_log_id;
      ELSIF p_operation = 'update' THEN
        SELECT * INTO v_row FROM public.update_voice_actor_work_performance(
          p_user_id, pg_catalog.gen_random_uuid(),
          (v_item ->> 'work_id')::BIGINT,
          (v_item ->> 'expected_updated_at')::TIMESTAMPTZ,
          v_item ->> 'performance'
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

REVOKE ALL ON FUNCTION public.api_mutate_credits(UUID, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_mutate_credits(UUID, TEXT, JSONB) TO service_role;

-- Creates an advertisement or toy as the API: same function, audited with origin 'api'.
CREATE OR REPLACE FUNCTION public.api_create_internal_media(
  p_actor_id UUID, p_request_id UUID, p_media_type TEXT, p_language TEXT, p_name TEXT,
  p_brand TEXT, p_manufacturer TEXT, p_description TEXT, p_product_line TEXT, p_release_year INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM pg_catalog.set_config('app.mutation_origin', 'api', TRUE);
  RETURN (
    SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(created))
    FROM public.create_internal_dubbing_project_with_metadata(
      p_actor_id, p_request_id, p_media_type, p_language, p_name, p_brand,
      p_manufacturer, p_description, p_product_line, p_release_year, NULL
    ) AS created
  );
END;
$$;

REVOKE ALL ON FUNCTION public.api_create_internal_media(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_create_internal_media(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) TO service_role;
