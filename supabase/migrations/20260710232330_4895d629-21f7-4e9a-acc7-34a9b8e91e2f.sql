CREATE POLICY "Signed-in users can read dawat avatars"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'dawat-avatars');