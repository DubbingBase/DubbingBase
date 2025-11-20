-- Create enum type for voice actor statuses
CREATE TYPE voice_actor_status AS ENUM ('active', 'not contacted', 'not answered');

-- Add status column to voice_actors table
ALTER TABLE voice_actors ADD COLUMN status voice_actor_status;