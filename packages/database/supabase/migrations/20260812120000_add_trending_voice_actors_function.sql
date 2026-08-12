CREATE OR REPLACE FUNCTION get_trending_voice_actors(
  limit_param INTEGER DEFAULT 10,
  months_param INTEGER DEFAULT 6
)
RETURNS TABLE(voice_actor JSONB, work_count BIGINT)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    jsonb_build_object(
      'id', va.id,
      'firstname', va.firstname,
      'lastname', va.lastname,
      'profile_picture', va.profile_picture,
      'bio', va.bio,
      'nationality', va.nationality,
      'date_of_birth', va.date_of_birth,
      'awards', va.awards,
      'years_active', va.years_active,
      'social_media_links', va.social_media_links,
      'tmdb_id', va.tmdb_id,
      'wikidata_id', va.wikidata_id
    ) as voice_actor,
    COUNT(w.id) as work_count
  FROM voice_actors va
  JOIN work w ON va.id = w.voice_actor_id
  WHERE w.voice_actor_id IS NOT NULL
    AND w.created_at >= now() - (months_param || ' months')::interval
  GROUP BY va.id, va.firstname, va.lastname, va.profile_picture, va.bio, va.nationality, va.date_of_birth, va.awards, va.years_active, va.social_media_links, va.tmdb_id, va.wikidata_id
  ORDER BY work_count DESC
  LIMIT limit_param;
END;
$$;