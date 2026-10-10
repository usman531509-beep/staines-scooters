
CREATE POLICY "user-avatars read own" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'user-avatars' AND (auth.uid()::text = (storage.foldername(name))[1] OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('owner','admin','staff'))));
CREATE POLICY "user-avatars insert own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'user-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "user-avatars update own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'user-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "user-avatars delete own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'user-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
