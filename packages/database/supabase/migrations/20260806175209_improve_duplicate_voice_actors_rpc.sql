CREATE OR REPLACE FUNCTION public.find_duplicate_voice_actors_rpc()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH normalized_actors AS (
  SELECT 
    id, firstname, lastname, bio, nationality, date_of_birth, tmdb_id, wikidata_id, profile_picture,
    string_to_array(public.normalize_actor_name(firstname), ' ') AS norm_first_arr,
    string_to_array(public.normalize_actor_name(lastname), ' ') AS norm_last_arr
  FROM voice_actors
),
duplicate_pairs AS (
  SELECT DISTINCT
    LEAST(a.id, b.id) AS id1,
    GREATEST(a.id, b.id) AS id2
  FROM normalized_actors a
  JOIN normalized_actors b ON a.id != b.id
  WHERE 
    (a.norm_first_arr && b.norm_first_arr) 
    AND (a.norm_last_arr && b.norm_last_arr)
    AND (a.norm_first_arr <@ b.norm_first_arr AND a.norm_last_arr <@ b.norm_last_arr)
),
grouped AS (
  SELECT id1, array_agg(DISTINCT id2) AS id2s
  FROM duplicate_pairs
  GROUP BY id1
)
SELECT 
  COALESCE(json_agg(
    json_build_object(
      'actors', (
        SELECT json_agg(
          json_build_object(
            'id', v.id,
            'firstname', v.firstname,
            'lastname', v.lastname,
            'bio', v.bio,
            'nationality', v.nationality,
            'date_of_birth', v.date_of_birth,
            'tmdb_id', v.tmdb_id,
            'wikidata_id', v.wikidata_id,
            'profile_picture', v.profile_picture
          )
        )
        FROM voice_actors v
        WHERE v.id = ANY(g.id2s || g.id1)
      )
    )
  ), '[]'::json)
FROM grouped g;
$$;
