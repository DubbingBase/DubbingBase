-- Add audit columns to tables
-- Add missing audit columns: created_at, created_by, updated_at, updated_by

-- voice_actors table
ALTER TABLE voice_actors
ADD COLUMN created_at timestamptz DEFAULT now(),
ADD COLUMN created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
ADD COLUMN updated_at timestamptz DEFAULT now(),
ADD COLUMN updated_by uuid REFERENCES auth.users(id);

-- work table
ALTER TABLE work
ADD COLUMN created_at timestamptz DEFAULT now(),
ADD COLUMN created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
ADD COLUMN updated_at timestamptz DEFAULT now(),
ADD COLUMN updated_by uuid REFERENCES auth.users(id);

-- user_profiles table (already has created_at, updated_at)
ALTER TABLE user_profiles
ADD COLUMN created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
ADD COLUMN updated_by uuid REFERENCES auth.users(id);

-- user_voice_actor_links table
ALTER TABLE user_voice_actor_links
ADD COLUMN created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
ADD COLUMN updated_at timestamptz DEFAULT now(),
ADD COLUMN updated_by uuid REFERENCES auth.users(id);

-- Create reusable trigger function
CREATE OR REPLACE FUNCTION set_updated_columns()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    NEW.updated_by = auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for each table
CREATE TRIGGER set_updated_columns_voice_actors
    BEFORE UPDATE ON voice_actors
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_columns();

CREATE TRIGGER set_updated_columns_work
    BEFORE UPDATE ON work
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_columns();

CREATE TRIGGER set_updated_columns_user_profiles
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_columns();

CREATE TRIGGER set_updated_columns_user_voice_actor_links
    BEFORE UPDATE ON user_voice_actor_links
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_columns();
