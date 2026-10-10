
-- 1. Drop the redundant "all authenticated" SELECT policy on loyalty_settings.
-- Staff continue to read via "settings read staff"; customers continue via the
-- SECURITY DEFINER get_loyalty_settings() RPC.
DROP POLICY IF EXISTS "settings read all authenticated" ON public.loyalty_settings;

-- 2. Restrict dawat-avatars storage reads to Dawat group members only.
DROP POLICY IF EXISTS "Signed-in users can read dawat avatars" ON storage.objects;
CREATE POLICY "Dawat members can read dawat avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'dawat-avatars'
  AND public.is_dawat_member(auth.uid())
);

-- 3. Revoke direct EXECUTE from anon/authenticated on SECURITY DEFINER helpers
-- that are only referenced from RLS policies (RLS evaluation uses the table
-- owner's privileges, so policies keep working).
REVOKE EXECUTE ON FUNCTION public.has_dawat_role(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_dawat_member(uuid) FROM PUBLIC, anon, authenticated;
