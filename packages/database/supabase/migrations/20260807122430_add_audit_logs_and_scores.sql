-- Create Audit Logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL, -- using text to handle both uuid and integer ids from different tables
    action TEXT NOT NULL,
    previous_value JSONB,
    new_value JSONB,
    points_awarded INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reverted_at TIMESTAMPTZ
);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users to power the global ticker and user profiles
CREATE POLICY "Enable read access for all authenticated users" ON public.audit_logs FOR SELECT TO authenticated USING (true);

-- Create a table for locking tasks to prevent duplicate work (race conditions)
CREATE TABLE IF NOT EXISTS public.gamification_task_locks (
    category TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    locked_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (category, entity_id)
);

-- Enable RLS (only edge functions using service role will modify this, so no public policies needed)
ALTER TABLE public.gamification_task_locks ENABLE ROW LEVEL SECURITY;

-- Completeness Score for Voice Actors
CREATE OR REPLACE FUNCTION public.voice_actor_completeness(va public.voice_actors)
RETURNS INTEGER AS $$
DECLARE
    score INTEGER := 0;
    total_fields INTEGER := 6;
BEGIN
    IF va.profile_picture IS NOT NULL THEN score := score + 1; END IF;
    IF va.bio IS NOT NULL THEN score := score + 1; END IF;
    IF va.date_of_birth IS NOT NULL THEN score := score + 1; END IF;
    IF va.nationality IS NOT NULL THEN score := score + 1; END IF;
    IF va.tmdb_id IS NOT NULL THEN score := score + 1; END IF;
    IF va.wikidata_id IS NOT NULL THEN score := score + 1; END IF;
    
    RETURN (score * 100) / total_fields;
END;
$$ LANGUAGE plpgsql STABLE;

-- Completeness Score for Dubbing Projects
CREATE OR REPLACE FUNCTION public.dubbing_project_completeness(dp public.dubbing_projects)
RETURNS INTEGER AS $$
DECLARE
    score INTEGER := 0;
    total_fields INTEGER := 2;
BEGIN
    IF dp.studio_id IS NOT NULL THEN score := score + 1; END IF;
    IF dp.language IS NOT NULL THEN score := score + 1; END IF;
    
    RETURN (score * 100) / total_fields;
END;
$$ LANGUAGE plpgsql STABLE;
