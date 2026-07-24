CREATE OR REPLACE FUNCTION get_work_votes_with_user(p_work_ids bigint[], p_user_id uuid DEFAULT NULL)
RETURNS TABLE (
  work_id bigint,
  up_count bigint,
  down_count bigint,
  user_vote text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.work_id,
    count(CASE WHEN v.vote_type = 'up' THEN 1 END) AS up_count,
    count(CASE WHEN v.vote_type = 'down' THEN 1 END) AS down_count,
    max(CASE WHEN v.user_id = p_user_id THEN v.vote_type END) AS user_vote
  FROM votes v
  WHERE v.work_id = ANY(p_work_ids)
  GROUP BY v.work_id;
END;
$$ LANGUAGE plpgsql STABLE;
