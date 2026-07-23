CREATE OR REPLACE FUNCTION merge_voice_actors(p_keep_id INT, p_other_ids INT[])
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Defensively ensure p_keep_id is not in the array of duplicates being merged
    p_other_ids := array_remove(p_other_ids, p_keep_id);

    -- 1. Delete duplicate works from other_ids that would violate unique constraint
    DELETE FROM work w1
    WHERE w1.voice_actor_id = ANY(p_other_ids)
    AND EXISTS (
        SELECT 1 FROM work w2
        WHERE w2.voice_actor_id = p_keep_id
        -- Use IS NOT DISTINCT FROM to safely handle NULL values
        AND w1.dubbing_project_id IS NOT DISTINCT FROM w2.dubbing_project_id
        AND w1.actor_id IS NOT DISTINCT FROM w2.actor_id
    );

    -- 2. Update the remaining works to the keep_id
    UPDATE work
    SET voice_actor_id = p_keep_id
    WHERE voice_actor_id = ANY(p_other_ids);

    -- 3. Merge metadata from duplicates into the kept record if fields are NULL
    UPDATE voice_actors k
    SET 
        tmdb_id = COALESCE(k.tmdb_id, d.tmdb_id),
        wikidata_id = COALESCE(k.wikidata_id, d.wikidata_id),
        bio = COALESCE(k.bio, d.bio),
        nationality = COALESCE(k.nationality, d.nationality),
        date_of_birth = COALESCE(k.date_of_birth, d.date_of_birth),
        awards = COALESCE(k.awards, d.awards),
        years_active = COALESCE(k.years_active, d.years_active),
        social_media_links = COALESCE(k.social_media_links, d.social_media_links),
        profile_picture = COALESCE(k.profile_picture, d.profile_picture)
    FROM (
        SELECT 
            (array_agg(tmdb_id) FILTER (WHERE tmdb_id IS NOT NULL))[1] as tmdb_id,
            (array_agg(wikidata_id) FILTER (WHERE wikidata_id IS NOT NULL))[1] as wikidata_id,
            (array_agg(bio) FILTER (WHERE bio IS NOT NULL))[1] as bio,
            (array_agg(nationality) FILTER (WHERE nationality IS NOT NULL))[1] as nationality,
            (array_agg(date_of_birth) FILTER (WHERE date_of_birth IS NOT NULL))[1] as date_of_birth,
            (array_agg(awards) FILTER (WHERE awards IS NOT NULL))[1] as awards,
            (array_agg(years_active) FILTER (WHERE years_active IS NOT NULL))[1] as years_active,
            (array_agg(social_media_links) FILTER (WHERE social_media_links IS NOT NULL))[1] as social_media_links,
            (array_agg(profile_picture) FILTER (WHERE profile_picture IS NOT NULL))[1] as profile_picture
        FROM voice_actors
        WHERE id = ANY(p_other_ids)
    ) d
    WHERE k.id = p_keep_id;

    -- 4. Delete the duplicated voice_actors
    DELETE FROM voice_actors
    WHERE id = ANY(p_other_ids);
END;
$$;
