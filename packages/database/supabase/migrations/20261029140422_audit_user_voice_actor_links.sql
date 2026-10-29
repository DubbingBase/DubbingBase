-- Ownership links are authorization records, so their mutations must be
-- attributed and audited inside the database transaction.

DROP POLICY IF EXISTS "Allow users or admins to manage voice actor links"
  ON public.user_voice_actor_links;
DROP POLICY IF EXISTS "Allow public read access to user_voice_actor_links"
  ON public.user_voice_actor_links;

CREATE POLICY "Allow public read access to user_voice_actor_links"
  ON public.user_voice_actor_links
  FOR SELECT TO public
  USING (true);

-- Browser and service-role table writes would bypass the controlled RPCs.
REVOKE ALL ON TABLE public.user_voice_actor_links
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.user_voice_actor_links
  TO anon, authenticated, service_role;

-- Completed request results prevent delayed retries from re-applying a link
-- or unlink after a later editor has changed the relationship.
CREATE TABLE public.user_voice_actor_link_requests (
  actor_id UUID NOT NULL,
  request_id UUID NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('link', 'delete')),
  payload_fingerprint TEXT NOT NULL,
  target_user_id UUID NOT NULL,
  voice_actor_id INTEGER NOT NULL,
  expected_link_id UUID,
  result_link_id UUID,
  result_changed BOOLEAN,
  audit_log_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (actor_id, request_id),
  CHECK ((operation = 'delete') = (expected_link_id IS NOT NULL))
);

