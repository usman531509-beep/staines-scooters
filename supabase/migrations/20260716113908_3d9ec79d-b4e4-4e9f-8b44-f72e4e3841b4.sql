
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS claim_reference TEXT;
CREATE INDEX IF NOT EXISTS claims_claim_reference_idx ON public.claims(claim_reference) WHERE deleted_at IS NULL;

DROP POLICY IF EXISTS "Owner can delete claims" ON public.claims;
CREATE POLICY "Admins can delete claims" ON public.claims FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(),'owner'::public.app_role) OR private.has_role(auth.uid(),'admin'::public.app_role));

DROP POLICY IF EXISTS "Owner can delete claim docs" ON public.claim_documents;
CREATE POLICY "Admins can delete claim docs" ON public.claim_documents FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(),'owner'::public.app_role) OR private.has_role(auth.uid(),'admin'::public.app_role));

DROP POLICY IF EXISTS "Owner delete claim-documents" ON storage.objects;
CREATE POLICY "Admins delete claim-documents" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'claim-documents' AND (private.has_role(auth.uid(),'owner'::public.app_role) OR private.has_role(auth.uid(),'admin'::public.app_role)));
