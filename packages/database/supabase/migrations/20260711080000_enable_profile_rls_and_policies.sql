-- Enable Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_voice_actor_links ENABLE ROW LEVEL SECURITY;

-- Policies for public.user_profiles
CREATE POLICY "Allow users to read their own profile" ON public.user_profiles
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Allow users to insert their own profile" ON public.user_profiles
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to update their own profile" ON public.user_profiles
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Allow users to delete their own profile" ON public.user_profiles
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Policies for public.user_voice_actor_links
CREATE POLICY "Allow public read access to user_voice_actor_links" ON public.user_voice_actor_links
    FOR SELECT TO public USING (true);

CREATE POLICY "Allow users or admins to manage voice actor links" ON public.user_voice_actor_links
    FOR ALL TO authenticated USING (
        auth.uid() = user_id OR
        auth.jwt()->>'role' = 'admin' OR 
        (auth.jwt()->'user_metadata'->>'role') = 'admin' OR
        (auth.jwt()->'app_metadata'->>'role') = 'admin'
    );
