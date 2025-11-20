-- Add reviewed_status column to work table
ALTER TABLE work ADD COLUMN reviewed_status text DEFAULT 'waiting' CHECK (reviewed_status IN ('waiting', 'rejected', 'accepted'));

-- Create votes table
CREATE TABLE votes (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    work_id bigint NOT NULL REFERENCES work(id),
    vote_type text NOT NULL CHECK (vote_type IN ('up', 'down')),
    created_at timestamp with time zone DEFAULT now()
);

-- Add unique constraint on (user_id, work_id)
ALTER TABLE votes ADD CONSTRAINT unique_user_work_vote UNIQUE (user_id, work_id);