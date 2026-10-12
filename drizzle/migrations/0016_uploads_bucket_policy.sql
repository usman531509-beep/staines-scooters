-- Every upload now lives in one private bucket, "uploads" (created in the
-- Supabase dashboard), in folders: products/, categories/, rentals/,
-- rental-customers/, claims/, stock-evidence/, avatars/. Only staff, admins
-- and owners sign in, so they get full access; no one else has any.
DROP POLICY IF EXISTS "Staff manage uploads" ON storage.objects;
CREATE POLICY "Staff manage uploads" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'uploads' AND private.has_any_staff_role(auth.uid()))
  WITH CHECK (bucket_id = 'uploads' AND private.has_any_staff_role(auth.uid()));
