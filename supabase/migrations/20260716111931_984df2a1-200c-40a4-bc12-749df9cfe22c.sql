
CREATE TABLE public.claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_full_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  accident_date DATE NOT NULL,
  claim_submitted_date DATE,
  vehicle_reg TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','accepted','rejected','closed')),
  commission_received BOOLEAN NOT NULL DEFAULT false,
  commission_received_date DATE,
  commission_amount_pence INTEGER NOT NULL DEFAULT 85000,
  storage_received BOOLEAN NOT NULL DEFAULT false,
  storage_received_date DATE,
  storage_amount_pence INTEGER,
  closed_date DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.claims TO authenticated;
GRANT ALL ON public.claims TO service_role;

ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read claims" ON public.claims FOR SELECT TO authenticated
  USING (private.has_any_staff_role(auth.uid()));
CREATE POLICY "Staff can insert claims" ON public.claims FOR INSERT TO authenticated
  WITH CHECK (private.has_any_staff_role(auth.uid()));
CREATE POLICY "Staff can update claims" ON public.claims FOR UPDATE TO authenticated
  USING (private.has_any_staff_role(auth.uid()));
CREATE POLICY "Owner can delete claims" ON public.claims FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(),'owner'::public.app_role));

CREATE TRIGGER claims_set_updated_at BEFORE UPDATE ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX claims_status_idx ON public.claims(status) WHERE deleted_at IS NULL;
CREATE INDEX claims_accident_date_idx ON public.claims(accident_date DESC) WHERE deleted_at IS NULL;

CREATE TABLE public.claim_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL DEFAULT 'other'
    CHECK (doc_type IN ('commission_invoice','storage_invoice','claim_form','other')),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.claim_documents TO authenticated;
GRANT ALL ON public.claim_documents TO service_role;

ALTER TABLE public.claim_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read claim docs" ON public.claim_documents FOR SELECT TO authenticated
  USING (private.has_any_staff_role(auth.uid()));
CREATE POLICY "Staff can insert claim docs" ON public.claim_documents FOR INSERT TO authenticated
  WITH CHECK (private.has_any_staff_role(auth.uid()));
CREATE POLICY "Owner can delete claim docs" ON public.claim_documents FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(),'owner'::public.app_role));

CREATE INDEX claim_documents_claim_id_idx ON public.claim_documents(claim_id);

CREATE POLICY "Staff read claim-documents" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'claim-documents' AND private.has_any_staff_role(auth.uid()));
CREATE POLICY "Staff insert claim-documents" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'claim-documents' AND private.has_any_staff_role(auth.uid()));
CREATE POLICY "Owner delete claim-documents" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'claim-documents' AND private.has_role(auth.uid(),'owner'::public.app_role));
