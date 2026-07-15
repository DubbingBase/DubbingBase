CREATE OR REPLACE FUNCTION public.normalize_actor_name(str text) RETURNS text AS $$
BEGIN
  RETURN trim(regexp_replace(lower(public.unaccent(COALESCE(str, ''))), '[^a-z0-9]+', ' ', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.find_duplicate_voice_actors_rpc()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH normalized_actors AS (
  SELECT 
    id, firstname, lastname, bio, nationality, date_of_birth, tmdb_id, wikidata_id, profile_picture,
    public.normalize_actor_name(firstname) AS norm_first,
    public.normalize_actor_name(lastname) AS norm_last
  FROM voice_actors
),
duplicate_keys AS (
  SELECT norm_first, norm_last
  FROM normalized_actors
  GROUP BY norm_first, norm_last
  HAVING COUNT(*) > 1
)
SELECT 
  COALESCE(json_agg(
    json_build_object(
      'actors', group_actors
    )
  ), '[]'::json)
FROM (
  SELECT 
    n.norm_first, n.norm_last,
    json_agg(
      json_build_object(
        'id', n.id,
        'firstname', n.firstname,
        'lastname', n.lastname,
        'bio', n.bio,
        'nationality', n.nationality,
        'date_of_birth', n.date_of_birth,
        'tmdb_id', n.tmdb_id,
        'wikidata_id', n.wikidata_id,
        'profile_picture', n.profile_picture
      )
    ) AS group_actors
  FROM normalized_actors n
  JOIN duplicate_keys d ON n.norm_first = d.norm_first AND n.norm_last = d.norm_last
  GROUP BY n.norm_first, n.norm_last
) grouped;
$$;