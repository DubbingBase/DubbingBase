-- Allow admins to view all user reports
DROP POLICY IF EXISTS "Users can view their own reports." ON public.user_reports;
CREATE POLICY "Users and admins can view reports."
  ON public.user_reports FOR SELECT
  TO authenticated
  USING (
    auth.uid() = reporter_id OR
    auth.jwt()->>'role' = 'admin' OR
    (auth.jwt()->'user_metadata'->>'role') = 'admin' OR
    (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

-- Allow admins to update user reports (e.g. status)
CREATE POLICY "Admins can update user reports."
  ON public.user_reports FOR UPDATE
  TO authenticated
  USING (
    auth.jwt()->>'role' = 'admin' OR
    (auth.jwt()->'user_metadata'->>'role') = 'admin' OR
    (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );
