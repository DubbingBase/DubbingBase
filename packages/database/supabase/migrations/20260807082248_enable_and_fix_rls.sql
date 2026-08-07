-- 1. Enable RLS on missing tables
ALTER TABLE public.voice_actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- 2. Policies for missing tables
-- voice_actors
CREATE POLICY "Allow public read access to voice_actors" ON public.voice_actors FOR SELECT USING (true);
CREATE POLICY "Allow admin write access to voice_actors" ON public.voice_actors FOR ALL USING (
  (auth.role() = 'authenticated') AND ((auth.jwt() ->> 'role' = 'admin') OR ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin') OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'))
);

-- source
CREATE POLICY "Allow public read access to source" ON public.source FOR SELECT USING (true);
CREATE POLICY "Allow admin write access to source" ON public.source FOR ALL USING (
  (auth.role() = 'authenticated') AND ((auth.jwt() ->> 'role' = 'admin') OR ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin') OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'))
);

-- work
CREATE POLICY "Allow public read access to work" ON public.work FOR SELECT USING (true);
CREATE POLICY "Allow admin write access to work" ON public.work FOR ALL USING (
  (auth.role() = 'authenticated') AND ((auth.jwt() ->> 'role' = 'admin') OR ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin') OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'))
);

-- votes
CREATE POLICY "Allow public read access to votes" ON public.votes FOR SELECT USING (true);
CREATE POLICY "Allow public insert to votes" ON public.votes FOR INSERT WITH CHECK (true);

-- 3. Fix user_profiles
DROP POLICY IF EXISTS "Allow users to read their own profile" ON public.user_profiles;
CREATE POLICY "Allow public read access to user_profiles" ON public.user_profiles FOR SELECT USING (true);

-- 4. Fix studios
-- Remove old permissive policy
DROP POLICY IF EXISTS "Allow authenticated write access to studios" ON public.studios;
-- Insert & Update for all authenticated users
CREATE POLICY "Allow authenticated insert to studios" ON public.studios FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated update to studios" ON public.studios FOR UPDATE USING (auth.role() = 'authenticated');
-- Delete only for admin/editor
CREATE POLICY "Allow admin/editor delete to studios" ON public.studios FOR DELETE USING (
  (auth.role() = 'authenticated') AND (
    (auth.jwt() ->> 'role' IN ('admin', 'editor')) OR 
    ((auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'editor')) OR 
    ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'editor'))
  )
);

-- 5. Fix project_attachments
-- Remove old restricted policies
DROP POLICY IF EXISTS "Allow editors read access to project_attachments" ON public.project_attachments;
DROP POLICY IF EXISTS "Allow editors insert access to project_attachments" ON public.project_attachments;
DROP POLICY IF EXISTS "Allow editors update access to project_attachments" ON public.project_attachments;
DROP POLICY IF EXISTS "Allow editors delete access to project_attachments" ON public.project_attachments;

-- Public Read
CREATE POLICY "Allow public read access to project_attachments" ON public.project_attachments FOR SELECT USING (true);
-- Insert & Update for authenticated users
CREATE POLICY "Allow authenticated insert to project_attachments" ON public.project_attachments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated update to project_attachments" ON public.project_attachments FOR UPDATE USING (auth.role() = 'authenticated');
-- Delete only for admin/editor
CREATE POLICY "Allow admin/editor delete to project_attachments" ON public.project_attachments FOR DELETE USING (
  (auth.role() = 'authenticated') AND (
    (auth.jwt() ->> 'role' IN ('admin', 'editor')) OR 
    ((auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'editor')) OR 
    ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'editor'))
  )
);
