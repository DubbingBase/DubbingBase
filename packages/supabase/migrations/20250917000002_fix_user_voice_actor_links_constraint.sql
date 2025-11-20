-- Migration: Fix user_voice_actor_links constraint
-- Date: 2025-09-17
-- Reason: Remove unique constraint on user_id to allow multiple voice actor profiles per user,
--         and add unique constraint on (user_id, voice_actor_id) to prevent duplicate links

-- Drop any existing unique constraint on user_id if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_voice_actor_links_user_id_key'
        AND conrelid = 'user_voice_actor_links'::regclass
    ) THEN
        ALTER TABLE user_voice_actor_links DROP CONSTRAINT user_voice_actor_links_user_id_key;
    END IF;
END $$;

-- Add unique constraint on (user_id, voice_actor_id) to prevent duplicate links
ALTER TABLE user_voice_actor_links
ADD CONSTRAINT user_voice_actor_links_user_id_voice_actor_id_key
UNIQUE (user_id, voice_actor_id);
