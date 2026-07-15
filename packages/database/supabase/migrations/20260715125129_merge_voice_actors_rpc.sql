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
        AND w1.content_id IS NOT DISTINCT FROM w2.content_id
        AND w1.actor_id IS NOT DISTINCT FROM w2.actor_id
        AND w1.content_type IS NOT DISTINCT FROM w2.content_type
    );

    -- 2. Update the remaining works to the keep_id
    UPDATE work
    SET voice_actor_id = p_keep_id
    WHERE voice_actor_id = ANY(p_other_ids);

    -- 3. Delete the duplicated voice_actors
    DELETE FROM voice_actors
    WHERE id = ANY(p_other_ids);
END;
$$;
