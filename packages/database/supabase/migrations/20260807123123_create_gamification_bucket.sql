-- Create a storage bucket for gamification uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('gamification_uploads', 'gamification_uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to the bucket
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'gamification_uploads');

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'gamification_uploads');
