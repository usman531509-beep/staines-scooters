-- 1. Restrict product-images bucket SELECT to staff only.
-- Signed URLs (createSignedUrl) bypass RLS and continue to work for customers if we ever need them.
DROP POLICY IF EXISTS "Public read of product images bucket" ON storage.objects;

CREATE POLICY "Staff can read product images"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = ANY (ARRAY['owner'::app_role, 'admin'::app_role, 'staff'::app_role])
    )
  );

-- 2. Tighten cash-out INSERT policy with defense-in-depth WITH CHECK.
DROP POLICY IF EXISTS "self cashout create" ON public.cash_out_requests;

CREATE POLICY "self cashout create"
  ON public.cash_out_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND points > 0
    AND cash_value_pence >= 0
  );
