
CREATE POLICY "Staff can upload product images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-images' AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('owner','admin','staff')));

CREATE POLICY "Staff can update product images" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'product-images' AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('owner','admin','staff')));

CREATE POLICY "Staff can delete product images" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'product-images' AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('owner','admin','staff')));

CREATE POLICY "Anyone can read product images" ON storage.objects
FOR SELECT TO authenticated, anon
USING (bucket_id = 'product-images');