ALTER TABLE public.user_voice_actor_link_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_voice_actor_link_requests
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_link_user_voice_actor_controlled(
  p_actor_id UUID,
  p_request_id UUID,
  p_user_id UUID,
  p_voice_actor_id INTEGER
)
RETURNS TABLE (link_id UUID, created BOOLEAN, audit_log_id UUID, replayed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_role TEXT;
  v_link public.user_voice_actor_links%ROWTYPE;
  v_request public.user_voice_actor_link_requests%ROWTYPE;
  v_audit_log_id UUID;
  v_fingerprint TEXT;
  v_rows INTEGER;
BEGIN
  IF p_actor_id IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Authenticated actor does not match request'
      USING ERRCODE = '42501';
  END IF;

  SELECT actor.raw_app_meta_data ->> 'role'
  INTO v_actor_role
  FROM auth.users AS actor
  WHERE actor.id = p_actor_id
  FOR SHARE;

  IF NOT FOUND OR v_actor_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Administrator access is required'
      USING ERRCODE = '42501';
  END IF;

  IF p_request_id IS NULL OR p_user_id IS NULL
     OR p_voice_actor_id IS NULL OR p_voice_actor_id <= 0 THEN
    RAISE EXCEPTION 'Request, user, and voice actor are required'
      USING ERRCODE = '22023';
  END IF;

  v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'operation', 'link',
    'user_id', p_user_id,
    'voice_actor_id', p_voice_actor_id
  )::TEXT);

  INSERT INTO public.user_voice_actor_link_requests (
    actor_id, request_id, operation, payload_fingerprint,
    target_user_id, voice_actor_id
  ) VALUES (
    p_actor_id, p_request_id, 'link', v_fingerprint,
    p_user_id, p_voice_actor_id
  )
  ON CONFLICT (actor_id, request_id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    SELECT request.*
    INTO v_request
    FROM public.user_voice_actor_link_requests AS request
    WHERE request.actor_id = p_actor_id AND request.request_id = p_request_id
    FOR UPDATE;

    IF v_request.operation IS DISTINCT FROM 'link'
       OR v_request.target_user_id IS DISTINCT FROM p_user_id
       OR v_request.voice_actor_id IS DISTINCT FROM p_voice_actor_id
       OR v_request.payload_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'Request ID was already used with a different payload'
        USING ERRCODE = 'P2001';
    END IF;
    IF v_request.completed_at IS NULL THEN
      RAISE EXCEPTION 'Request result is incomplete'
        USING ERRCODE = '55000';
    END IF;

    RETURN QUERY SELECT
      v_request.result_link_id,
      COALESCE(v_request.result_changed, FALSE),
      v_request.audit_log_id,
      TRUE;
    RETURN;
  END IF;

  PERFORM 1 FROM auth.users WHERE id = p_user_id FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user does not exist' USING ERRCODE = 'P0002';
  END IF;

  PERFORM 1 FROM public.voice_actors WHERE id = p_voice_actor_id FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Voice actor does not exist' USING ERRCODE = 'P0002';
  END IF;

  LOOP
    INSERT INTO public.user_voice_actor_links (
      user_id, voice_actor_id, created_by, updated_by
    ) VALUES (
      p_user_id, p_voice_actor_id, p_actor_id, p_actor_id
    )
    ON CONFLICT ON CONSTRAINT user_voice_actor_links_user_id_voice_actor_id_key
      DO NOTHING
    RETURNING * INTO v_link;

    IF FOUND THEN
      INSERT INTO public.audit_logs (
        user_id, entity_type, entity_id, action,
        previous_value, new_value, points_awarded,
        request_id, request_fingerprint, metadata
      ) VALUES (
        p_actor_id,
        'user_voice_actor_link',
        v_link.id::TEXT,
        'create',
        NULL,
        pg_catalog.to_jsonb(v_link),
        0,
        p_request_id,
        v_fingerprint,
        pg_catalog.jsonb_build_object(
          'source', 'api/link-user-voice-actor',
          'request_id', p_request_id
        )
      )
      RETURNING id INTO v_audit_log_id;

      UPDATE public.user_voice_actor_link_requests AS request
      SET result_link_id = v_link.id,
          result_changed = TRUE,
          audit_log_id = v_audit_log_id,
          completed_at = pg_catalog.clock_timestamp()
      WHERE request.actor_id = p_actor_id AND request.request_id = p_request_id;

      RETURN QUERY SELECT v_link.id, TRUE, v_audit_log_id, FALSE;
      RETURN;
    END IF;

    SELECT link.*
    INTO v_link
    FROM public.user_voice_actor_links AS link
    WHERE link.user_id = p_user_id
      AND link.voice_actor_id = p_voice_actor_id
    FOR UPDATE;

    IF FOUND THEN
      SELECT audit.id
      INTO v_audit_log_id
      FROM public.audit_logs AS audit
      WHERE audit.entity_type = 'user_voice_actor_link'
        AND audit.entity_id = v_link.id::TEXT
        AND audit.action = 'create'
      ORDER BY audit.created_at DESC, audit.id DESC
      LIMIT 1;

      UPDATE public.user_voice_actor_link_requests AS request
      SET result_link_id = v_link.id,
          result_changed = FALSE,
          audit_log_id = v_audit_log_id,
          completed_at = pg_catalog.clock_timestamp()
      WHERE request.actor_id = p_actor_id AND request.request_id = p_request_id;

      RETURN QUERY SELECT v_link.id, FALSE, v_audit_log_id, FALSE;
      RETURN;
    END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_user_voice_actor_link_controlled(
  p_actor_id UUID,
  p_request_id UUID,
  p_user_id UUID,
  p_voice_actor_id INTEGER,
  p_expected_link_id UUID
)
RETURNS TABLE (deleted BOOLEAN, audit_log_id UUID, replayed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_role TEXT;
  v_link public.user_voice_actor_links%ROWTYPE;
  v_request public.user_voice_actor_link_requests%ROWTYPE;
  v_current_link_id UUID;
  v_audit_log_id UUID;
  v_fingerprint TEXT;
  v_rows INTEGER;
BEGIN
  IF p_actor_id IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Authenticated actor does not match request'
      USING ERRCODE = '42501';
  END IF;

  SELECT actor.raw_app_meta_data ->> 'role'
  INTO v_actor_role
  FROM auth.users AS actor
  WHERE actor.id = p_actor_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Authenticated actor does not exist'
      USING ERRCODE = '42501';
  END IF;

  IF p_request_id IS NULL OR p_user_id IS NULL OR p_voice_actor_id IS NULL
     OR p_voice_actor_id <= 0 OR p_expected_link_id IS NULL THEN
    RAISE EXCEPTION 'Request, user, voice actor, and expected link are required'
      USING ERRCODE = '22023';
  END IF;

  IF p_user_id IS DISTINCT FROM p_actor_id
     AND v_actor_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only administrators may unlink another user'
      USING ERRCODE = '42501';
  END IF;

  v_fingerprint := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'operation', 'delete',
    'user_id', p_user_id,
    'voice_actor_id', p_voice_actor_id,
    'expected_link_id', p_expected_link_id
  )::TEXT);

  INSERT INTO public.user_voice_actor_link_requests (
    actor_id, request_id, operation, payload_fingerprint,
    target_user_id, voice_actor_id,
    expected_link_id
  ) VALUES (
    p_actor_id, p_request_id, 'delete', v_fingerprint,
    p_user_id, p_voice_actor_id,
    p_expected_link_id
  )
  ON CONFLICT (actor_id, request_id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    SELECT request.*
    INTO v_request
    FROM public.user_voice_actor_link_requests AS request
    WHERE request.actor_id = p_actor_id AND request.request_id = p_request_id
    FOR UPDATE;

    IF v_request.operation IS DISTINCT FROM 'delete'
       OR v_request.target_user_id IS DISTINCT FROM p_user_id
       OR v_request.voice_actor_id IS DISTINCT FROM p_voice_actor_id
       OR v_request.expected_link_id IS DISTINCT FROM p_expected_link_id
       OR v_request.payload_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'Request ID was already used with a different payload'
        USING ERRCODE = 'P2001';
    END IF;
    IF v_request.completed_at IS NULL THEN
      RAISE EXCEPTION 'Request result is incomplete'
        USING ERRCODE = '55000';
    END IF;

    RETURN QUERY SELECT
      COALESCE(v_request.result_changed, FALSE),
      v_request.audit_log_id,
      TRUE;
    RETURN;
  END IF;

  SELECT link.*
  INTO v_link
  FROM public.user_voice_actor_links AS link
  WHERE link.id = p_expected_link_id
  FOR UPDATE;

  IF FOUND AND (v_link.user_id IS DISTINCT FROM p_user_id
                OR v_link.voice_actor_id IS DISTINCT FROM p_voice_actor_id) THEN
    RAISE EXCEPTION 'Expected link does not belong to the requested user and voice actor'
      USING ERRCODE = 'P2001';
  END IF;

  IF NOT FOUND THEN
    SELECT link.id
    INTO v_current_link_id
    FROM public.user_voice_actor_links AS link
    WHERE link.user_id = p_user_id AND link.voice_actor_id = p_voice_actor_id
    FOR UPDATE;

    IF FOUND THEN
      RAISE EXCEPTION 'Voice-actor link changed since it was selected'
        USING ERRCODE = 'P2001';
    END IF;

    UPDATE public.user_voice_actor_link_requests AS request
    SET result_link_id = p_expected_link_id,
        result_changed = FALSE,
        completed_at = pg_catalog.clock_timestamp()
    WHERE request.actor_id = p_actor_id AND request.request_id = p_request_id;

    RETURN QUERY SELECT FALSE, NULL::UUID, FALSE;
    RETURN;
  END IF;

  DELETE FROM public.user_voice_actor_links AS link
  WHERE link.id = v_link.id;

  INSERT INTO public.audit_logs (
    user_id, entity_type, entity_id, action,
    previous_value, new_value, points_awarded,
    request_id, request_fingerprint, metadata
  ) VALUES (
    p_actor_id,
    'user_voice_actor_link',
    v_link.id::TEXT,
    'delete',
    pg_catalog.to_jsonb(v_link),
    NULL,
    0,
    p_request_id,
    v_fingerprint,
    pg_catalog.jsonb_build_object(
      'source', 'api/delete-user-voice-actor-link',
      'request_id', p_request_id
    )
  )
  RETURNING id INTO v_audit_log_id;

  UPDATE public.user_voice_actor_link_requests AS request
  SET result_link_id = v_link.id,
      result_changed = TRUE,
      audit_log_id = v_audit_log_id,
      completed_at = pg_catalog.clock_timestamp()
  WHERE request.actor_id = p_actor_id AND request.request_id = p_request_id;

  RETURN QUERY SELECT TRUE, v_audit_log_id, FALSE;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_link_user_voice_actor_controlled(UUID, UUID, UUID, INTEGER)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_link_user_voice_actor_controlled(UUID, UUID, UUID, INTEGER)
  TO authenticated;

REVOKE ALL ON FUNCTION public.delete_user_voice_actor_link_controlled(UUID, UUID, UUID, INTEGER, UUID)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_user_voice_actor_link_controlled(UUID, UUID, UUID, INTEGER, UUID)
  TO authenticated;
