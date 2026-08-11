-- 1. Insert the bucket (public=true because logos need to be visible without auth)
INSERT INTO storage.buckets (id, name, public) VALUES ('studio_logos', 'studio_logos', true) ON CONFLICT (id) DO NOTHING;

-- 2. Public Read Access
CREATE POLICY "Allow public read access to studio_logos" ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'studio_logos'
    );

-- 3. Admin/Editor Insert Access
CREATE POLICY "Allow editors insert access to studio_logos" ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'studio_logos' AND
        auth.role() = 'authenticated' AND
        (
            auth.jwt()->>'role' IN ('admin', 'editor') OR
            (auth.jwt()->'user_metadata'->>'role') IN ('admin', 'editor') OR
            (auth.jwt()->'app_metadata'->>'role') IN ('admin', 'editor')
        )
    );

-- 4. Admin/Editor Delete Access
CREATE POLICY "Allow editors delete access to studio_logos" ON storage.objects
    FOR DELETE
    USING (
        bucket_id = 'studio_logos' AND
        auth.role() = 'authenticated' AND
        (
            auth.jwt()->>'role' IN ('admin', 'editor') OR
            (auth.jwt()->'user_metadata'->>'role') IN ('admin', 'editor') OR
            (auth.jwt()->'app_metadata'->>'role') IN ('admin', 'editor')
        )
    );

-- 5. Admin/Editor Update Access
CREATE POLICY "Allow editors update access to studio_logos" ON storage.objects
    FOR UPDATE
    USING (
        bucket_id = 'studio_logos' AND
        auth.role() = 'authenticated' AND
        (
            auth.jwt()->>'role' IN ('admin', 'editor') OR
            (auth.jwt()->'user_metadata'->>'role') IN ('admin', 'editor') OR
            (auth.jwt()->'app_metadata'->>'role') IN ('admin', 'editor')
        )
    )
    WITH CHECK (
        bucket_id = 'studio_logos' AND
        auth.role() = 'authenticated' AND
        (
            auth.jwt()->>'role' IN ('admin', 'editor') OR
            (auth.jwt()->'user_metadata'->>'role') IN ('admin', 'editor') OR
            (auth.jwt()->'app_metadata'->>'role') IN ('admin', 'editor')
        )
    );
