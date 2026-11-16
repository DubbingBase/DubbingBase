-- Public change history for open editing. Returns a contributor's display name but never
-- their id or email. Both historical spellings of entity_type ('voice_actor'/'voice_actors',
-- 'studio'/'studios') are accepted, and a voice actor's history also includes edits to
-- the cast credits attached to that voice actor.
DROP FUNCTION IF EXISTS public.get_entity_history(TEXT, BIGINT, INTEGER);
CREATE FUNCTION public.get_entity_history(
  p_entity_type TEXT,
  p_entity_id BIGINT,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE(
  id UUID,
  created_at TIMESTAMPTZ,
  action TEXT,
  entity_type TEXT,
  entity_id TEXT,
  user_name TEXT,
  previous_value JSONB,
  new_value JSONB,
  reverted_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_entity_type IS NULL OR p_entity_type NOT IN ('voice_actor', 'studio', 'work')
     OR p_entity_id IS NULL OR p_entity_id <= 0 THEN
    RAISE EXCEPTION 'Entity history parameters are invalid' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    audit.id,
    audit.created_at,
    audit.action,
    audit.entity_type,
    audit.entity_id,
    COALESCE(
      auth_user.raw_user_meta_data ->> 'username',
      auth_user.raw_user_meta_data ->> 'full_name',
      'Anonymous contributor'
    ) AS user_name,
    audit.previous_value,
    audit.new_value,
    audit.reverted_at
  FROM public.audit_logs AS audit
  LEFT JOIN auth.users AS auth_user ON auth_user.id = audit.user_id
  WHERE audit.action <> 'noop'
    AND (
      (p_entity_type = 'voice_actor' AND (
        (audit.entity_type IN ('voice_actor', 'voice_actors') AND audit.entity_id = p_entity_id::TEXT)
        OR (audit.entity_type = 'work' AND (
          audit.new_value ->> 'voice_actor_id' = p_entity_id::TEXT
          OR audit.previous_value ->> 'voice_actor_id' = p_entity_id::TEXT
        ))
      ))
      OR (p_entity_type = 'studio'
        AND audit.entity_type IN ('studio', 'studios') AND audit.entity_id = p_entity_id::TEXT)
      OR (p_entity_type = 'work' AND audit.entity_type = 'work' AND audit.entity_id = p_entity_id::TEXT)
    )
  ORDER BY audit.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
END;
$$;

REVOKE ALL ON FUNCTION public.get_entity_history(TEXT, BIGINT, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_entity_history(TEXT, BIGINT, INTEGER) TO service_role;
