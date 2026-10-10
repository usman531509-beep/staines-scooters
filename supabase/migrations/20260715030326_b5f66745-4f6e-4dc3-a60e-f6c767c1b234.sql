
-- 1. Tighten is_dawat_member to require active = true so deactivated
--    members lose access to dawat_dinners, dawat_raffle_queue, dawat_profiles etc.
CREATE OR REPLACE FUNCTION public.is_dawat_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dawat_profiles
    WHERE id = _user_id AND active = true
  )
$$;

-- 2. Add owner-scoped INSERT/UPDATE/DELETE policies on the dawat-avatars bucket.
--    Files are stored with the owning user's id as the first path segment
--    (e.g. "{user_id}/avatar.png") — enforced by these policies.
DROP POLICY IF EXISTS "Dawat members can upload their own avatar" ON storage.objects;
CREATE POLICY "Dawat members can upload their own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'dawat-avatars'
  AND public.is_dawat_member(auth.uid())
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Dawat members can update their own avatar" ON storage.objects;
CREATE POLICY "Dawat members can update their own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'dawat-avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'dawat-avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Dawat members can delete their own avatar" ON storage.objects;
CREATE POLICY "Dawat members can delete their own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'dawat-avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
