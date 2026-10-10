
CREATE POLICY "Staff upload email-assets" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'email-assets' AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('owner','admin','staff')));
CREATE POLICY "Staff read email-assets" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'email-assets' AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('owner','admin','staff')));
