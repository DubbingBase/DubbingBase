CREATE OR REPLACE FUNCTION get_top_contributors(limit_param INT DEFAULT 10)
RETURNS TABLE (
  user_id UUID,
  score BIGINT,
  raw_user_meta_data JSONB
)
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH all_contributions AS (
    SELECT created_by FROM work WHERE created_by IS NOT NULL
    UNION ALL
    SELECT created_by FROM voice_actors WHERE created_by IS NOT NULL
  )
  SELECT 
    c.created_by AS user_id,
    COUNT(c.created_by) AS score,
    au.raw_user_meta_data
  FROM all_contributions c
  JOIN auth.users au ON au.id = c.created_by
  GROUP BY c.created_by, au.raw_user_meta_data
  ORDER BY score DESC
  LIMIT limit_param;
END;
$$ LANGUAGE plpgsql;
