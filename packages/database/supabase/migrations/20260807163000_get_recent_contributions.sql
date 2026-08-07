
CREATE OR REPLACE FUNCTION public.get_recent_contributions(limit_param integer DEFAULT 10)
  RETURNS TABLE(
    id uuid,
    user_name text,
    action text,
    entity_type text,
    entity_id text,
    entity_name text,
    points_awarded integer,
    created_at timestamp with time zone
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id,
    COALESCE(
      au.raw_user_meta_data->>'username', 
      au.raw_user_meta_data->>'full_name', 
      'Anonymous Contributor'
    ) AS user_name,
    al.action,
    al.entity_type,
    al.entity_id,
    CASE
      WHEN al.entity_type IN ('voice_actors', 'voice_actor') THEN (
        SELECT (va.firstname || COALESCE(' ' || va.lastname, '')) 
        FROM voice_actors va WHERE va.id::text = al.entity_id LIMIT 1
      )
      WHEN al.entity_type IN ('studios', 'studio') THEN (
        SELECT s.name 
        FROM studios s WHERE s.id::text = al.entity_id LIMIT 1
      )
      ELSE 'Unknown'
    END AS entity_name,
    al.points_awarded,
    al.created_at
  FROM audit_logs al
  JOIN auth.users au ON au.id = al.user_id
  ORDER BY al.created_at DESC
  LIMIT limit_param;
END;
$$;

