-- Atomic, audited profile picture change. The upload route stages the validated image in
-- storage first; this function then swaps the stored path under a row lock, so concurrent
-- uploads cannot both win and every change leaves a before/after audit row that the public
-- change history can show. Anyone confirmed and unblocked may add a first picture; replacing
-- an existing one needs an admin or a trusted account (checked here against the live flags).
CREATE OR REPLACE FUNCTION public.controlled_set_voice_actor_picture(
  p_actor_id UUID,
  p_voice_actor_id BIGINT,
  p_new_path TEXT,
  p_expected_previous TEXT DEFAULT NULL
)
RETURNS TABLE(previous_picture TEXT, audit_log_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_metadata JSONB;
  v_can_replace BOOLEAN;
  v_before public.voice_actors%ROWTYPE;
  v_after public.voice_actors%ROWTYPE;
  v_audit_id UUID;
BEGIN
  IF p_actor_id IS NULL OR p_voice_actor_id IS NULL OR p_voice_actor_id <= 0
     OR p_new_path IS NULL
     OR p_new_path !~ ('^' || p_voice_actor_id::TEXT || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$') THEN
    RAISE EXCEPTION 'Voice actor picture fields are invalid' USING ERRCODE = '22023';
  END IF;

  PERFORM private.assert_contributor(p_actor_id);
  SELECT users.raw_app_meta_data INTO v_metadata FROM auth.users AS users WHERE users.id = p_actor_id;
  v_can_replace := COALESCE(v_metadata ->> 'role' = 'admin', FALSE)
    OR COALESCE(v_metadata ->> 'trusted' = 'true', FALSE);

  SELECT actor.* INTO v_before
  FROM public.voice_actors AS actor
  WHERE actor.id = p_voice_actor_id
  FOR UPDATE OF actor;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Voice actor not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_before.profile_picture IS DISTINCT FROM p_expected_previous THEN
    RAISE EXCEPTION 'Profile picture changed during upload' USING ERRCODE = '40001';
  END IF;
  IF NOT v_can_replace AND COALESCE(v_before.profile_picture, '') <> '' THEN
    RAISE EXCEPTION 'Only trusted contributors and admins can replace a profile picture'
      USING ERRCODE = '42501';
  END IF;

  PERFORM pg_catalog.set_config('request.jwt.claim.sub', p_actor_id::TEXT, TRUE);
  UPDATE public.voice_actors AS actor
  SET profile_picture = p_new_path
  WHERE actor.id = p_voice_actor_id
  RETURNING actor.* INTO v_after;

  INSERT INTO public.audit_logs (
    user_id, entity_type, entity_id, action,
    previous_value, new_value, points_awarded, created_at
  ) VALUES (
    p_actor_id, 'voice_actor', p_voice_actor_id::TEXT, 'update',
    pg_catalog.to_jsonb(v_before), pg_catalog.to_jsonb(v_after), 0, clock_timestamp()
  )
  RETURNING id INTO v_audit_id;

  RETURN QUERY SELECT v_before.profile_picture, v_audit_id;
END;
$$;

REVOKE ALL ON FUNCTION public.controlled_set_voice_actor_picture(UUID, BIGINT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.controlled_set_voice_actor_picture(UUID, BIGINT, TEXT, TEXT)
  TO service_role;
