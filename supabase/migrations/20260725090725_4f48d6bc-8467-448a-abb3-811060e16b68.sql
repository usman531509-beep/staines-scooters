CREATE POLICY "rental-docs customer insert own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'rental-documents'
  AND public.rental_is_owner(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY "rental-docs customer read own"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'rental-documents'
  AND public.rental_is_owner(((storage.foldername(name))[1])::uuid, auth.uid())
);