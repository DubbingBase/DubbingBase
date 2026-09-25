-- Authorization roles are assigned in app_metadata by trusted server-side code.
-- Keep every database policy on that single trusted role source.

DROP POLICY IF EXISTS "Allow admin write access to voice_actors" ON public.voice_actors;
CREATE POLICY "Allow admin write access to voice_actors" ON public.voice_actors
  FOR ALL TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'admin')
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role') = 'admin');

DROP POLICY IF EXISTS "Allow admin write access to source" ON public.source;
CREATE POLICY "Allow admin write access to source" ON public.source
  FOR ALL TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'admin')
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role') = 'admin');

DROP POLICY IF EXISTS "Allow admin write access to work" ON public.work;
CREATE POLICY "Allow admin write access to work" ON public.work
  FOR ALL TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'admin')
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role') = 'admin');

DROP POLICY IF EXISTS "Allow admin/editor delete to studios" ON public.studios;
CREATE POLICY "Allow admin/editor delete to studios" ON public.studios
  FOR DELETE TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') IN ('admin', 'editor'));

DROP POLICY IF EXISTS "Allow admin/editor delete to project_attachments" ON public.project_attachments;
CREATE POLICY "Allow admin/editor delete to project_attachments" ON public.project_attachments
  FOR DELETE TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') IN ('admin', 'editor'));

DROP POLICY IF EXISTS "Allow authenticated insert access" ON public.dubbing_projects;
CREATE POLICY "Allow authenticated insert access" ON public.dubbing_projects
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role') IN ('admin', 'editor'));

DROP POLICY IF EXISTS "Allow individual update access" ON public.dubbing_projects;
CREATE POLICY "Allow individual update access" ON public.dubbing_projects
  FOR UPDATE TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') IN ('admin', 'editor'))
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role') IN ('admin', 'editor'));

DROP POLICY IF EXISTS "Allow authenticated insert access" ON public.dubbing_project_crew;
CREATE POLICY "Allow authenticated insert access" ON public.dubbing_project_crew
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role') IN ('admin', 'editor'));

DROP POLICY IF EXISTS "Allow individual update access" ON public.dubbing_project_crew;
CREATE POLICY "Allow individual update access" ON public.dubbing_project_crew
  FOR UPDATE TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') IN ('admin', 'editor'))
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role') IN ('admin', 'editor'));

DROP POLICY IF EXISTS "Allow individual delete access" ON public.dubbing_project_crew;
CREATE POLICY "Allow individual delete access" ON public.dubbing_project_crew
  FOR DELETE TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') IN ('admin', 'editor'));

DROP POLICY IF EXISTS "Allow admin write access" ON public.jobs;
CREATE POLICY "Allow admin write access" ON public.jobs
  FOR ALL TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'admin')
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role') = 'admin');

DROP POLICY IF EXISTS "Users and admins can view reports." ON public.user_reports;
CREATE POLICY "Users and admins can view reports."
  ON public.user_reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id OR (auth.jwt()->'app_metadata'->>'role') = 'admin');

DROP POLICY IF EXISTS "Admins can update user reports." ON public.user_reports;
CREATE POLICY "Admins can update user reports."
  ON public.user_reports FOR UPDATE TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'admin')
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role') = 'admin');

DROP POLICY IF EXISTS "Allow users or admins to manage voice actor links" ON public.user_voice_actor_links;
CREATE POLICY "Allow users or admins to manage voice actor links"
  ON public.user_voice_actor_links FOR ALL TO authenticated
  USING (auth.uid() = user_id OR (auth.jwt()->'app_metadata'->>'role') = 'admin')
  WITH CHECK (auth.uid() = user_id OR (auth.jwt()->'app_metadata'->>'role') = 'admin');

DROP POLICY IF EXISTS "Allow editors read access to project_attachments bucket" ON storage.objects;
CREATE POLICY "Allow editors read access to project_attachments bucket" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'project_attachments' AND (auth.jwt()->'app_metadata'->>'role') IN ('admin', 'editor'));

DROP POLICY IF EXISTS "Allow editors insert access to project_attachments bucket" ON storage.objects;
CREATE POLICY "Allow editors insert access to project_attachments bucket" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project_attachments' AND (auth.jwt()->'app_metadata'->>'role') IN ('admin', 'editor'));

DROP POLICY IF EXISTS "Allow editors delete access to project_attachments bucket" ON storage.objects;
CREATE POLICY "Allow editors delete access to project_attachments bucket" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'project_attachments' AND (auth.jwt()->'app_metadata'->>'role') IN ('admin', 'editor'));

DROP POLICY IF EXISTS "Allow editors insert access to studio_logos" ON storage.objects;
CREATE POLICY "Allow editors insert access to studio_logos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'studio_logos' AND (auth.jwt()->'app_metadata'->>'role') IN ('admin', 'editor'));

DROP POLICY IF EXISTS "Allow editors delete access to studio_logos" ON storage.objects;
CREATE POLICY "Allow editors delete access to studio_logos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'studio_logos' AND (auth.jwt()->'app_metadata'->>'role') IN ('admin', 'editor'));

DROP POLICY IF EXISTS "Allow editors update access to studio_logos" ON storage.objects;
CREATE POLICY "Allow editors update access to studio_logos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'studio_logos' AND (auth.jwt()->'app_metadata'->>'role') IN ('admin', 'editor'))
  WITH CHECK (bucket_id = 'studio_logos' AND (auth.jwt()->'app_metadata'->>'role') IN ('admin', 'editor'));
