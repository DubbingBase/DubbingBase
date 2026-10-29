CREATE OR REPLACE FUNCTION public.audit_authenticated_work_writes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id UUID;
  v_work_id BIGINT;
  v_before JSONB;
  v_after JSONB;
BEGIN
  -- Controlled server-side operations use the service role and write their
  -- own request-aware audits. This trigger covers direct browser-role writes
  -- retained for trusted administrators by the existing RLS policy.
  IF auth.jwt() ->> 'role' IS DISTINCT FROM 'authenticated' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated work writes require an actor'
      USING ERRCODE = '28000';
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_work_id := NEW.id;
    v_before := NULL;
    v_after := pg_catalog.to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_work_id := NEW.id;
    v_before := pg_catalog.to_jsonb(OLD);
    v_after := pg_catalog.to_jsonb(NEW);
  ELSE
    v_work_id := OLD.id;
    v_before := pg_catalog.to_jsonb(OLD);
    v_after := NULL;
  END IF;

  INSERT INTO public.audit_logs (
    user_id, entity_type, entity_id, action,
    previous_value, new_value, metadata
  ) VALUES (
    v_actor_id,
    'work',
    v_work_id::TEXT,
    pg_catalog.lower(TG_OP),
    v_before,
    v_after,
    pg_catalog.jsonb_build_object(
      'source', 'authenticated_work_table_write',
      'operation', pg_catalog.lower(TG_OP),
      'transaction_id', pg_catalog.pg_current_xact_id()::TEXT
    )
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- Row triggers do not run for TRUNCATE. Remove inherited or direct client
-- grants that could otherwise erase work records without a per-row audit.
REVOKE TRUNCATE, TRIGGER ON TABLE public.work
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.audit_authenticated_work_writes()
  FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS audit_authenticated_work_writes ON public.work;
CREATE TRIGGER audit_authenticated_work_writes
  AFTER INSERT OR UPDATE OR DELETE ON public.work
  FOR EACH ROW EXECUTE FUNCTION public.audit_authenticated_work_writes();

-- Close the database-first rollout window: the previous route used a
-- service-role table update. Block that direct path while leaving trusted
-- authenticated admin writes covered by the audit trigger above. Controlled
-- SECURITY DEFINER RPCs run as postgres and remain compatible.
CREATE OR REPLACE FUNCTION public.guard_uncontrolled_work_review_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin', 'authenticated') THEN
    RAISE EXCEPTION 'Review status changes must use an audited operation'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_uncontrolled_work_review_status()
  FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS guard_uncontrolled_work_review_status ON public.work;
CREATE TRIGGER guard_uncontrolled_work_review_status
  BEFORE UPDATE OF reviewed_status ON public.work
  FOR EACH ROW EXECUTE FUNCTION public.guard_uncontrolled_work_review_status();

CREATE OR REPLACE FUNCTION public.update_work_review_status_controlled(
  p_actor_id UUID,
  p_request_id UUID,
  p_work_id BIGINT,
  p_expected_updated_at TIMESTAMPTZ,
  p_reviewed_status TEXT
)
RETURNS TABLE(work_id BIGINT, audit_log_id UUID, replayed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_metadata JSONB;
  v_voice_actor_id BIGINT;
  v_voice_actor_link_id UUID;
  v_before public.work%ROWTYPE;
  v_after public.work%ROWTYPE;
  v_existing_audit public.audit_logs%ROWTYPE;
  v_fingerprint TEXT;
  v_audit_log_id UUID;
BEGIN
  IF p_actor_id IS NULL OR p_work_id IS NULL OR p_work_id <= 0
     OR p_expected_updated_at IS NULL
     OR p_reviewed_status IS NULL
     OR p_reviewed_status NOT IN ('waiting', 'accepted', 'rejected') THEN
    RAISE EXCEPTION 'Review status update fields are invalid'
      USING ERRCODE = '22023';
  END IF;

  IF p_request_id IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'work-review-request:' || p_actor_id::TEXT || ':' || p_request_id::TEXT,
        0
      )
    );
  END IF;

  SELECT users.raw_app_meta_data
  INTO v_actor_metadata
  FROM auth.users AS users
  WHERE users.id = p_actor_id
  FOR SHARE OF users;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Authenticated actor was not found' USING ERRCODE = '28000';
  END IF;

  SELECT work.* INTO v_before
  FROM public.work AS work
  WHERE work.id = p_work_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work not found' USING ERRCODE = 'P0002';
  END IF;

  IF COALESCE(v_actor_metadata ->> 'role' = 'admin', FALSE) THEN
    NULL;
  ELSE
    v_voice_actor_id := v_before.voice_actor_id;
    IF v_voice_actor_id IS NULL THEN
      RAISE EXCEPTION 'Review status update is not authorized' USING ERRCODE = '42501';
    END IF;

    SELECT link.id INTO v_voice_actor_link_id
    FROM public.user_voice_actor_links AS link
    WHERE link.user_id = p_actor_id
      AND link.voice_actor_id = v_voice_actor_id
    FOR KEY SHARE OF link;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Review status update is not authorized' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_request_id IS NOT NULL THEN
    v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
      'operation', 'update_work_review_status',
      'work_id', p_work_id,
      'reviewed_status', p_reviewed_status
    )::TEXT);

    SELECT audit.* INTO v_existing_audit
    FROM public.audit_logs AS audit
    WHERE audit.user_id = p_actor_id
      AND audit.request_id = p_request_id;
    IF FOUND THEN
      IF v_existing_audit.request_fingerprint IS DISTINCT FROM v_fingerprint
         OR v_existing_audit.entity_type <> 'work'
         OR v_existing_audit.entity_id <> p_work_id::TEXT
         OR v_existing_audit.action <> 'update_review_status' THEN
        RAISE EXCEPTION 'Request id was already used with different work data'
          USING ERRCODE = '23505';
      END IF;
      RETURN QUERY SELECT p_work_id, v_existing_audit.id, TRUE;
      RETURN;
    END IF;
  END IF;

  IF v_before.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Work changed since it was loaded' USING ERRCODE = '40001';
  END IF;

  IF v_before.reviewed_status IS NOT DISTINCT FROM p_reviewed_status
     AND p_request_id IS NULL THEN
    -- Legacy callers without retry metadata remain compatible. A same-value
    -- retry has no effect and needs no second audit event.
    RETURN QUERY SELECT p_work_id, NULL::UUID, FALSE;
    RETURN;
  ELSIF v_before.reviewed_status IS NOT DISTINCT FROM p_reviewed_status THEN
    v_after := v_before;
  ELSE
    PERFORM pg_catalog.set_config('request.jwt.claim.sub', p_actor_id::TEXT, TRUE);
    PERFORM pg_catalog.set_config('app.controlled_voice_actor_work_mutation', 'true', TRUE);
    UPDATE public.work AS work
    SET reviewed_status = p_reviewed_status,
        updated_by = p_actor_id
    WHERE work.id = p_work_id
    RETURNING work.* INTO v_after;
  END IF;

  v_audit_log_id := public.audit_voice_actor_work_mutation(
    p_actor_id,
    p_request_id,
    v_fingerprint,
    p_work_id,
    'update_review_status',
    pg_catalog.to_jsonb(v_before),
    pg_catalog.to_jsonb(v_after),
    pg_catalog.jsonb_build_object('reviewed_status', p_reviewed_status)
  );

  RETURN QUERY SELECT p_work_id, v_audit_log_id, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.update_work_review_status_controlled(UUID, UUID, BIGINT, TIMESTAMPTZ, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_work_review_status_controlled(UUID, UUID, BIGINT, TIMESTAMPTZ, TEXT)
  TO service_role;
